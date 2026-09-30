/**
 * Startup cleanup for backup leftovers that a crash can leave behind:
 *
 * - `<sqlite dir>/.backup-tmp/*` entries older than 1 h (snapshot/upload temp
 *   files; a live request may still own a fresh one)
 * - `amp-backup-*` / `amp-restore-*` entries in os.tmpdir() older than 6 h
 *   (per-run temp dirs of the MySQL backup/restore utils)
 * - `*.pre-restore-*.db` files on the SQLite volume: only the newest
 *   `keepPreRestorePerDatabase` per database directory are kept (plus their
 *   `-wal` sidecars)
 *
 * SERVER-SIDE ONLY
 */
import { promises as fsp } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { PORTAL_DATABASES, getPortalDbPath } from './portal-sqlite'

export const BACKUP_TMP_DIR_PREFIXES = ['amp-backup-', 'amp-restore-']
export const SQLITE_TEMP_MAX_AGE_MS = 60 * 60 * 1000
export const TMP_DIR_MAX_AGE_MS = 6 * 60 * 60 * 1000
export const KEEP_PRE_RESTORE_PER_DATABASE = 3

export interface CleanupBackupLeftoversOptions {
  now?: number
  env?: NodeJS.ProcessEnv
  sqliteTempMaxAgeMs?: number
  tmpDirMaxAgeMs?: number
  keepPreRestorePerDatabase?: number
}

async function readdirSafe(dir: string): Promise<string[]> {
  try {
    return await fsp.readdir(dir)
  } catch (error: any) {
    if (error?.code === 'ENOENT') return []
    throw error
  }
}

async function removeIfOlder(path: string, cutoffMs: number, removed: string[]): Promise<void> {
  let stats
  try {
    stats = await fsp.lstat(path)
  } catch {
    return // vanished
  }
  if (stats.mtimeMs > cutoffMs) return
  await fsp.rm(path, { recursive: true, force: true }).catch(() => {})
  removed.push(path)
}

/**
 * Removes stale backup leftovers. Returns the paths that were removed.
 * Nothing here is allowed to throw for missing directories — the portal must
 * start even when no backup has ever run.
 */
export async function cleanupBackupLeftovers(
  options: CleanupBackupLeftoversOptions = {},
): Promise<string[]> {
  const env = options.env ?? process.env
  const now = options.now ?? Date.now()
  const removed: string[] = []

  // 1. Per-run temp dirs in os.tmpdir()
  const tmpRoot = tmpdir()
  const tmpCutoff = now - (options.tmpDirMaxAgeMs ?? TMP_DIR_MAX_AGE_MS)
  for (const name of await readdirSafe(tmpRoot)) {
    if (!BACKUP_TMP_DIR_PREFIXES.some(prefix => name.startsWith(prefix))) continue
    await removeIfOlder(join(tmpRoot, name), tmpCutoff, removed)
  }

  const keep = options.keepPreRestorePerDatabase ?? KEEP_PRE_RESTORE_PER_DATABASE
  const sqliteCutoff = now - (options.sqliteTempMaxAgeMs ?? SQLITE_TEMP_MAX_AGE_MS)
  const seenDirs = new Set<string>()

  for (const definition of PORTAL_DATABASES) {
    const dbPath = getPortalDbPath(definition.key, env)
    if (!dbPath) continue
    const dir = dirname(dbPath)
    if (seenDirs.has(dir)) continue
    seenDirs.add(dir)

    // 2. Stale entries in <db dir>/.backup-tmp
    for (const name of await readdirSafe(join(dir, '.backup-tmp'))) {
      await removeIfOlder(join(dir, '.backup-tmp', name), sqliteCutoff, removed)
    }

    // 3. Pre-restore copies: keep the newest `keep`, delete the rest (+ -wal)
    const candidates: Array<{ name: string; mtimeMs: number }> = []
    for (const name of await readdirSafe(dir)) {
      if (!/\.pre-restore-.+\.db$/.test(name)) continue
      try {
        const stats = await fsp.lstat(join(dir, name))
        if (stats.isFile()) candidates.push({ name, mtimeMs: stats.mtimeMs })
      } catch {
        // vanished
      }
    }
    candidates.sort((a, b) => b.mtimeMs - a.mtimeMs)
    for (const { name } of candidates.slice(keep)) {
      await fsp.rm(join(dir, name), { force: true }).catch(() => {})
      await fsp.rm(join(dir, `${name}-wal`), { force: true }).catch(() => {})
      removed.push(join(dir, name))
    }
  }

  return removed
}
