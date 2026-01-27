/**
 * GET /api/stats/overview
 * Get server-wide statistics across all realms
 */
export default defineEventHandler(async (event) => {
  try {
    const { getAuthDbPool, getCharactersDbPool } = await import('#server/utils/mysql')

    const authPool = await getAuthDbPool()

    // Get online players count
    const [onlineResult] = await authPool.query('SELECT COUNT(*) as count FROM account WHERE online = 1')
    const onlinePlayers = (onlineResult as any)[0].count

    // Get total accounts
    const [accountResult] = await authPool.query('SELECT COUNT(*) as count FROM account')
    const totalAccounts = (accountResult as any)[0].count

    // Get total characters across all realms
    // Query each realm's character database and sum them up
    const realmDatabases = ["wotlk", "wotlk-ip", "wotlk-ip-boosted"]
    let totalCharacters = 0

    for (const realmDb of realmDatabases) {
      try {
        const charsPool = await getCharactersDbPool(realmDb)
        const [charResult] = await charsPool.query('SELECT COUNT(*) as count FROM characters')
        totalCharacters += (charResult as any)[0].count
      } catch (error) {
        console.error(`Failed to query characters from ${realmDb}:`, error)
        // Continue to next realm if one fails
      }
    }

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
