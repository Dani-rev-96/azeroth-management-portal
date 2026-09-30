// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync, execFileSync } from 'child_process'
import { createHash } from 'crypto'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, statSync, chmodSync } from 'fs'
import { gunzipSync } from 'zlib'
import { join, resolve } from 'path'
import { tmpdir } from 'os'

const SCRIPT = resolve(__dirname, '../../../../k3s/base/backups/scripts/mysql-backup.sh')
const REAL_GZIP = execFileSync('sh', ['-c', 'command -v gzip'], { encoding: 'utf8' }).trim()

// Fake mysql/mysqldump/gzip on PATH: deterministic, no MySQL server needed.
const FAKE_MYSQL = `#!/usr/bin/env bash
host=""; sql=""
for arg in "$@"; do
  case "$arg" in
    --host=*) host="\${arg#--host=}" ;;
    --execute=*) sql="\${arg#--execute=}" ;;
  esac
done
echo "mysql pwd=\${MYSQL_PWD:-unset} $*" >> "$FAKE_LOG"
for down in $FAKE_DOWN_HOSTS; do
  if [[ "$host" == "$down" ]]; then echo "ERROR 2005 (HY000): Unknown MySQL server host '$host' (-2)" >&2; exit 1; fi
done
case "$sql" in
  *VERSION*) echo "9.7.2" ;;
  *information_schema*) printf 'account\\t2\\nrealmlist\\t1\\n' ;;
esac
`

const FAKE_MYSQLDUMP = `#!/usr/bin/env bash
if [[ "$1" == "--version" ]]; then echo "mysqldump  Ver 9.7.2 (fake)"; exit 0; fi
host=""
for arg in "$@"; do case "$arg" in --host=*) host="\${arg#--host=}" ;; esac; done
database="\${@: -1}"
echo "mysqldump pwd=\${MYSQL_PWD:-unset} $*" >> "$FAKE_LOG"
echo "-- MySQL dump (fake)"
echo "-- database: $database host: $host"
for fail in $FAKE_DUMP_FAIL_HOSTS; do
  if [[ "$host" == "$fail" ]]; then echo "mysqldump: Got error: 2013: Lost connection to MySQL server during query" >&2; exit 2; fi
done
echo "CREATE TABLE \\\`account\\\` (id int);"
echo "INSERT INTO \\\`account\\\` VALUES (1),(2);"
`

const FAKE_GZIP = `#!/usr/bin/env bash
if [[ "\${FAKE_GZIP_FAIL:-0}" == "1" && "$1" == "-c" ]]; then cat > /dev/null; echo "gzip: disk full" >&2; exit 1; fi
exec "${REAL_GZIP}" "$@"
`

let workDir: string
let backupRoot: string
let fakeLog: string
let fakeBin: string

function runBackup(env: Record<string, string> = {}) {
  const result = spawnSync('bash', [SCRIPT], {
    env: {
      PATH: `${fakeBin}:${process.env.PATH ?? ''}`,
      FAKE_LOG: fakeLog,
      FAKE_DOWN_HOSTS: '',
      FAKE_DUMP_FAIL_HOSTS: '',
      BACKUP_ROOT: backupRoot,
      MYSQL_PWD: 's3cret-pw',
      TARGETS: 'auth:db-auth:acore_auth realm1:db-one:acore_characters',
      ...env,
    },
    encoding: 'utf8',
  })
  return { status: result.status, stderr: result.stderr }
}

function listFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

function dumpsIn(dir: string): string[] {
  return listFiles(dir).filter(name => name.endsWith('.sql.gz'))
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

function seedBackup(dir: string, ts: string) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, `${ts}.sql.gz`), 'old')
  writeFileSync(join(dir, `${ts}.json`), '{}')
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'mysql-backup-test-'))
  backupRoot = join(workDir, 'backups', 'mysql')
  fakeLog = join(workDir, 'fake.log')
  fakeBin = join(workDir, 'bin')
  mkdirSync(fakeBin)
  for (const [name, content] of [['mysql', FAKE_MYSQL], ['mysqldump', FAKE_MYSQLDUMP], ['gzip', FAKE_GZIP]] as const) {
    writeFileSync(join(fakeBin, name), content)
    chmodSync(join(fakeBin, name), 0o755)
  }
  writeFileSync(fakeLog, '')
})

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true })
})

