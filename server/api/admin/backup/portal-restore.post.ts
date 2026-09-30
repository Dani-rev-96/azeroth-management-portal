/**
 * POST /api/admin/backup/portal-restore
 * Replace a portal SQLite database with an uploaded .db file.
 * Disabled unless BACKUP_RESTORE_ENABLED=true (403 otherwise).
 *
 * Query: ?database=<portal DB key> ('mappings' | 'user-settings' | 'portal-config')
 * multipart/form-data fields:
 *   database: optional, must match ?database= when present
 *   confirm:  must equal the database key
 *   file:     .db
 *
 * The upload is streamed into `<db dir>/.backup-tmp/` (same filesystem as the
 * target), validated (header, integrity_check, expected table), then swapped in
 * after closing the live connection. The previous file is kept as
 * `<name>.pre-restore-<ts>.db`. GM only.
 */
import { rm } from 'node:fs/promises'
import { getAuthenticatedGM } from '#server/utils/auth'
import { isRestoreEnabled, restoreUploadLimitBytes } from '#server/utils/backup/mysql-backup'
import { MultipartUploadError, receiveMultipartUpload } from '#server/utils/backup/multipart'
import {
  PortalRestoreValidationError,
  ensurePortalBackupTempDir,
  getPortalDatabaseDefinition,
  getPortalDbPath,
  swapPortalDatabaseFile,
  validatePortalSqliteFile,
} from '#server/utils/backup/portal-sqlite'
import { closeDatabase } from '#server/utils/db'
import { closeUserSettingsDatabase } from '#server/utils/user-settings'
import { closePortalConfigDatabase } from '#server/utils/portal-config-db'

/** Closes the live connection of each portal DB; the owning getter reopens lazily. */
const CLOSE_LIVE_DATABASE: Record<string, () => void> = {
  'mappings': closeDatabase,
  'user-settings': closeUserSettingsDatabase,
  'portal-config': closePortalConfigDatabase,
}

export default defineEventHandler(async (event) => {
  let uploadedPath: string | null = null

  try {
    const { username } = await getAuthenticatedGM(event)

    if (!isRestoreEnabled()) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Restore is disabled on this server (BACKUP_RESTORE_ENABLED)',
      })
    }

    // The target is taken from ?database= (before the body is parsed) so the upload
    // can be streamed straight into a temp dir next to that target (same filesystem).
    const query = getQuery(event)
    const database = typeof query.database === 'string' ? query.database : ''
    const definition = getPortalDatabaseDefinition(database)
    const targetPath = getPortalDbPath(database)
    const closeLiveDatabase = CLOSE_LIVE_DATABASE[database]
    if (!definition || !targetPath || !closeLiveDatabase) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown portal database: ${database || '(missing ?database=)'}`,
      })
    }

    const tempDir = await ensurePortalBackupTempDir(targetPath)
    const upload = await receiveMultipartUpload(event.node.req, getHeader(event, 'content-type'), {
      destDir: tempDir,
      allowedSuffixes: ['.db', '.sqlite', '.sqlite3'],
      maxFileBytes: restoreUploadLimitBytes('sqlite'),
    })
    uploadedPath = upload.file.path

    if (upload.fields.database !== undefined && upload.fields.database !== database) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Form field "database" does not match the ?database= query parameter',
      })
    }
    if (upload.fields.confirm !== database) {
      throw createError({
        statusCode: 400,
        statusMessage: `Confirmation mismatch: type "${database}" to confirm the restore`,
      })
    }
    if (upload.file.size === 0) {
      throw createError({ statusCode: 400, statusMessage: 'Uploaded file is empty' })
    }

    validatePortalSqliteFile(upload.file.path, definition.requiredTable)

    const { preRestorePath } = swapPortalDatabaseFile({
      targetPath,
      replacementPath: upload.file.path,
      closeLiveDatabase,
    })
    uploadedPath = null // moved into place

    console.log(
      `[Restore] GM ${username} restored portal DB ${database} from ${upload.file.originalName} (${upload.file.size} bytes); previous file kept at ${preRestorePath ?? '(none)'}`
    )

    return {
      success: true,
      message: `Successfully restored ${database} database (${upload.file.size} bytes)`,
      database,
      sizeBytes: upload.file.size,
      preRestorePath,
    }
  } catch (error) {
    if (error instanceof MultipartUploadError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    if (error instanceof PortalRestoreValidationError) {
      throw createError({ statusCode: 400, statusMessage: error.message })
    }
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('[Restore] Error restoring portal backup:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to restore portal backup',
    })
  } finally {
    if (uploadedPath) {
      await rm(uploadedPath, { force: true }).catch(() => {})
    }
  }
})
