/**
 * GET /api/community/stats
 * Get general player statistics across all realms
 * Query params: realmId (optional) - filter by specific realm
 */
import { getGeneralStats } from '#server/services/community'
import { handleApiError } from '#server/utils/api-errors'
import { getRealms } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const realmIdFilter = query.realmId as string | undefined
    const realms = getRealms()

    return await getGeneralStats(realms, realmIdFilter)
  } catch (error) {
    return handleApiError(error, 'Failed to fetch player statistics')
  }
})
