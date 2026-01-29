/**
 * GET /api/community/stats
 * Get general player statistics across all realms
 * Query params: realmId (optional), classId (optional), raceId (optional)
 */
import { getGeneralStats } from '#server/services/community'
import { handleApiError } from '#server/utils/api-errors'
import { getRealms } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const realms = getRealms()

    const filters = {
      realmId: query.realmId as string | undefined,
      classId: query.classId ? parseInt(query.classId as string, 10) : undefined,
      raceId: query.raceId ? parseInt(query.raceId as string, 10) : undefined,
    }

    return await getGeneralStats(realms, filters)
  } catch (error) {
    return handleApiError(error, 'Failed to fetch player statistics')
  }
})
