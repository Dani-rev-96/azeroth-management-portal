/**
 * GET /api/community/zones
 * Get list of zones that players are currently in or have been in
 * Query params: search (optional) - filter zones by name
 */
import type { RowDataPacket } from 'mysql2/promise'
import { getCharactersDbPool } from '#server/utils/mysql'
import { getAreaNameBatch } from '#server/utils/dbc-db'
import { handleApiError } from '#server/utils/api-errors'
import { getRealms } from '#server/utils/config'
import { buildNonBotAccountFilter } from '#server/utils/account-filter'

export interface ZoneInfo {
  id: number
  name: string
  playerCount: number
}

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const search = (query.search as string | undefined)?.toLowerCase()
    const realms = getRealms()
    const accountFilter = await buildNonBotAccountFilter()

    // Collect zone IDs and counts from all realms
    const zoneCounts = new Map<number, number>()

    for (const realmId of Object.keys(realms)) {
      const charsPool = await getCharactersDbPool(realmId)
      const [rows] = await charsPool.query<RowDataPacket[]>(
        `SELECT zone, COUNT(*) as count
         FROM characters
         WHERE zone > 0 AND ${accountFilter}
         GROUP BY zone`
      )

      for (const row of rows) {
        const current = zoneCounts.get(row.zone) || 0
        zoneCounts.set(row.zone, current + row.count)
      }
    }

    // Get zone names
    const zoneIds = [...zoneCounts.keys()]
    const zoneNames = await getAreaNameBatch(zoneIds)

    // Build zone list with names and counts
    let zones: ZoneInfo[] = []
    for (const [zoneId, count] of zoneCounts) {
      const name = zoneNames.get(zoneId) || `Zone ${zoneId}`
      zones.push({
        id: zoneId,
        name,
        playerCount: count
      })
    }

    // Filter by search if provided
    if (search) {
      zones = zones.filter(z => z.name.toLowerCase().includes(search))
    }

    // Sort by player count (most popular first)
    zones.sort((a, b) => b.playerCount - a.playerCount)

    return zones
  } catch (error) {
    return handleApiError(error, 'Failed to fetch zones')
  }
})
