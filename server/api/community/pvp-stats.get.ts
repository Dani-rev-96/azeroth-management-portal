/**
 * GET /api/community/pvp-stats
 * Get PvP statistics from battlegrounds and arenas
 * Query params: realmId (optional) - filter by specific realm
 */
import { getPvPStats } from '#server/services/community'
import { handleApiError } from '#server/utils/api-errors'
import { getRealms } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const realmIdFilter = query.realmId as string | undefined
    const realms = getRealms()

    return await getPvPStats(realms, realmIdFilter)
  } catch (error) {
    return handleApiError(error, 'Failed to fetch PvP statistics')
  }
})
