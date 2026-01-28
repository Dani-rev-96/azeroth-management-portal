/**
 * GET /api/stats/overview
 * Get server-wide statistics across all realms
 * Distinguishes between real players and bots (RNDBOT accounts)
 */
export default defineEventHandler(async (event) => {
  try {
    const { getAuthDbPool, getCharactersDbPool } = await import('#server/utils/mysql')

    const authPool = await getAuthDbPool()

    // Get real (non-bot) online players
    const [onlineRealResult] = await authPool.query(
      'SELECT COUNT(*) as count FROM account WHERE online = 1 AND username NOT LIKE "RNDBOT%"'
    )
    const onlineRealPlayers = (onlineRealResult as any)[0].count

    // Get bot online players
    const [onlineBotResult] = await authPool.query(
      'SELECT COUNT(*) as count FROM account WHERE online = 1 AND username LIKE "RNDBOT%"'
    )
    const onlineBots = (onlineBotResult as any)[0].count

    // Get total real accounts
    const [accountRealResult] = await authPool.query(
      'SELECT COUNT(*) as count FROM account WHERE username NOT LIKE "RNDBOT%"'
    )
    const totalRealAccounts = (accountRealResult as any)[0].count

    // Get total bot accounts
    const [accountBotResult] = await authPool.query(
      'SELECT COUNT(*) as count FROM account WHERE username LIKE "RNDBOT%"'
    )
    const totalBotAccounts = (accountBotResult as any)[0].count

    // Get real account IDs for character filtering
    const [realAccountIds] = await authPool.query(
      'SELECT id FROM account WHERE username NOT LIKE "RNDBOT%"'
    )
    const realAccountIdList = (realAccountIds as any[]).map(row => row.id)

    // Get total characters across all realms
    const realmDatabases = ["wotlk", "wotlk-ip", "wotlk-ip-boosted"]
    let totalRealCharacters = 0
    let totalBotCharacters = 0
    let totalGuilds = 0
    let maxLevelCharacters = 0
    let totalLevels = 0
    let characterCount = 0

    for (const realmDb of realmDatabases) {
      try {
        const charsPool = await getCharactersDbPool(realmDb)

        // Get real player characters
        if (realAccountIdList.length > 0) {
          const placeholders = realAccountIdList.map(() => '?').join(',')
          const [realCharsResult] = await charsPool.query(
            `SELECT COUNT(*) as count FROM characters WHERE account IN (${placeholders}) AND deleteDate IS NULL`,
            realAccountIdList
          )
          totalRealCharacters += (realCharsResult as any)[0].count

          // Get bot characters (those not in real account list)
          const [botCharsResult] = await charsPool.query(
            `SELECT COUNT(*) as count FROM characters WHERE account NOT IN (${placeholders}) AND deleteDate IS NULL`,
            realAccountIdList
          )
          totalBotCharacters += (botCharsResult as any)[0].count

          // Get max level characters (real players only)
          const [maxLevelResult] = await charsPool.query(
            `SELECT COUNT(*) as count FROM characters WHERE level = 80 AND account IN (${placeholders}) AND deleteDate IS NULL`,
            realAccountIdList
          )
          maxLevelCharacters += (maxLevelResult as any)[0].count

          // Get average level (real players only)
          const [avgLevelResult] = await charsPool.query(
            `SELECT SUM(level) as totalLevels, COUNT(*) as count FROM characters WHERE account IN (${placeholders}) AND deleteDate IS NULL`,
            realAccountIdList
          )
          const result = (avgLevelResult as any)[0]
          if (result.count && result.count > 0) {
            totalLevels += Number(result.totalLevels)
            characterCount += Number(result.count)
          }
        }

        // Get guild count
        const [guildResult] = await charsPool.query('SELECT COUNT(*) as count FROM guild')
        totalGuilds += (guildResult as any)[0].count

      } catch (error) {
        console.error(`Failed to query characters from ${realmDb}:`, error)
        // Continue to next realm if one fails
      }
    }

    // Calculate average level
    const averageLevel = characterCount > 0 ? Math.round(totalLevels / characterCount) : 0

    // Get realm status from realmlist
    const [realmlistResult] = await authPool.query(
      'SELECT COUNT(*) as count FROM realmlist WHERE flag NOT IN (1, 2)' // Not Invalid or Offline
    )
    const activeRealms = (realmlistResult as any)[0].count

    return {
      // Real player stats (primary focus)
      onlinePlayers: onlineRealPlayers,
      totalAccounts: totalRealAccounts,
      totalCharacters: totalRealCharacters,

      // Bot stats (for reference)
      onlineBots,
      totalBotAccounts,
      totalBotCharacters,

      // Additional server stats
      totalGuilds,
      activeRealms,
      maxLevelCharacters,
      averageLevel,
    }
  } catch (error) {
    console.error('Error fetching stats:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch statistics',
    })
  }
})
