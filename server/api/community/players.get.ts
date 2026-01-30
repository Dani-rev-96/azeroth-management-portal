/**
 * GET /api/community/players
 * Search and browse all players with pagination
 * Query params: search, page, limit, realmId, classId, raceId (all optional)
 */
import { searchAllPlayers } from '#server/services/community'
import { handleApiError } from '#server/utils/api-errors'
import { getRealms } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const realms = getRealms()

    const options = {
      search: query.search as string | undefined,
      page: parseInt((query.page as string) || '1'),
      limit: parseInt((query.limit as string) || '24'),
      realmId: query.realmId as string | undefined,
      classId: query.classId ? parseInt(query.classId as string, 10) : undefined,
      raceId: query.raceId ? parseInt(query.raceId as string, 10) : undefined,
    }

    return await searchAllPlayers(realms, options)
  } catch (error) {
    return handleApiError(error, 'Failed to search players')
  }
})
