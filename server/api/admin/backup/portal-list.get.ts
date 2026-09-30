/**
 * GET /api/admin/backup/portal-list
 * List available portal SQLite databases with size info, plus whether restore is enabled
 * GM only
 */
import { existsSync, statSync } from 'fs'
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { isRestoreEnabled } from '#server/utils/backup/mysql-backup'
import { PORTAL_DATABASES, getPortalDbPath } from '#server/utils/backup/portal-sqlite'

interface PortalDbEntry {
  key: string
  name: string
  path: string
  sizeBytes: number
  exists: boolean
}

export default defineEventHandler(async (event) => {
  try {
    await getAuthenticatedFeatureUser(event, 'admin.backup')

    const databases: PortalDbEntry[] = PORTAL_DATABASES.map((entry) => {
      const dbPath = getPortalDbPath(entry.key)!
      let sizeBytes = 0
      let exists = false

      try {
        if (existsSync(dbPath)) {
          exists = true
          const stat = statSync(dbPath)
          sizeBytes = stat.size

          // Also count WAL and SHM files
          const walPath = dbPath + '-wal'
          const shmPath = dbPath + '-shm'
          if (existsSync(walPath)) sizeBytes += statSync(walPath).size
          if (existsSync(shmPath)) sizeBytes += statSync(shmPath).size
        }
      } catch {
        // File doesn't exist or isn't accessible
      }

      return {
        key: entry.key,
        name: entry.name,
        path: dbPath,
        sizeBytes,
        exists,
      }
    })

    return { databases, restoreEnabled: isRestoreEnabled() }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('[Backup] Error listing portal databases:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to list portal databases',
    })
  }
})
