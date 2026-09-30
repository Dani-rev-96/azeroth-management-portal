// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest'
import { chmodSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gunzipSync, gzipSync } from 'node:zlib'
import {
  buildMysqlBackupFilename,
  buildMysqldumpArgs,
  buildMysqlRestoreArgs,
  createBackupTempDir,
  isGzipFile,
  isRestoreEnabled,
  resolveMysqlBin,
  resolveMysqldumpBin,
  spawnDumpToFile,
  spawnRestoreFromFile,
  type MysqlConnectionConfig,
} from '../../../../../server/utils/backup/mysql-backup'

const CONFIG: MysqlConnectionConfig = {
  host: 'db.example',
  port: 3307,
  user: 'acore',
  password: 's3cret pw',
  database: 'acore_characters',
}

let binDir: string
let workDir: string

/** Writes an executable node script used as a fake mysqldump / mysql. */
function writeFakeBin(name: string, body: string): string {
  const path = join(binDir, name)
  writeFileSync(path, `#!${process.execPath}\n${body}\n`)
  chmodSync(path, 0o755)
  return path
}

const savedEnv = { ...process.env }

beforeAll(() => {
  binDir = mkdtempSync(join(tmpdir(), 'mysql-backup-bins-'))
})

afterAll(() => {
  rmSync(binDir, { recursive: true, force: true })
})

afterEach(() => {
  process.env = { ...savedEnv }
  if (workDir) rmSync(workDir, { recursive: true, force: true })
})

function newWorkDir(): string {
  workDir = mkdtempSync(join(tmpdir(), 'mysql-backup-work-'))
  return workDir
}

