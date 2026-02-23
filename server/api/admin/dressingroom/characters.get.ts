/**
 * GET /api/admin/dressingroom/characters
 * Search characters across all realms for the dressing room
 * GM only
 *
 * Query: { search?: string, realmId?: string }
 */
import { getAuthenticatedGM } from '#server/utils/auth'
import { getRealms } from '#server/utils/config'
import { getCharactersDbPool } from '#server/utils/mysql'

export default defineEventHandler(async (event) => {
  try {
    await getAuthenticatedGM(event)

    const query = getQuery(event)
    const search = (query.search as string || '').trim()
    const realmId = query.realmId as string | undefined

    const realms = getRealms()
    const targetRealms = realmId
      ? { [realmId]: realms[realmId] }
      : realms

    if (realmId && !realms[realmId]) {
      throw createError({
        statusCode: 404,
        statusMessage: `Realm ${realmId} not found`,
      })
    }

    const characters: Array<{
      guid: number
      name: string
      race: number
      class: number
      gender: number
      level: number
      money: number
      online: boolean
      account: number
      realmId: string
      realmName: string
    }> = []

    for (const [rId, realm] of Object.entries(targetRealms)) {
      if (!realm) continue
      try {
        const pool = await getCharactersDbPool(rId)

        let sql = `
          SELECT guid, name, race, class, gender, level, money, online, account
          FROM characters
          WHERE deleteDate IS NULL
        `
        const params: any[] = []

        if (search) {
          sql += ` AND (name LIKE ? OR guid = ?)`
          params.push(`%${search}%`, parseInt(search) || 0)
        }

        sql += ` ORDER BY level DESC, name ASC LIMIT 50`

        const [rows] = await pool.query(sql, params)
        for (const row of rows as any[]) {
          characters.push({
            guid: row.guid,
            name: row.name,
            race: row.race,
            class: row.class,
            gender: row.gender,
            level: row.level,
            money: Number(row.money),
            online: row.online === 1,
            account: row.account,
            realmId: rId,
            realmName: realm.name,
          })
        }
      } catch (error) {
        console.error(`[DressingRoom] Error searching characters on realm ${rId}:`, error)
      }
    }

    return { characters }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('[DressingRoom] Error searching characters:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to search characters',
    })
  }
})