describe('mysql-backup.sh', () => {
  it('writes a gzip dump, a manifest and status.json per target', () => {
    const result = runBackup()
    expect(result.status, result.stderr).toBe(0)

    const realmDir = join(backupRoot, 'acore_characters', 'realm1')
    const dumps = dumpsIn(realmDir)
    expect(dumps).toHaveLength(1)
    const ts = dumps[0]!.replace('.sql.gz', '')
    expect(ts).toMatch(/^\d{8}T\d{6}Z$/)
    expect(listFiles(realmDir).filter(name => name.includes('.partial'))).toEqual([])

    const dumpPath = join(realmDir, `${ts}.sql.gz`)
    const dump = readFileSync(dumpPath)
    expect(gunzipSync(dump).toString()).toContain('-- database: acore_characters host: db-one')

    const manifest = readJson(join(realmDir, `${ts}.json`))
    expect(manifest).toMatchObject({
      kind: 'mysqldump',
      database: 'acore_characters',
      target: 'realm1',
      realmId: 1,
      host: 'db-one',
      port: 3306,
      serverVersion: '9.7.2',
      clientVersion: 'mysqldump  Ver 9.7.2 (fake)',
      file: `${ts}.sql.gz`,
      compression: 'gzip',
      sizeBytes: statSync(dumpPath).size,
      sha256: createHash('sha256').update(dump).digest('hex'),
      tables: { account: 2, realmlist: 1 },
    })
    expect(manifest.createdAt).toBe(
      `${ts.slice(0, 4)}-${ts.slice(4, 6)}-${ts.slice(6, 8)}T${ts.slice(9, 11)}:${ts.slice(11, 13)}:${ts.slice(13, 15)}Z`,
    )
    expect(typeof manifest.durationSec).toBe('number')

    const authManifest = readJson(join(backupRoot, 'acore_auth', 'auth', dumpsIn(join(backupRoot, 'acore_auth', 'auth'))[0]!.replace('.sql.gz', '.json')))
    expect(authManifest.realmId).toBeNull()

    const status = readJson(join(backupRoot, 'status.json'))
    expect(status.job).toBe('mysql-backup')
    expect(status.ok).toBe(true)
    expect(status.targets).toHaveLength(2)
    expect(status.targets[1]).toMatchObject({
      target: 'realm1',
      database: 'acore_characters',
      realmId: 1,
      lastSuccessAt: manifest.createdAt,
      lastBackup: `acore_characters/realm1/${ts}.sql.gz`,
      lastError: null,
    })
  })

  it('passes the required mysqldump options and keeps the password out of argv', () => {
    runBackup()
    const log = readFileSync(fakeLog, 'utf8')
    const dumpCalls = log.split('\n').filter(line => line.startsWith('mysqldump'))
    expect(dumpCalls).toHaveLength(2)
    for (const call of dumpCalls) {
      for (const option of ['--single-transaction', '--routines', '--triggers', '--events', '--set-gtid-purged=OFF', '--no-tablespaces']) {
        expect(call).toContain(option)
      }
      // one database per dump, no --databases/--all-databases (no CREATE DATABASE/USE in the file)
      expect(call).not.toMatch(/--databases|--all-databases/)
      expect(call).toContain('pwd=s3cret-pw')
      expect(call.replace('pwd=s3cret-pw', '')).not.toContain('s3cret-pw')
    }
  })

  it('continues with the other targets when one dump fails and exits 1', () => {
    const result = runBackup({
      TARGETS: 'auth:db-auth:acore_auth realm1:db-one:acore_characters realm2:db-two:acore_characters',
      FAKE_DUMP_FAIL_HOSTS: 'db-one',
    })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('FAILED acore_characters/realm1')

    expect(listFiles(join(backupRoot, 'acore_characters', 'realm1'))).toEqual([])
    expect(dumpsIn(join(backupRoot, 'acore_auth', 'auth'))).toHaveLength(1)
    expect(dumpsIn(join(backupRoot, 'acore_characters', 'realm2'))).toHaveLength(1)

    const status = readJson(join(backupRoot, 'status.json'))
    expect(status.ok).toBe(false)
    const realm1 = status.targets.find((t: { target: string }) => t.target === 'realm1')
    expect(realm1.lastSuccessAt).toBeNull()
    expect(realm1.lastError).toContain('mysqldump exit 2, gzip exit 0')
    expect(realm1.lastError).toContain('Lost connection')
  })

  it('fails the target when gzip fails (PIPESTATUS of the second command)', () => {
    const result = runBackup({ TARGETS: 'auth:db-auth:acore_auth', FAKE_GZIP_FAIL: '1' })
    expect(result.status).toBe(1)
    expect(listFiles(join(backupRoot, 'acore_auth', 'auth'))).toEqual([])
    const status = readJson(join(backupRoot, 'status.json'))
    expect(status.targets[0].lastError).toContain('mysqldump exit 0, gzip exit 1')
  })

  it('reports an unreachable server without dumping', () => {
    const result = runBackup({ TARGETS: 'auth:db-down:acore_auth', FAKE_DOWN_HOSTS: 'db-down' })
    expect(result.status).toBe(1)
    const status = readJson(join(backupRoot, 'status.json'))
    expect(status.targets[0].lastError).toContain("SELECT VERSION() failed: ERROR 2005 (HY000): Unknown MySQL server host 'db-down'")
    expect(readFileSync(fakeLog, 'utf8')).not.toContain('mysqldump pwd')
  })

  it('keeps lastSuccessAt of an earlier run when the latest run fails', () => {
    expect(runBackup({ TARGETS: 'auth:db-auth:acore_auth' }).status).toBe(0)
    const first = readJson(join(backupRoot, 'status.json')).targets[0]
    expect(first.lastSuccessAt).not.toBeNull()

    expect(runBackup({ TARGETS: 'auth:db-auth:acore_auth', FAKE_DUMP_FAIL_HOSTS: 'db-auth' }).status).toBe(1)
    const second = readJson(join(backupRoot, 'status.json')).targets[0]
    expect(second.lastSuccessAt).toBe(first.lastSuccessAt)
    expect(second.lastBackup).toBe(first.lastBackup)
    expect(second.lastError).toContain('mysqldump exit 2')
  })

  it('applies retention after a successful backup, deleting dump and manifest together', () => {
    const dir = join(backupRoot, 'acore_auth', 'auth')
    const seeded = Array.from({ length: 12 }, (_, i) => `2018${String(i + 1).padStart(2, '0')}01T033000Z`)
    for (const ts of seeded) seedBackup(dir, ts)

    expect(runBackup({ TARGETS: 'auth:db-auth:acore_auth' }).status).toBe(0)

    // Newest 6 months with backups: the current month + 2018-08..2018-12.
    const remaining = dumpsIn(dir).map(name => name.replace('.sql.gz', ''))
    expect(remaining.filter(ts => ts.startsWith('2018'))).toEqual(seeded.slice(7))
    for (const ts of seeded.slice(0, 7)) {
      expect(existsSync(join(dir, `${ts}.json`))).toBe(false)
    }
    expect(existsSync(join(dir, `${seeded[7]}.json`))).toBe(true)
  })

  it('does not apply retention when the backup failed', () => {
    const dir = join(backupRoot, 'acore_auth', 'auth')
    seedBackup(dir, '20180101T033000Z')
    seedBackup(dir, '20180102T033000Z')
    expect(runBackup({ TARGETS: 'auth:db-auth:acore_auth', FAKE_DUMP_FAIL_HOSTS: 'db-auth' }).status).toBe(1)
    expect(dumpsIn(dir)).toEqual(['20180101T033000Z.sql.gz', '20180102T033000Z.sql.gz'])
  })

  it('DRY_RUN=1 writes and deletes nothing and does not need a password', () => {
    const dir = join(backupRoot, 'acore_auth', 'auth')
    seedBackup(dir, '20180101T033000Z')
    seedBackup(dir, '20180102T033000Z')
    const result = runBackup({ DRY_RUN: '1', MYSQL_PWD: '' })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toContain('DRY_RUN: would dump acore_auth from db-auth:3306')
    expect(result.stderr).toContain(`DRY_RUN: would delete ${dir}/20180101T033000Z.sql.gz`)
    expect(dumpsIn(dir)).toEqual(['20180101T033000Z.sql.gz', '20180102T033000Z.sql.gz'])
    expect(existsSync(join(backupRoot, 'status.json'))).toBe(false)
    expect(existsSync(join(backupRoot, 'acore_characters'))).toBe(false)
    expect(readFileSync(fakeLog, 'utf8')).toBe('')
  })

  it('also dumps acore_world per realm when BACKUP_WORLD=true', () => {
    expect(runBackup({ BACKUP_WORLD: 'true' }).status).toBe(0)
    expect(dumpsIn(join(backupRoot, 'acore_world', 'realm1'))).toHaveLength(1)
    expect(existsSync(join(backupRoot, 'acore_world', 'auth'))).toBe(false)
    expect(readJson(join(backupRoot, 'status.json')).targets).toHaveLength(3)
  })

  it('rejects a missing password or empty TARGETS with exit 2', () => {
    expect(runBackup({ MYSQL_PWD: '' }).status).toBe(2)
    expect(runBackup({ TARGETS: '' }).status).toBe(2)
    expect(existsSync(join(backupRoot, 'status.json'))).toBe(false)
  })

  it('skips malformed TARGETS entries but still backs up the valid ones', () => {
    const result = runBackup({ TARGETS: 'auth:db-auth:acore_auth broken ../x:db:acore_auth' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("invalid TARGETS entry 'broken'")
    expect(result.stderr).toContain("invalid TARGETS entry '../x:db:acore_auth'")
    expect(dumpsIn(join(backupRoot, 'acore_auth', 'auth'))).toHaveLength(1)
  })
})
