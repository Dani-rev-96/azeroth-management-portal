/**
 * POST /api/admin/backup/portal-create
 * Download a consistent snapshot of a portal SQLite database.
 * The snapshot is taken with SQLite's online backup API (WAL-safe) into
 * `<db dir>/.backup-tmp/` (same volume, no /tmp needed) and streamed back.
 *
 * Body: { database: string }
 * GM / admin.backup only
 */
import { once } from 'node:events'
import { createReadStream, existsSync } from 'node:fs'
import { rm, stat } from 'node:fs/promises'
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getPortalDbPath, snapshotPortalDatabase } from '#server/utils/backup/portal-sqlite'

export default defineEventHandler(async (event) => {
  let snapshotPath: string | null = null
  // Attach before the snapshot starts: if the client disconnects mid-snapshot,
  // 'close' has already fired by the time it finishes and would be missed.
  // (better-sqlite3's backup API cannot be aborted mid-flight; we skip the
  // response and delete the snapshot instead.)
  const clientGone = new AbortController()
  event.node.res.once('close', () => clientGone.abort())

  try {
    const { username } = await getAuthenticatedFeatureUser(event, 'admin.backup')

    const body = await readBody(event)
    const { database } = (body ?? {}) as { database?: string }

    if (!database || typeof database !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Database key is required',
      })
    }

    const dbPath = getPortalDbPath(database)
    if (!dbPath) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown portal database: ${database}`,
      })
    }

    if (!existsSync(dbPath)) {
      throw createError({
        statusCode: 404,
        statusMessage: `Database file does not exist: ${database}`,
      })
    }

    snapshotPath = await snapshotPortalDatabase(dbPath, database)
    if (clientGone.signal.aborted) {
      console.log(`[Backup] Client disconnected during portal snapshot ${database}; snapshot discarded`)
      await rm(snapshotPath, { force: true }).catch(() => {})
      snapshotPath = null
      return
    }
    const { size } = await stat(snapshotPath)

    console.log(`[Backup] GM ${username} downloaded portal DB: ${database} (${size} bytes)`)

    const filename = `portal-${database}-${new Date().toISOString().replace(/[:.]/g, '-')}.db`

    // Open the snapshot, then delete it right away: the open fd keeps the data
    // readable and nothing is left in .backup-tmp however the download ends.
    const stream = createReadStream(snapshotPath)
    await once(stream, 'open')
    await rm(snapshotPath, { force: true })
    snapshotPath = null
    clientGone.signal.addEventListener('abort', () => stream.destroy())
    if (clientGone.signal.aborted) {
      stream.destroy()
      return
    }

    setResponseHeaders(event, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': size.toString(),
      'Cache-Control': 'no-store',
    })

    return sendStream(event, stream)
  } catch (error) {
    if (snapshotPath) {
      await rm(snapshotPath, { force: true }).catch(() => {})
    }
    if (clientGone.signal.aborted) {
      // Nothing to answer: the client disconnected during the snapshot.
      return
    }
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('[Backup] Error creating portal backup:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to create portal backup',
    })
  }
})
