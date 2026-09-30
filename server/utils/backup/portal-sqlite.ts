/**
 * Portal SQLite database registry plus snapshot / validation / file-swap helpers
 * used by the portal backup + restore endpoints.
 *
 * All temp files live in `<db dir>/.backup-tmp/`, i.e. on the same filesystem as
 * the database: no dependency on /tmp and no EXDEV on rename.
 *
 * SERVER-SIDE ONLY
 */
import Database from 'better-sqlite3'
import { closeSync, existsSync, fsyncSync, openSync, readSync, renameSync, rmSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { dirname, join } from 'node:path'

export interface PortalDatabaseDefinition {
  key: string
  name: string
  envVar: string
  defaultFile: string
  /** Table that must exist in an uploaded file for it to be accepted for this key */
  requiredTable: string
}

export const PORTAL_DATABASES: PortalDatabaseDefinition[] = [
  {
    key: 'mappings',
    name: 'Account Mappings',
    envVar: 'DB_PATH',
    defaultFile: 'mappings.db',
    requiredTable: 'account_mappings',
  },
  {
    key: 'user-settings',
    name: 'User Settings & Feature Grants',
    envVar: 'USER_SETTINGS_DB_PATH',
    defaultFile: 'user-settings.db',
    requiredTable: 'feature_grants',
  },
  {
    key: 'portal-config',
    name: 'Portal Configuration',
    envVar: 'PORTAL_CONFIG_DB_PATH',
    defaultFile: 'portal-config.db',
    requiredTable: 'portal_settings',
  },
]

export function getPortalDatabaseDefinition(key: string): PortalDatabaseDefinition | undefined {
  return PORTAL_DATABASES.find(db => db.key === key)
}

/** Same path resolution as the owning utils (db.ts, user-settings.ts, portal-config-db.ts). */
export function getPortalDbPath(key: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const entry = getPortalDatabaseDefinition(key)
  if (!entry) return null
  return env[entry.envVar] || join(process.cwd(), 'data', entry.defaultFile)
}

/** `<db dir>/.backup-tmp`, created on demand. */
export async function ensurePortalBackupTempDir(dbPath: string): Promise<string> {
  const dir = join(dirname(dbPath), '.backup-tmp')
  await mkdir(dir, { recursive: true })
  return dir
}

function removeSidecarFiles(path: string) {
  rmSync(`${path}-wal`, { force: true })
  rmSync(`${path}-shm`, { force: true })
}

/**
 * Consistent online snapshot (SQLite backup API, WAL-safe) of dbPath into
 * `<db dir>/.backup-tmp/`. Returns the snapshot path; the caller deletes it.
 */
export async function snapshotPortalDatabase(dbPath: string, key: string): Promise<string> {
  const tempDir = await ensurePortalBackupTempDir(dbPath)
  const snapshotPath = join(tempDir, `snapshot-${key}-${randomUUID()}.db`)
  const source = new Database(dbPath, { readonly: true, fileMustExist: true })
  try {
    await source.backup(snapshotPath)
  } catch (error) {
    rmSync(snapshotPath, { force: true })
    throw error
  } finally {
    source.close()
  }
  removeSidecarFiles(snapshotPath)
  return snapshotPath
}

const SQLITE_MAGIC = 'SQLite format 3\0'

export class PortalRestoreValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PortalRestoreValidationError'
  }
}

/** Checks SQLite header, integrity_check and presence of requiredTable. Throws PortalRestoreValidationError. */
export function validatePortalSqliteFile(path: string, requiredTable: string): void {
  const header = Buffer.alloc(16)
  const fd = openSync(path, 'r')
  let bytesRead: number
  try {
    bytesRead = readSync(fd, header, 0, 16, 0)
  } finally {
    closeSync(fd)
  }
  if (bytesRead < 16 || header.toString('latin1') !== SQLITE_MAGIC) {
    throw new PortalRestoreValidationError('Uploaded file is not a SQLite database')
  }

  let db: Database.Database | null = null
  try {
    db = new Database(path, { readonly: true, fileMustExist: true })
    const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }>
    const result = integrity[0]?.integrity_check ?? 'unknown'
    if (result !== 'ok') {
      throw new PortalRestoreValidationError(`SQLite integrity_check failed: ${result}`)
    }
    const table = db
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(requiredTable)
    if (!table) {
      throw new PortalRestoreValidationError(`Uploaded database has no ${requiredTable} table (wrong database file?)`)
    }
  } catch (error) {
    if (error instanceof PortalRestoreValidationError) throw error
    throw new PortalRestoreValidationError(`Invalid SQLite database: ${(error as Error).message}`)
  } finally {
    db?.close()
    removeSidecarFiles(path)
  }
}

function fsyncPath(path: string, flags: 'r' | 'r+') {
  const fd = openSync(path, flags)
  try {
    fsyncSync(fd)
  } finally {
    closeSync(fd)
  }
}

export interface SwapPortalDatabaseOptions {
  /** Live database file that gets replaced */
  targetPath: string
  /** Validated replacement file, must be on the same filesystem as targetPath */
  replacementPath: string
  /** Closes the live connection (checkpoint TRUNCATE + close + clear singleton) */
  closeLiveDatabase: () => void
  now?: Date
}

/**
 * Replaces the live SQLite file with replacementPath.
 *
 * Runs fully synchronously, so no request can reopen the database mid-swap:
 * fsync replacement → close live connection → move current file (+ its -wal)
 * to `<name>.pre-restore-<ts>.db` → drop stale -shm → rename replacement over
 * target → fsync directory. The owning util's getter reopens lazily afterwards.
 */
export function swapPortalDatabaseFile(options: SwapPortalDatabaseOptions): { preRestorePath: string | null } {
  const { targetPath, replacementPath, closeLiveDatabase } = options
  const timestamp = (options.now ?? new Date()).toISOString().replace(/[:.]/g, '-')

  fsyncPath(replacementPath, 'r+')
  closeLiveDatabase()

  let preRestorePath: string | null = null
  if (existsSync(targetPath)) {
    preRestorePath = targetPath.replace(/\.db$/, '') + `.pre-restore-${timestamp}.db`
    renameSync(targetPath, preRestorePath)
    // Keep any un-checkpointed WAL together with the pre-restore copy.
    if (existsSync(`${targetPath}-wal`)) renameSync(`${targetPath}-wal`, `${preRestorePath}-wal`)
  }
  removeSidecarFiles(targetPath)

  try {
    renameSync(replacementPath, targetPath)
  } catch (error) {
    // Roll the pre-restore copy back so the getter can still reopen the old data.
    if (preRestorePath) {
      try {
        renameSync(preRestorePath, targetPath)
        if (existsSync(`${preRestorePath}-wal`)) renameSync(`${preRestorePath}-wal`, `${targetPath}-wal`)
      } catch {
        // Keep the original error; the rollback failure is logged by the caller.
      }
    }
    throw error
  }
  try {
    fsyncPath(dirname(targetPath), 'r')
  } catch {
    // Directory fsync is best-effort (not supported on every filesystem)
  }

  return { preRestorePath }
}
