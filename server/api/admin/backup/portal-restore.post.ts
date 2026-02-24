/**
 * POST /api/admin/backup/portal-restore
 * Restore a portal SQLite database from an uploaded .db file
 * Validates the file is a valid SQLite database before overwriting
 *
 * Body: { database: string, data: string (base64) }
 * GM only
 */
import { existsSync, mkdirSync } from 'fs'
import { writeFile, rename, unlink } from 'fs/promises'
import { dirname, join } from 'path'
import { tmpdir } from 'os'
import Database from 'better-sqlite3'
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getPortalDbPath } from './portal-list.get'

export default defineEventHandler(async (event) => {
  let tempPath: string | null = null

  try {
    const { username } = await getAuthenticatedFeatureUser(event, 'admin.backup')

    const body = await readBody(event)
    const { database, data } = body as { database: string; data: string }

    if (!database || typeof database !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Database key is required',
      })
    }

    if (!data || typeof data !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Base64-encoded database file is required',
      })
    }

    const dbPath = getPortalDbPath(database)
    if (!dbPath) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown portal database: ${database}`,
      })
    }

    // Decode base64 to buffer
    const buffer = Buffer.from(data, 'base64')

    if (buffer.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Uploaded file is empty',
      })
    }

    // Validate it's actually a SQLite database by checking the header magic
    const SQLITE_MAGIC = 'SQLite format 3\0'
    const header = buffer.subarray(0, 16).toString('ascii')
    if (header !== SQLITE_MAGIC) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Uploaded file is not a valid SQLite database',
      })
    }

    // Write to temp file first and validate by opening it
    const timestamp = Date.now()
    tempPath = join(tmpdir(), `portal-restore-${database}-${timestamp}.db`)
    await writeFile(tempPath, buffer)

    // Try to open and run integrity check
    try {
      const testDb = new Database(tempPath, { readonly: true })
      try {
        const result = testDb.pragma('integrity_check') as Array<{ integrity_check: string }>
        if (result[0]?.integrity_check !== 'ok') {
          throw new Error('Database integrity check failed')
        }
      } finally {
        testDb.close()
      }
    } catch (error: any) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid SQLite database: ${error.message}`,
      })
    }

    // Ensure target directory exists
    const targetDir = dirname(dbPath)
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }

    // Remove old WAL/SHM files if they exist (they won't be valid after replacement)
    try {
      if (existsSync(dbPath + '-wal')) await unlink(dbPath + '-wal')
      if (existsSync(dbPath + '-shm')) await unlink(dbPath + '-shm')
    } catch {
      // Ignore cleanup errors
    }

    // Atomically replace the database file
    await rename(tempPath, dbPath)
    tempPath = null // Prevent cleanup since we've moved it

    const sizeStr = formatBytes(buffer.length)
    console.log(`[Restore] GM ${username} restored portal DB: ${database} (${sizeStr})`)

    return {
      success: true,
      message: `Successfully restored ${database} database (${sizeStr})`,
      database,
      sizeBytes: buffer.length,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('[Restore] Error restoring portal backup:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to restore portal backup',
    })
  } finally {
    // Clean up temp file if it still exists
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
