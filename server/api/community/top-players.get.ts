/**
 * GET /api/community/top-players
 * Get top players by various metrics
 * Query params: metric (level, playtime, achievements), limit (default 10), realmId (optional)
 */
import { getTopPlayers } from '#server/services/community'
import { handleApiError } from '#server/utils/api-errors'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const metric = (query.metric as 'level' | 'playtime' | 'achievements') || 'level'
    const limit = parseInt((query.limit as string) || '10')
    const realmIdFilter = query.realmId as string | undefined
    const serverConfig = await useServerConfig()

    return await getTopPlayers(serverConfig.realms, metric, limit, realmIdFilter)
  } catch (error) {
    return handleApiError(error, 'Failed to fetch top players')
  }
})
