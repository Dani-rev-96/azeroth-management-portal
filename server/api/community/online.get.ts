/**
 * GET /api/community/online
 * Get list of online characters with their details
 * Query params: realmId (optional), search (optional), page (default 1), limit (default 50)
 */
import { getOnlinePlayers } from '#server/services/community'
import { handleApiError } from '#server/utils/api-errors'
import { getRealms } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const realmIdFilter = query.realmId as string | undefined
    const search = query.search as string | undefined
    const page = parseInt((query.page as string) || '1')
    const limit = parseInt((query.limit as string) || '50')
    const realms = getRealms()

    return await getOnlinePlayers(realms, { realmId: realmIdFilter, search, page, limit })
  } catch (error) {
    return handleApiError(error, 'Failed to fetch online players')
  }
})
