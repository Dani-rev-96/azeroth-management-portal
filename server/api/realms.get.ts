/**
 * GET /api/realms
 * Get all available realms (public)
 */
export default defineEventHandler(async (event) => {
  try {
    const { realms } = await useServerConfig()

    // Return realm information (safe for client)
    return realms
  } catch (error) {
    console.error('Error fetching realms:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch realms',
    })
  }
})
