/**
 * GET /api/admin/accounts
 * Get all accounts (GM only)
 */
export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    const { username } = await getAuthenticatedGM(event)

    // Get all accounts with GM status
    const { getAllAccountsWithGMStatus } = await import('#server/services/gm')
    const accounts = await getAllAccountsWithGMStatus()

    return accounts
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error fetching admin accounts:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch accounts',
    })
  }
})
