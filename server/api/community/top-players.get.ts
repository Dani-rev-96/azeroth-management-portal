/**
 * GET /api/community/top-players
 * Get top players by various metrics
 * Query params: metric (level, playtime, achievements), limit (default 10), realmId, classId, raceId (all optional)
 */
import { getTopPlayers } from '#server/services/community'
import { handleApiError } from '#server/utils/api-errors'
import { getRealms } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const metric = (query.metric as 'level' | 'playtime' | 'achievements') || 'level'
    const limit = parseInt((query.limit as string) || '10')
    const realms = getRealms()

    const filters = {
      realmId: query.realmId as string | undefined,
      classId: query.classId ? parseInt(query.classId as string, 10) : undefined,
      raceId: query.raceId ? parseInt(query.raceId as string, 10) : undefined,
    }

    return await getTopPlayers(realms, metric, limit, filters)
  } catch (error) {
    return handleApiError(error, 'Failed to fetch top players')
  }
})
