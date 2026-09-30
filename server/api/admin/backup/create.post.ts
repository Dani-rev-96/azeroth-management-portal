/**
 * POST /api/admin/backup/create
 * Dump ONE MySQL database (auth or a realm's characters DB) as a gzipped SQL file.
 * The dump is streamed mysqldump → gzip → temp file → response (never buffered in memory).
 * GM / admin.backup only.
 *
 * Body: { database: 'auth' | 'characters', realmId?: string }
 *   (legacy: { databases: [x] } with exactly one entry)
 */
import { once } from 'node:events'
import { rm, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { join } from 'node:path'
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getAuthDbConfig, getRealmConfig } from '#server/utils/config'
import {
  buildMysqlBackupFilename,
  createBackupTempDir,
  spawnDumpToFile,
} from '#server/utils/backup/mysql-backup'
import {
  BackupRequestError,
  parseBackupTargetRequest,
  resolveBackupTarget,
} from '#server/utils/backup/mysql-target'

export default defineEventHandler(async (event) => {
  let tempDir: string | null = null
  // Attach before the dump starts: if the client disconnects mid-dump, 'close'
  // has already fired by the time the dump finishes and would otherwise be missed.
  const clientGone = new AbortController()
  event.node.res.once('close', () => clientGone.abort())

  try {
    const { username } = await getAuthenticatedFeatureUser(event, 'admin.backup')

    const body = await readBody(event)
    const target = resolveBackupTarget(parseBackupTargetRequest(body), { getAuthDbConfig, getRealmConfig })
    const filename = buildMysqlBackupFilename(target.config.database, target.realmId)

    tempDir = await createBackupTempDir()
    const dumpPath = join(tempDir, filename)
    const startedAt = Date.now()
    await spawnDumpToFile(target.config, dumpPath, { signal: clientGone.signal })
    if (clientGone.signal.aborted) {
      // Client went away during the dump; the util already removed the dump file.
      console.log(`[Backup] Client disconnected during backup ${filename}; dump discarded`)
      return
    }
    const { size } = await stat(dumpPath)

    console.log(
      `[Backup] GM ${username} created backup ${filename} (${size} bytes gz, ${Date.now() - startedAt} ms)`
    )

    // Open the file, then delete it right away: the open fd keeps the data readable
    // and nothing is left behind in TMPDIR however the download ends.
    const stream = createReadStream(dumpPath)
    await once(stream, 'open')
    await rm(tempDir, { recursive: true, force: true })
    tempDir = null
    clientGone.signal.addEventListener('abort', () => stream.destroy())
    if (clientGone.signal.aborted) {
      stream.destroy()
      return
    }

    setResponseHeaders(event, {
      'Content-Type': 'application/gzip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': size.toString(),
      'Cache-Control': 'no-store',
    })

    return sendStream(event, stream)
  } catch (error) {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
    if (clientGone.signal.aborted) {
      // Nothing to answer: the client disconnected during the dump.
      return
    }

    if (error instanceof BackupRequestError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('[Backup] Error creating backup:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to create backup',
    })
  }
})
