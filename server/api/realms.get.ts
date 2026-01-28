/**
 * GET /api/realms
 * Get all available realms (public)
 */
import { getRealms } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  try {
    const realms = getRealms()

    // Return realm information (safe for client - only public info)
    return Object.values(realms).map((realm) => ({
      id: realm.id,
      name: realm.name,
      description: realm.description,
    }))
  } catch (error) {
    console.error('Error fetching realms:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch realms',
    })
  }
})
