/**
 * GET /api/admin/backup/list
 * List available databases and realms for backup/restore
 * GM only
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getRealms, getAuthDbConfig } from '#server/utils/config'
import { getAuthDbPool, getCharactersDbPool } from '#server/utils/mysql'

export default defineEventHandler(async (event) => {
  try {
    await getAuthenticatedFeatureUser(event, 'admin.backup')

    const realms = getRealms()
    const authConfig = getAuthDbConfig()

    // Get database sizes for display
    const databases: Array<{
      type: 'auth' | 'characters'
      name: string
      realmId?: string
      realmName?: string
      host: string
      sizeBytes?: number
    }> = []

    // Auth database info
    try {
      const authPool = await getAuthDbPool()
      const [rows] = await authPool.query(`
        SELECT SUM(data_length + index_length) as size_bytes
        FROM information_schema.tables
        WHERE table_schema = ?
      `, [authConfig.database])
      const sizeBytes = (rows as any[])[0]?.size_bytes || 0

      databases.push({
        type: 'auth',
        name: authConfig.database,
        host: authConfig.host,
        sizeBytes: Number(sizeBytes),
      })
    } catch {
      databases.push({
        type: 'auth',
        name: authConfig.database,
        host: authConfig.host,
      })
    }

    // Characters databases per realm
    for (const [realmId, realm] of Object.entries(realms)) {
      try {
        const charPool = await getCharactersDbPool(realmId)
        const [rows] = await charPool.query(`
          SELECT SUM(data_length + index_length) as size_bytes
          FROM information_schema.tables
          WHERE table_schema = 'acore_characters'
        `)
        const sizeBytes = (rows as any[])[0]?.size_bytes || 0

        databases.push({
          type: 'characters',
          name: 'acore_characters',
          realmId,
          realmName: realm.name,
          host: realm.dbHost,
          sizeBytes: Number(sizeBytes),
        })
      } catch {
        databases.push({
          type: 'characters',
          name: 'acore_characters',
          realmId,
          realmName: realm.name,
          host: realm.dbHost,
        })
      }
    }

    return { databases }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('[Backup] Error listing databases:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to list databases',
    })
  }
})
