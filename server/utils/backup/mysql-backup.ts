/**
 * Streaming MySQL backup/restore helpers (mysqldump | gzip → file, file → gunzip → mysql).
 *
 * Nothing here buffers a whole dump in memory: data always flows through
 * stream pipelines between the child process and a file on disk.
 * The password is passed via MYSQL_PWD, never on argv (argv is visible in /proc).
 *
 * SERVER-SIDE ONLY
 */
import { spawn, type ChildProcess } from 'node:child_process'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdtemp, open, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { Readable } from 'node:stream'
import { createGunzip, createGzip } from 'node:zlib'

export interface MysqlConnectionConfig {
  host: string
  port: number
  user: string
  password: string
  database: string
}

/** Database name of every realm's characters DB (the realm config does not expose it). */
export const CHARACTERS_DATABASE_NAME = 'acore_characters'

const STDERR_TAIL_BYTES = 4096

/** Absolute mysqldump path from MYSQLDUMP_BIN (set in the image), else PATH lookup. */
export function resolveMysqldumpBin(env: NodeJS.ProcessEnv = process.env): string {
  return env.MYSQLDUMP_BIN || 'mysqldump'
}

/** Absolute mysql client path from MYSQL_BIN (set in the image), else PATH lookup. */
export function resolveMysqlBin(env: NodeJS.ProcessEnv = process.env): string {
  return env.MYSQL_BIN || 'mysql'
}

/** Restore is off unless BACKUP_RESTORE_ENABLED is exactly 'true' or '1'. */
export function isRestoreEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const value = env.BACKUP_RESTORE_ENABLED?.trim().toLowerCase()
  return value === 'true' || value === '1'
}

/**
 * Upload size caps for the restore routes. An upload larger than the temp
 * volume would fill it (SQLite) or get the pod evicted (MySQL emptyDir), so
 * oversized uploads are rejected with 413 instead.
 * Env overrides: BACKUP_RESTORE_MAX_BYTES_SQLITE / BACKUP_RESTORE_MAX_BYTES_MYSQL.
 */
export function restoreUploadLimitBytes(which: 'sqlite' | 'mysql', env: NodeJS.ProcessEnv = process.env): number {
  const fallback = which === 'sqlite' ? 512 * 1024 * 1024 : 6 * 1024 * 1024 * 1024
  const raw = which === 'sqlite' ? env.BACKUP_RESTORE_MAX_BYTES_SQLITE : env.BACKUP_RESTORE_MAX_BYTES_MYSQL
  if (raw === undefined || raw === '') return fallback
  const parsed = Number(raw)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : fallback
}

function connectionArgs(config: MysqlConnectionConfig): string[] {
  return [
    `--host=${config.host}`,
    `--port=${config.port}`,
    `--user=${config.user}`,
  ]
}

/**
 * mysqldump arguments for a MySQL 8.4 client against MySQL 8.4/9 servers.
 * Flags verified against `mysqldump --help` of mysql84 (8.4.7).
 */
export function buildMysqldumpArgs(config: MysqlConnectionConfig): string[] {
  return [
    ...connectionArgs(config),
    '--single-transaction',
    '--routines',
    '--triggers',
    '--events',
    '--set-gtid-purged=OFF',
    '--no-tablespaces',
    '--column-statistics=0',
    '--add-drop-table',
    config.database,
  ]
}

export function buildMysqlRestoreArgs(config: MysqlConnectionConfig): string[] {
  return [...connectionArgs(config), config.database]
}

function childEnv(config: MysqlConnectionConfig): NodeJS.ProcessEnv {
  return { ...process.env, MYSQL_PWD: config.password }
}

/** Keeps only the last STDERR_TAIL_BYTES of a child's stderr for error messages. */
function collectStderrTail(stream: Readable | null): () => string {
  let tail = ''
  stream?.setEncoding('utf8')
  stream?.on('data', (chunk: string) => {
    tail = (tail + chunk).slice(-STDERR_TAIL_BYTES)
  })
  return () => tail.trim()
}

interface ChildExit {
  code: number | null
  signal: NodeJS.Signals | null
}

/** Resolves on 'close' (all stdio closed), rejects on spawn errors such as ENOENT. */
function waitForChild(child: ChildProcess): Promise<ChildExit> {
  return new Promise((resolve, reject) => {
    child.once('error', reject)
    child.once('close', (code, signal) => resolve({ code, signal }))
  })
}