describe('mysql-backup: binary resolution and flags', () => {
  it('resolves binaries from MYSQLDUMP_BIN / MYSQL_BIN with name fallback', () => {
    expect(resolveMysqldumpBin({ MYSQLDUMP_BIN: '/nix/store/x/bin/mysqldump' })).toBe('/nix/store/x/bin/mysqldump')
    expect(resolveMysqlBin({ MYSQL_BIN: '/nix/store/x/bin/mysql' })).toBe('/nix/store/x/bin/mysql')
    expect(resolveMysqldumpBin({})).toBe('mysqldump')
    expect(resolveMysqlBin({})).toBe('mysql')
  })

  it('isRestoreEnabled is true only for "true" / "1"', () => {
    expect(isRestoreEnabled({})).toBe(false)
    expect(isRestoreEnabled({ BACKUP_RESTORE_ENABLED: 'false' })).toBe(false)
    expect(isRestoreEnabled({ BACKUP_RESTORE_ENABLED: 'yes' })).toBe(false)
    expect(isRestoreEnabled({ BACKUP_RESTORE_ENABLED: '0' })).toBe(false)
    expect(isRestoreEnabled({ BACKUP_RESTORE_ENABLED: 'true' })).toBe(true)
    expect(isRestoreEnabled({ BACKUP_RESTORE_ENABLED: 'TRUE' })).toBe(true)
    expect(isRestoreEnabled({ BACKUP_RESTORE_ENABLED: '1' })).toBe(true)
  })

  it('builds mysqldump args for MySQL 8.4/9 and never puts the password on argv', () => {
    const args = buildMysqldumpArgs(CONFIG)
    expect(args).toEqual([
      '--host=db.example',
      '--port=3307',
      '--user=acore',
      '--single-transaction',
      '--routines',
      '--triggers',
      '--events',
      '--set-gtid-purged=OFF',
      '--no-tablespaces',
      '--column-statistics=0',
      '--add-drop-table',
      'acore_characters',
    ])
    expect(args.join(' ')).not.toContain(CONFIG.password)
    expect(buildMysqlRestoreArgs(CONFIG)).toEqual(['--host=db.example', '--port=3307', '--user=acore', 'acore_characters'])
  })

  it('builds per-database filenames', () => {
    const date = new Date('2026-09-30T12:00:00.123Z')
    expect(buildMysqlBackupFilename('acore_characters', '1', date)).toBe('acore_characters-realm1-2026-09-30T12-00-00Z.sql.gz')
    expect(buildMysqlBackupFilename('acore_auth', undefined, date)).toBe('acore_auth-2026-09-30T12-00-00Z.sql.gz')
    expect(buildMysqlBackupFilename('acore_characters', '../x"y', date)).toBe('acore_characters-realm___x_y-2026-09-30T12-00-00Z.sql.gz')
  })

  it('creates temp dirs inside os.tmpdir()', async () => {
    const dir = await createBackupTempDir()
    try {
      expect(dir.startsWith(tmpdir())).toBe(true)
      expect(existsSync(dir)).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

describe('mysql-backup: spawnDumpToFile', () => {
  it('gzips mysqldump stdout into the destination file and passes MYSQL_PWD via env', async () => {
    const dir = newWorkDir()
    process.env.MYSQLDUMP_BIN = writeFakeBin('mysqldump-ok', `
      process.stdout.write('-- args: ' + JSON.stringify(process.argv.slice(2)) + '\\n')
      process.stdout.write('-- pwd: ' + process.env.MYSQL_PWD + '\\n')
      for (let i = 0; i < 2000; i++) process.stdout.write("INSERT INTO t VALUES (" + i + ");\\n")
    `)
    const dest = join(dir, 'dump.sql.gz')

    const { bytes } = await spawnDumpToFile(CONFIG, dest)

    const raw = readFileSync(dest)
    expect(bytes).toBe(raw.length)
    expect(await isGzipFile(dest)).toBe(true)
    const sql = gunzipSync(raw).toString('utf8')
    expect(sql).toContain('-- pwd: s3cret pw')
    expect(sql).toContain('"--set-gtid-purged=OFF"')
    expect(sql).not.toMatch(/args:.*s3cret/)
    expect(sql).toContain('INSERT INTO t VALUES (1999);')
  })

  it('rejects with the stderr tail on non-zero exit and removes the partial file', async () => {
    const dir = newWorkDir()
    process.env.MYSQLDUMP_BIN = writeFakeBin('mysqldump-fail', `
      process.stdout.write('-- partial\\n')
      process.stderr.write("mysqldump: Got error: 1045: Access denied for user 'acore'\\n")
      process.exitCode = 2
    `)
    const dest = join(dir, 'dump.sql.gz')

    await expect(spawnDumpToFile(CONFIG, dest)).rejects.toThrow(/code 2: mysqldump: Got error: 1045: Access denied/)
    expect(existsSync(dest)).toBe(false)
  })

  it('rejects when the binary does not exist (ENOENT) and leaves no file', async () => {
    const dir = newWorkDir()
    process.env.MYSQLDUMP_BIN = join(binDir, 'does-not-exist')
    const dest = join(dir, 'dump.sql.gz')

    await expect(spawnDumpToFile(CONFIG, dest)).rejects.toThrow(/Failed to start .*ENOENT/)
    expect(readdirSync(dir)).toEqual([])
  })
})

describe('mysql-backup: spawnRestoreFromFile', () => {
  /** Fake mysql: copies stdin to $FAKE_MYSQL_OUT, prints argv + MYSQL_PWD to $FAKE_MYSQL_META. */
  function fakeMysqlRecorder(): string {
    return writeFakeBin('mysql-recorder', `
      const fs = require('node:fs')
      fs.writeFileSync(process.env.FAKE_MYSQL_META, JSON.stringify({ args: process.argv.slice(2), pwd: process.env.MYSQL_PWD }))
      const out = fs.createWriteStream(process.env.FAKE_MYSQL_OUT)
      process.stdin.pipe(out)
      out.on('finish', () => process.exit(0))
    `)
  }

  function bigSql(): string {
    const lines: string[] = []
    for (let i = 0; i < 40000; i++) lines.push(`INSERT INTO characters VALUES (${i}, 'name-${i}');`)
    return lines.join('\n') + '\n'
  }

  it('streams a >1MB .sql file completely into mysql stdin (execFile/input hang regression)', async () => {
    const dir = newWorkDir()
    process.env.MYSQL_BIN = fakeMysqlRecorder()
    process.env.FAKE_MYSQL_OUT = join(dir, 'stdin.sql')
    process.env.FAKE_MYSQL_META = join(dir, 'meta.json')
    const sql = bigSql()
    expect(Buffer.byteLength(sql)).toBeGreaterThan(1024 * 1024)
    const src = join(dir, 'restore.sql')
    writeFileSync(src, sql)

    await spawnRestoreFromFile(CONFIG, src)

    expect(readFileSync(process.env.FAKE_MYSQL_OUT, 'utf8')).toBe(sql)
    const meta = JSON.parse(readFileSync(process.env.FAKE_MYSQL_META, 'utf8'))
    expect(meta.args).toEqual(buildMysqlRestoreArgs(CONFIG))
    expect(meta.pwd).toBe(CONFIG.password)
  }, 20000)

  it('gunzips .sql.gz input before feeding mysql', async () => {
    const dir = newWorkDir()
    process.env.MYSQL_BIN = fakeMysqlRecorder()
    process.env.FAKE_MYSQL_OUT = join(dir, 'stdin.sql')
    process.env.FAKE_MYSQL_META = join(dir, 'meta.json')
    const sql = bigSql()
    const src = join(dir, 'restore.sql.gz')
    writeFileSync(src, gzipSync(sql))

    await spawnRestoreFromFile(CONFIG, src)

    expect(readFileSync(process.env.FAKE_MYSQL_OUT, 'utf8')).toBe(sql)
  }, 20000)

  it('surfaces mysql stderr when mysql fails mid-stream', async () => {
    const dir = newWorkDir()
    process.env.MYSQL_BIN = writeFakeBin('mysql-fail', `
      process.stdin.once('data', () => {
        process.stderr.write("ERROR 1064 (42000) at line 1: You have an error in your SQL syntax\\n")
        process.exit(1)
      })
    `)
    const src = join(dir, 'restore.sql')
    writeFileSync(src, bigSql())

    await expect(spawnRestoreFromFile(CONFIG, src)).rejects.toThrow(
      /MySQL restore failed for acore_characters: .*code 1: ERROR 1064 \(42000\)/
    )
  }, 20000)

  it('rejects when the mysql binary does not exist', async () => {
    const dir = newWorkDir()
    process.env.MYSQL_BIN = join(binDir, 'no-mysql-here')
    const src = join(dir, 'restore.sql')
    writeFileSync(src, 'SELECT 1;\n')

    await expect(spawnRestoreFromFile(CONFIG, src)).rejects.toThrow(/Failed to start .*ENOENT/)
  })
})
