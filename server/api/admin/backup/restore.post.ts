/**
 * POST /api/admin/backup/restore
 * Restore ONE MySQL database from an uploaded .sql or .sql.gz file.
 * Disabled unless BACKUP_RESTORE_ENABLED=true (403 otherwise).
 *
 * multipart/form-data fields:
 *   database: 'auth' | 'characters'
 *   realmId:  required for characters
 *   confirm:  must equal the full target, e.g. 'acore_auth' or
 *             'acore_characters@realm1' (the realm is part of the confirmation)
 *   file:     .sql or .sql.gz
 *
 * The upload is streamed to a temp file and from there into `mysql` stdin
 * (never held in memory). GM only.
 */
import { rm } from 'node:fs/promises'
import { getAuthenticatedGM } from '#server/utils/auth'
import { getAuthDbConfig, getRealmConfig } from '#server/utils/config'
import {
  createBackupTempDir,
  isRestoreEnabled,
  restoreUploadLimitBytes,
  spawnRestoreFromFile,
} from '#server/utils/backup/mysql-backup'
import {
  BackupRequestError,
  parseBackupTargetRequest,
  resolveBackupTarget,
} from '#server/utils/backup/mysql-target'
import { MultipartUploadError, receiveMultipartUpload } from '#server/utils/backup/multipart'

export default defineEventHandler(async (event) => {
  let tempDir: string | null = null

  try {
    const { username } = await getAuthenticatedGM(event)

    if (!isRestoreEnabled()) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Restore is disabled on this server (BACKUP_RESTORE_ENABLED)',
      })
    }

    tempDir = await createBackupTempDir('amp-restore-')
    const upload = await receiveMultipartUpload(event.node.req, getHeader(event, 'content-type'), {
      destDir: tempDir,
      allowedSuffixes: ['.sql', '.sql.gz'],
      maxFileBytes: restoreUploadLimitBytes('mysql'),
    })

    const target = resolveBackupTarget(
      parseBackupTargetRequest({ database: upload.fields.database, realmId: upload.fields.realmId }),
      { getAuthDbConfig, getRealmConfig }
    )

    // The realm is part of the confirmation: picking the wrong realm is the main
    // risk of a characters restore, so a bare database name is not enough.
    const expectedConfirm = target.realmId
      ? `${target.config.database}@realm${target.realmId}`
      : target.config.database
    if (upload.fields.confirm !== expectedConfirm) {
      throw createError({
        statusCode: 400,
        statusMessage: `Confirmation mismatch: type "${expectedConfirm}" to confirm the restore`,
      })
    }

    const where = `${target.config.database}${target.realmId ? ` (realm ${target.realmId})` : ''}`
    console.log(`[Restore] GM ${username} starting restore of ${upload.file.originalName} (${upload.file.size} bytes) to ${where}`)
    const startedAt = Date.now()

    await spawnRestoreFromFile(target.config, upload.file.path)

    console.log(`[Restore] GM ${username} completed restore to ${where} in ${Date.now() - startedAt} ms`)

    return {
      success: true,
      message: `Successfully restored ${where} from ${upload.file.originalName}`,
      database: target.config.database,
      realmId: target.realmId,
      sizeBytes: upload.file.size,
    }
  } catch (error) {
    if (error instanceof BackupRequestError || error instanceof MultipartUploadError) {
      throw createError({ statusCode: error.statusCode, statusMessage: error.message })
    }
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('[Restore] Error restoring backup:', error)
    throw createError({
      statusCode: 500,
      statusMessage: error instanceof Error ? error.message : 'Failed to restore backup',
    })
  } finally {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true }).catch(() => {})
    }
  }
})
