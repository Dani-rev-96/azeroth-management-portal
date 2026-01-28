/**
 * GET /api/community/online
 * Get list of online characters with their details
 */
import { getOnlinePlayers } from '#server/services/community'
import { handleApiError } from '#server/utils/api-errors'
import { getRealms } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const realmIdFilter = query.realmId as string | undefined
    const realms = getRealms()

    return await getOnlinePlayers(realms, realmIdFilter)
  } catch (error) {
    return handleApiError(error, 'Failed to fetch online players')
  }
})
