// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { spawnSync } from 'child_process'
import { createHash } from 'crypto'
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, rmSync, chmodSync } from 'fs'
import { gunzipSync } from 'zlib'
import { join, resolve } from 'path'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'

const SCRIPT = resolve(__dirname, '../../../../k3s/base/backups/scripts/sqlite-backup.sh')
const hasSqlite3 = spawnSync('sqlite3', ['--version']).status === 0
const isRoot = typeof process.getuid === 'function' && process.getuid() === 0
const DATABASES = ['mappings.db', 'user-settings.db', 'portal-config.db']

let workDir: string
let sourceDir: string
let backupRoot: string
let openDatabases: Database.Database[]

function runBackup(env: Record<string, string> = {}) {
  const result = spawnSync('sh', [SCRIPT], {
    env: {
      PATH: process.env.PATH ?? '',
      SQLITE_SOURCE_DIR: sourceDir,
      BACKUP_ROOT: backupRoot,
      ...env,
    },
    encoding: 'utf8',
  })
  return { status: result.status, stderr: result.stderr }
}

/** Creates the portal databases in WAL mode and keeps them open, like the running portal does. */
function createPortalDatabases(rows = 25) {
  for (const file of DATABASES) {
    const db = new Database(join(sourceDir, file))
    db.pragma('journal_mode = WAL')
    db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT); CREATE TABLE "odd ""name""" (id INTEGER)')
    const insert = db.prepare('INSERT INTO items (value) VALUES (?)')
    for (let i = 0; i < rows; i++) insert.run(`${file}-${i}`)
    openDatabases.push(db)
  }
}

function listFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).sort() : []
}

function readJson(path: string) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

beforeEach(() => {
  workDir = mkdtempSync(join(tmpdir(), 'sqlite-backup-test-'))
  sourceDir = join(workDir, 'sqlite')
  backupRoot = join(workDir, 'backups', 'sqlite')
  mkdirSync(sourceDir)
  openDatabases = []
})

afterEach(() => {
  chmodSync(sourceDir, 0o755)
  for (const db of openDatabases) if (db.open) db.close()
  rmSync(workDir, { recursive: true, force: true })
})

