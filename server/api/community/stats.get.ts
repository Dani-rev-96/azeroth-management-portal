/**
 * GET /api/community/stats
 * Get general player statistics across all realms
 */
export default defineEventHandler(async (event) => {
  try {
    const { getAuthDbPool, getCharactersDbPool } = await import('#server/utils/mysql')
    const serverConfig = await useServerConfig()

    const authPool = await getAuthDbPool()

    // Get total accounts
    const [accountsResult] = await authPool.query(
      'SELECT COUNT(*) as total FROM account'
    )
    const totalAccounts = (accountsResult as any[])[0].total

    // Get online accounts
    const [onlineResult] = await authPool.query(
      'SELECT COUNT(*) as total FROM account WHERE online = 1 and username not like "RNDBOT%"'
    )
    const onlineAccounts = (onlineResult as any[])[0].total

    // Initialize stats
    let totalCharacters = 0
    let totalPlaytimeSeconds = 0
    let maxLevelCharacters = 0
    let factionStats = { alliance: 0, horde: 0 }
    let classDistribution: Record<number, number> = {}
    let raceDistribution: Record<number, number> = {}

    // Aggregate stats from all realms
    for (const [realmId] of Object.entries(serverConfig.realms)) {
      const charsPool = await getCharactersDbPool(realmId)

      // Total characters
      const [charCountResult] = await charsPool.query(
        'SELECT COUNT(*) as total FROM characters'
      )
      totalCharacters += (charCountResult as any[])[0].total

      // Total playtime
      const [playtimeResult] = await charsPool.query(
        'SELECT SUM(totaltime) as total FROM characters'
      )
      totalPlaytimeSeconds += (playtimeResult as any[])[0].total || 0

      // Max level characters (80 for WotLK)
      const [maxLevelResult] = await charsPool.query(
        'SELECT COUNT(*) as total FROM characters WHERE level = 80'
      )
      maxLevelCharacters += (maxLevelResult as any[])[0].total

      // Faction distribution (Alliance: races 1,3,4,7,11 | Horde: races 2,5,6,8,10)
      const [factionResult] = await charsPool.query(
        `SELECT
          CASE
            WHEN race IN (1,3,4,7,11) THEN 'alliance'
            WHEN race IN (2,5,6,8,10) THEN 'horde'
          END as faction,
          COUNT(*) as count
         FROM characters
         GROUP BY faction`
      )
      for (const row of factionResult as any[]) {
        if (row.faction === 'alliance') {
          factionStats.alliance += row.count
        } else if (row.faction === 'horde') {
          factionStats.horde += row.count
        }
      }

      // Class distribution
      const [classResult] = await charsPool.query(
        'SELECT class, COUNT(*) as count FROM characters GROUP BY class'
      )
      for (const row of classResult as any[]) {
        classDistribution[row.class] = (classDistribution[row.class] || 0) + row.count
      }

      // Race distribution
      const [raceResult] = await charsPool.query(
        'SELECT race, COUNT(*) as count FROM characters GROUP BY race'
      )
      for (const row of raceResult as any[]) {
        raceDistribution[row.race] = (raceDistribution[row.race] || 0) + row.count
      }
    }

    return {
      accounts: {
        total: totalAccounts,
        online: onlineAccounts,
      },
      characters: {
        total: totalCharacters,
        maxLevel: maxLevelCharacters,
      },
      playtime: {
        totalSeconds: totalPlaytimeSeconds,
        totalHours: Math.floor(totalPlaytimeSeconds / 3600),
        totalDays: Math.floor(totalPlaytimeSeconds / 86400),
      },
      factions: factionStats,
      classDistribution,
      raceDistribution,
    }
  } catch (error) {
    console.error('Error fetching player statistics:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch player statistics',
    })
  }
})
