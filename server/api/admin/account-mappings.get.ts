/**
 * GET /api/admin/account-mappings
 * Get all account mappings (GM only)
 */
export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    await getAuthenticatedGM(event)

    // Get all mappings
    const { AccountMappingDB } = await import('#server/utils/db')
    const mappings = AccountMappingDB.findAll()

    return mappings
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error fetching admin mappings:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch mappings',
    })
  }
})
