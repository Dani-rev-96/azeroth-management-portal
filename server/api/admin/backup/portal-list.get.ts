/**
 * GET /api/admin/backup/portal-list
 * List available portal SQLite databases with size info
 * GM only
 */
import { join } from 'path'
import { existsSync, statSync } from 'fs'
import { getAuthenticatedFeatureUser } from '#server/utils/auth'

interface PortalDbEntry {
  key: string
  name: string
  path: string
  sizeBytes: number
  exists: boolean
}

const PORTAL_DATABASES: Array<{ key: string; name: string; envVar: string; defaultFile: string }> = [
  {
    key: 'mappings',
    name: 'Account Mappings',
    envVar: 'DB_PATH',
    defaultFile: 'mappings.db',
  },
  {
    key: 'user-settings',
    name: 'User Settings & Feature Grants',
    envVar: 'USER_SETTINGS_DB_PATH',
    defaultFile: 'user-settings.db',
  },
  {
    key: 'portal-config',
    name: 'Portal Configuration',
    envVar: 'PORTAL_CONFIG_DB_PATH',
    defaultFile: 'portal-config.db',
  },
]

export function getPortalDbPath(key: string): string | null {
  const entry = PORTAL_DATABASES.find(db => db.key === key)
  if (!entry) return null
  return process.env[entry.envVar] || join(process.cwd(), 'data', entry.defaultFile)
}

export default defineEventHandler(async (event) => {
  try {
    await getAuthenticatedFeatureUser(event, 'admin.backup')

    const databases: PortalDbEntry[] = PORTAL_DATABASES.map((entry) => {
      const dbPath = process.env[entry.envVar] || join(process.cwd(), 'data', entry.defaultFile)
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

    return { databases }
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
