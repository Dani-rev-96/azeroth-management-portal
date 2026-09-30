// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import Database from 'better-sqlite3'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  PORTAL_DATABASES,
  PortalRestoreValidationError,
  ensurePortalBackupTempDir,
  getPortalDbPath,
  snapshotPortalDatabase,
  swapPortalDatabaseFile,
  validatePortalSqliteFile,
} from '../../../../../server/utils/backup/portal-sqlite'

let root: string

beforeAll(() => {
  root = mkdtempSync(join(tmpdir(), 'portal-sqlite-test-'))
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterAll(() => {
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

function createDb(path: string, sql: string, wal = true) {
  const db = new Database(path)
  if (wal) db.pragma('journal_mode = WAL')
  db.exec(sql)
  db.close()
}

describe('swapPortalDatabaseFile rollback', () => {
  it('puts the previous file back when the final rename fails', () => {
    const dir = mkdtempSync(join(root, 'swap-rollback-'))
    const target = join(dir, 'target.db')
    writeFileSync(target, 'OLD')
    // A replacement on another filesystem: fsync works, but rename fails (EXDEV),
    // so the swap must roll the pre-restore copy back into place.
    const shmDir = mkdtempSync('/dev/shm/swap-rollback-')
    const replacement = join(shmDir, 'replacement.db')
    writeFileSync(replacement, 'NEW')

    let closed = false
    expect(() => swapPortalDatabaseFile({
      targetPath: target,
      replacementPath: replacement,
      closeLiveDatabase: () => { closed = true },
    })).toThrow(/EXDEV|EXDEV: cross-device link not permitted/)
    expect(closed).toBe(true)
    expect(readFileSync(target, 'utf8')).toBe('OLD')
    expect(existsSync(replacement)).toBe(true)
    rmSync(shmDir, { recursive: true, force: true })
  })
})

describe('portal DB registry', () => {
  it('maps each key to its env var / default file and required table', () => {
    expect(PORTAL_DATABASES.map(db => [db.key, db.envVar, db.requiredTable])).toEqual([
      ['mappings', 'DB_PATH', 'account_mappings'],
      ['user-settings', 'USER_SETTINGS_DB_PATH', 'feature_grants'],
      ['portal-config', 'PORTAL_CONFIG_DB_PATH', 'portal_settings'],
    ])
    expect(getPortalDbPath('mappings', { DB_PATH: '/data/sqlite/mappings.db' })).toBe('/data/sqlite/mappings.db')
    expect(getPortalDbPath('portal-config', {})).toBe(join(process.cwd(), 'data', 'portal-config.db'))
    expect(getPortalDbPath('nope', {})).toBeNull()
  })
})

describe('snapshotPortalDatabase', () => {
  it('writes a consistent copy (including un-checkpointed WAL data) into <db dir>/.backup-tmp', async () => {
    const dir = join(root, 'snapshot')
    mkdirSync(dir)
    const dbPath = join(dir, 'mappings.db')
    const live = new Database(dbPath)
    live.pragma('journal_mode = WAL')
    live.pragma('wal_autocheckpoint = 0')
    live.exec('CREATE TABLE account_mappings (id INTEGER PRIMARY KEY, external_id TEXT)')
    live.prepare('INSERT INTO account_mappings (external_id) VALUES (?)').run('in-wal-only')
    expect(statSync(`${dbPath}-wal`).size).toBeGreaterThan(0)

    const snapshotPath = await snapshotPortalDatabase(dbPath, 'mappings')
    live.close()

    expect(snapshotPath.startsWith(join(dir, '.backup-tmp'))).toBe(true)
    const copy = new Database(snapshotPath, { readonly: true })
    expect(copy.prepare('SELECT external_id FROM account_mappings').all()).toEqual([{ external_id: 'in-wal-only' }])
    copy.close()
  })
})

describe('validatePortalSqliteFile', () => {
  it('accepts a SQLite file that has the required table and leaves no -wal/-shm behind', () => {
    const path = join(root, 'valid.db')
    createDb(path, 'CREATE TABLE feature_grants (id INTEGER PRIMARY KEY)')
    expect(() => validatePortalSqliteFile(path, 'feature_grants')).not.toThrow()
    expect(existsSync(`${path}-wal`)).toBe(false)
    expect(existsSync(`${path}-shm`)).toBe(false)
  })

  it('rejects non-SQLite files by header', () => {
    const path = join(root, 'not-sqlite.db')
    writeFileSync(path, 'definitely not a database file')
    expect(() => validatePortalSqliteFile(path, 'feature_grants')).toThrow(PortalRestoreValidationError)
    expect(() => validatePortalSqliteFile(path, 'feature_grants')).toThrow(/not a SQLite database/)
  })

  it('rejects a valid SQLite file of the wrong portal DB', () => {
    const path = join(root, 'wrong.db')
    createDb(path, 'CREATE TABLE portal_settings (id INTEGER PRIMARY KEY)')
    expect(() => validatePortalSqliteFile(path, 'account_mappings')).toThrow(/no account_mappings table/)
  })

  it('rejects a truncated/corrupt SQLite file', () => {
    const good = join(root, 'good-for-corrupt.db')
    createDb(good, `CREATE TABLE account_mappings (id INTEGER PRIMARY KEY, v TEXT);
      WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 2000)
      INSERT INTO account_mappings (v) SELECT hex(randomblob(64)) FROM n;`, false)
    const bytes = readFileSync(good)
    const corrupt = join(root, 'corrupt.db')
    writeFileSync(corrupt, bytes.subarray(0, Math.floor(bytes.length / 2)))
    expect(() => validatePortalSqliteFile(corrupt, 'account_mappings')).toThrow(PortalRestoreValidationError)
  })
})

describe('swapPortalDatabaseFile with the real util getters', () => {
  const savedEnv = { ...process.env }

  afterAll(() => {
    process.env = { ...savedEnv }
    vi.resetModules()
  })

  it('swaps each portal DB under its live connection and the getter reopens with the new data', async () => {
    const dataDir = join(root, 'live')
    mkdirSync(dataDir)
    process.env.DB_PATH = join(dataDir, 'mappings.db')
    process.env.USER_SETTINGS_DB_PATH = join(dataDir, 'user-settings.db')
    process.env.PORTAL_CONFIG_DB_PATH = join(dataDir, 'portal-config.db')
    vi.resetModules()

    const mappingsDb = await import('../../../../../server/utils/db')
    const userSettings = await import('../../../../../server/utils/user-settings')
    const portalConfig = await import('../../../../../server/utils/portal-config-db')

    const cases = [
      {
        key: 'mappings',
        get: () => mappingsDb.getDatabase(),
        close: mappingsDb.closeDatabase,
        table: 'account_mappings',
      },
      {
        key: 'user-settings',
        get: () => userSettings.getUserSettingsDatabase(),
        close: userSettings.closeUserSettingsDatabase,
        table: 'feature_grants',
      },
      {
        key: 'portal-config',
        get: () => portalConfig.getPortalConfigDatabase(),
        close: portalConfig.closePortalConfigDatabase,
        table: 'portal_settings',
      },
    ]

    try {
      for (const c of cases) {
        const targetPath = getPortalDbPath(c.key)!
        const live = c.get()
        live.exec('CREATE TABLE IF NOT EXISTS restore_marker (value TEXT)')
        live.prepare('INSERT INTO restore_marker VALUES (?)').run(`old-${c.key}`)

        // Replacement: a snapshot of the live DB with different marker data, in the same-fs temp dir
        const replacementPath = join(await ensurePortalBackupTempDir(targetPath), `upload-${c.key}.db`)
        await live.backup(replacementPath)
        const replacement = new Database(replacementPath)
        replacement.exec('DELETE FROM restore_marker')
        replacement.prepare('INSERT INTO restore_marker VALUES (?)').run(`new-${c.key}`)
        replacement.close()
        validatePortalSqliteFile(replacementPath, c.table)

        const sigtermBefore = process.listenerCount('SIGTERM')
        const { preRestorePath } = swapPortalDatabaseFile({
          targetPath,
          replacementPath,
          closeLiveDatabase: c.close,
          now: new Date('2026-09-30T12:00:00.000Z'),
        })

        expect(existsSync(replacementPath)).toBe(false)
        expect(existsSync(`${targetPath}-shm`)).toBe(false)
        expect(preRestorePath).toBe(targetPath.replace(/\.db$/, '') + '.pre-restore-2026-09-30T12-00-00-000Z.db')

        // Getter reopens lazily with the restored content
        const reopened = c.get()
        expect(reopened).not.toBe(live)
        expect(reopened.prepare('SELECT value FROM restore_marker').all()).toEqual([{ value: `new-${c.key}` }])
        // Re-open must not register another set of shutdown handlers
        expect(process.listenerCount('SIGTERM')).toBe(sigtermBefore)

        // The previous state is kept next to it
        const previous = new Database(preRestorePath!, { readonly: true })
        expect(previous.prepare('SELECT value FROM restore_marker').all()).toEqual([{ value: `old-${c.key}` }])
        previous.close()
      }

      expect(readdirSync(join(dataDir, '.backup-tmp'))).toEqual([])
    } finally {
      for (const c of cases) c.close()
    }
  })
})