function describeExit(bin: string, exit: ChildExit, stderr: string): string {
  const status = exit.signal ? `signal ${exit.signal}` : `code ${exit.code}`
  return `${bin} exited with ${status}${stderr ? `: ${stderr}` : ''}`
}

/** Creates a private temp dir inside os.tmpdir() (TMPDIR) for one backup/restore run. */
export function createBackupTempDir(prefix = 'amp-backup-'): Promise<string> {
  return mkdtemp(join(tmpdir(), prefix))
}

/**
 * Runs mysqldump and gzips its stdout into destPath.
 * Rejects (and removes destPath) on spawn errors, non-zero exit or stream errors.
 * An abort signal kills the child (client went away).
 */
export async function spawnDumpToFile(
  config: MysqlConnectionConfig,
  destPath: string,
  options: { signal?: AbortSignal } = {}
): Promise<{ bytes: number }> {
  const bin = resolveMysqldumpBin()
  const child = spawn(bin, buildMysqldumpArgs(config), {
    env: childEnv(config),
    stdio: ['ignore', 'pipe', 'pipe'],
    signal: options.signal,
  })
  const stderrTail = collectStderrTail(child.stderr)
  const output = createWriteStream(destPath)

  const [exitResult, pipeResult] = await Promise.allSettled([
    waitForChild(child),
    pipeline(child.stdout!, createGzip(), output),
  ])

  try {
    if (exitResult.status === 'rejected') {
      throw new Error(`Failed to start ${bin}: ${(exitResult.reason as Error).message}`)
    }
    if (exitResult.value.code !== 0) {
      throw new Error(`mysqldump failed for ${config.database}: ${describeExit(bin, exitResult.value, stderrTail())}`)
    }
    if (pipeResult.status === 'rejected') {
      throw new Error(`Writing dump for ${config.database} failed: ${(pipeResult.reason as Error).message}`)
    }
  } catch (error) {
    output.destroy()
    await rm(destPath, { force: true })
    throw error
  }

  return { bytes: output.bytesWritten }
}

/** True when the file starts with the gzip magic bytes 1f 8b. */
export async function isGzipFile(path: string): Promise<boolean> {
  const handle = await open(path, 'r')
  try {
    const buffer = Buffer.alloc(2)
    const { bytesRead } = await handle.read(buffer, 0, 2, 0)
    return bytesRead === 2 && buffer[0] === 0x1f && buffer[1] === 0x8b
  } finally {
    await handle.close()
  }
}

/**
 * Streams srcPath (plain .sql or gzip-compressed .sql.gz) into `mysql <database>` stdin.
 * Rejects with the mysql stderr tail on non-zero exit.
 */
export async function spawnRestoreFromFile(
  config: MysqlConnectionConfig,
  srcPath: string
): Promise<void> {
  const gzipped = await isGzipFile(srcPath)
  const bin = resolveMysqlBin()
  const child = spawn(bin, buildMysqlRestoreArgs(config), {
    env: childEnv(config),
    stdio: ['pipe', 'ignore', 'pipe'],
  })
  const stderrTail = collectStderrTail(child.stderr)

  const source = createReadStream(srcPath)
  const feed = gzipped
    ? pipeline(source, createGunzip(), child.stdin!)
    : pipeline(source, child.stdin!)

  const [exitResult, pipeResult] = await Promise.allSettled([waitForChild(child), feed])

  if (exitResult.status === 'rejected') {
    throw new Error(`Failed to start ${bin}: ${(exitResult.reason as Error).message}`)
  }
  // A failing mysql closes stdin early (EPIPE); its exit status + stderr is the real cause.
  if (exitResult.value.code !== 0) {
    throw new Error(`MySQL restore failed for ${config.database}: ${describeExit(bin, exitResult.value, stderrTail())}`)
  }
  if (pipeResult.status === 'rejected') {
    throw new Error(`Reading backup for ${config.database} failed: ${(pipeResult.reason as Error).message}`)
  }
}

/** `acore_characters-realm1-2026-09-30T12-00-00Z.sql.gz` */
export function buildMysqlBackupFilename(database: string, realmId: string | undefined, date = new Date()): string {
  const timestamp = date.toISOString().replace(/\.\d{3}Z$/, 'Z').replace(/:/g, '-')
  const realmPart = realmId ? `-realm${realmId.replace(/[^A-Za-z0-9_-]/g, '_')}` : ''
  return `${database}${realmPart}-${timestamp}.sql.gz`
}
