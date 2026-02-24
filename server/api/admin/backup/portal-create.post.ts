/**
 * POST /api/admin/backup/portal-create
 * Create a backup of a portal SQLite database
 * Returns the raw .db file as a download after performing a safe online backup
 *
 * Body: { database: string }
 * GM only
 */
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import Database from 'better-sqlite3'
import { join } from 'path'
import { tmpdir } from 'os'
import { unlink } from 'fs/promises'
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getPortalDbPath } from './portal-list.get'

export default defineEventHandler(async (event) => {
  let tempPath: string | null = null

  try {
    const { username } = await getAuthenticatedFeatureUser(event, 'admin.backup')

    const body = await readBody(event)
    const { database } = body as { database: string }

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

    // Use SQLite's built-in online backup API via better-sqlite3
    // This is safe even while the DB is being written to (WAL mode)
    const timestamp = Date.now()
    tempPath = join(tmpdir(), `portal-backup-${database}-${timestamp}.db`)

    const sourceDb = new Database(dbPath, { readonly: true })
    try {
      sourceDb.backup(tempPath)
    } finally {
      sourceDb.close()
    }

    const fileBuffer = await readFile(tempPath)

    console.log(
      `[Backup] GM ${username} downloaded portal DB: ${database} (${formatBytes(fileBuffer.length)})`
    )

    const filename = `portal-${database}-${new Date().toISOString().replace(/[:.]/g, '-')}.db`

    setResponseHeaders(event, {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': fileBuffer.length.toString(),
    })

    return fileBuffer
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('[Backup] Error creating portal backup:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to create portal backup',
    })
  } finally {
    // Clean up temp file
    if (tempPath) {
      try {
        await unlink(tempPath)
      } catch {
        // Ignore cleanup errors
      }
    }
  }
})

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