describe.skipIf(!hasSqlite3)('sqlite-backup.sh', () => {
  it('copies every database (read-only source, open WAL writer) into a verified gzip + manifest', () => {
    createPortalDatabases()
    // Simulate the read-only mount: nothing in the source directory is writable for the job,
    // including the -shm file (SQLite then uses its read-only WAL index path).
    for (const name of readdirSync(sourceDir)) chmodSync(join(sourceDir, name), 0o444)
    chmodSync(sourceDir, 0o555)

    const result = runBackup()
    expect(result.status, result.stderr).toBe(0)

    for (const file of DATABASES) {
      const name = file.replace('.db', '')
      const dir = join(backupRoot, name)
      const dumps = listFiles(dir).filter(entry => entry.endsWith('.db.gz'))
      expect(dumps).toHaveLength(1)
      expect(listFiles(dir).filter(entry => entry.includes('.partial'))).toEqual([])
      const ts = dumps[0]!.replace('.db.gz', '')
      const compressed = readFileSync(join(dir, dumps[0]!))

      const manifest = readJson(join(dir, `${ts}.json`))
      expect(manifest).toMatchObject({
        kind: 'sqlite',
        database: name,
        source: join(sourceDir, file),
        file: `${ts}.db.gz`,
        compression: 'gzip',
        sizeBytes: compressed.length,
        sha256: createHash('sha256').update(compressed).digest('hex'),
        integrityCheck: 'ok',
        tables: { 'items': 25, 'odd "name"': 0 },
      })

      // The copy is a standalone rollback-journal database with the source's content.
      const restoredPath = join(workDir, `${name}-restored.db`)
      writeFileSync(restoredPath, gunzipSync(compressed))
      expect(manifest.uncompressedSizeBytes).toBe(readFileSync(restoredPath).length)
      const restored = new Database(restoredPath, { readonly: true })
      expect(restored.pragma('journal_mode', { simple: true })).toBe('delete')
      expect(restored.prepare('SELECT COUNT(*) AS n FROM items').get()).toEqual({ n: 25 })
      restored.close()
    }

    // The source was not modified.
    expect(listFiles(sourceDir)).toEqual(DATABASES.flatMap(file => [file, `${file}-shm`, `${file}-wal`]).sort())

    const status = readJson(join(backupRoot, 'status.json'))
    expect(status.job).toBe('portal-sqlite-backup')
    expect(status.ok).toBe(true)
    expect(status.targets.map((t: { database: string }) => t.database)).toEqual(['mappings', 'user-settings', 'portal-config'])
    expect(status.targets[0].lastError).toBeNull()
    expect(status.targets[0].lastBackup).toMatch(/^mappings\/\d{8}T\d{6}Z\.db\.gz$/)
  })

  it('reports a missing database and still copies the others', () => {
    createPortalDatabases()
    const result = runBackup({ SQLITE_DATABASES: 'mappings.db missing.db portal-config.db' })
    expect(result.status).toBe(1)
    const status = readJson(join(backupRoot, 'status.json'))
    expect(status.ok).toBe(false)
    expect(status.targets[1]).toMatchObject({ database: 'missing', lastSuccessAt: null })
    expect(status.targets[1].lastError).toContain('not found')
    expect(listFiles(join(backupRoot, 'portal-config')).filter(entry => entry.endsWith('.db.gz'))).toHaveLength(1)
  })

  it.skipIf(isRoot)('copies a checkpointed database on a read-only mount via the immutable=1 fallback', () => {
    createPortalDatabases()
    for (const db of openDatabases) db.close() // portal stopped: -wal/-shm are removed
    chmodSync(sourceDir, 0o555)
    const result = runBackup({ SQLITE_DATABASES: 'mappings.db' })
    expect(result.status).toBe(0)
    expect(readJson(join(backupRoot, 'status.json')).targets[0].lastError).toBeNull()
    const gz = listFiles(join(backupRoot, 'mappings')).filter(entry => entry.endsWith('.db.gz'))
    expect(gz).toHaveLength(1)
    const check = join(workDir, 'check.db')
    writeFileSync(check, gunzipSync(readFileSync(join(backupRoot, 'mappings', gz[0]!))))
    const db = new Database(check, { readonly: true })
    expect(db.pragma('integrity_check', { simple: true })).toBe('ok')
    expect((db.prepare('SELECT COUNT(*) AS n FROM items').get() as { n: number }).n).toBe(25)
    db.close()
  })

  it('applies the shared retention policy to old copies', () => {
    createPortalDatabases()
    const dir = join(backupRoot, 'mappings')
    mkdirSync(dir, { recursive: true })
    const seeded = Array.from({ length: 12 }, (_, i) => `2018${String(i + 1).padStart(2, '0')}01T031500Z`)
    for (const ts of seeded) {
      writeFileSync(join(dir, `${ts}.db.gz`), 'old')
      writeFileSync(join(dir, `${ts}.json`), '{}')
    }
    expect(runBackup({ SQLITE_DATABASES: 'mappings.db' }).status).toBe(0)
    const remaining = listFiles(dir).filter(entry => entry.startsWith('2018') && entry.endsWith('.db.gz'))
    expect(remaining).toEqual(seeded.slice(7).map(ts => `${ts}.db.gz`))
    expect(existsSync(join(dir, `${seeded[0]}.json`))).toBe(false)
  })

  it('DRY_RUN=1 copies, writes and deletes nothing', () => {
    createPortalDatabases()
    const dir = join(backupRoot, 'mappings')
    mkdirSync(dir, { recursive: true })
    writeFileSync(join(dir, '20180101T031500Z.db.gz'), 'old')
    writeFileSync(join(dir, '20180102T031500Z.db.gz'), 'old')
    const result = runBackup({ DRY_RUN: '1' })
    expect(result.status, result.stderr).toBe(0)
    expect(result.stderr).toContain(`DRY_RUN: would delete ${dir}/20180101T031500Z.db.gz`)
    expect(listFiles(dir)).toEqual(['20180101T031500Z.db.gz', '20180102T031500Z.db.gz'])
    expect(existsSync(join(backupRoot, 'status.json'))).toBe(false)
    expect(existsSync(join(backupRoot, 'user-settings'))).toBe(false)
  })

  it('rejects database entries that are not plain *.db file names', () => {
    createPortalDatabases()
    const result = runBackup({ SQLITE_DATABASES: '../etc/passwd mappings.db' })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain("invalid SQLITE_DATABASES entry '../etc/passwd'")
    expect(listFiles(join(backupRoot, 'mappings')).filter(entry => entry.endsWith('.db.gz'))).toHaveLength(1)
  })

  it('copies a checkpointed database without -wal via the immutable=1 fallback', () => {
    // Databases created and closed cleanly: no -wal/-shm, like after a portal restart
    // where no request touched them before the nightly job ran.
    for (const file of DATABASES) {
      const db = new Database(join(sourceDir, file))
      db.pragma('journal_mode = WAL')
      db.exec('CREATE TABLE items (id INTEGER PRIMARY KEY, value TEXT)')
      db.exec("INSERT INTO items (value) VALUES ('kept')")
      db.close()
      expect(existsSync(`${join(sourceDir, file)}-wal`)).toBe(false)
    }
    const result = runBackup()
    expect(result.status).toBe(0)
    for (const file of DATABASES) {
      const name = file.replace(/\.db$/, '')
      const gz = listFiles(join(backupRoot, name)).filter(entry => entry.endsWith('.db.gz'))
      expect(gz).toHaveLength(1)
      const check = join(workDir, `check-${name}.db`)
      writeFileSync(check, gunzipSync(readFileSync(join(backupRoot, name, gz[0]!))))
      const db = new Database(check, { readonly: true })
      expect((db.prepare("SELECT value FROM items WHERE value = 'kept'").get() as { value: string }).value).toBe('kept')
      db.close()
    }
  })
})
