/**
 * GET /api/stats/overview
 * Get server-wide statistics
 */
export default defineEventHandler(async (event) => {
  try {
    const { getAuthDbPool } = await import('#server/utils/mysql')
    const { getCharactersDbPool } = await import('#server/utils/mysql')

    const authPool = await getAuthDbPool()
    const charsPool = await getCharactersDbPool('blizzlike-db')

    // Get online players count
    const [onlineResult] = await authPool.query('SELECT COUNT(*) as count FROM account WHERE online = 1')
    const onlinePlayers = (onlineResult as any)[0].count

    // Get total accounts
    const [accountResult] = await authPool.query('SELECT COUNT(*) as count FROM account')
    const totalAccounts = (accountResult as any)[0].count

    // Get total characters across all realms
    const [charResult] = await charsPool.query('SELECT COUNT(*) as count FROM characters')
    const totalCharacters = (charResult as any)[0].count

    return {
      onlinePlayers,
      totalAccounts,
      totalCharacters,
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch statistics',
    })
  }
})
