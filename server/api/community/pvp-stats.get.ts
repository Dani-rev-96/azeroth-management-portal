/**
 * GET /api/community/pvp-stats
 * Get PvP statistics from battlegrounds and arenas
 */
export default defineEventHandler(async (event) => {
  try {
    const { getCharactersDbPool } = await import('#server/utils/mysql')
    const serverConfig = await useServerConfig()

    let totalBattlegrounds = 0
    let totalArenaMatches = 0
    const topPvPPlayers = []

    // Aggregate from all realms
    for (const [realmId, realm] of Object.entries(serverConfig.realms)) {
      const charsPool = await getCharactersDbPool(realmId)

      // Count total battlegrounds
      const [bgResult] = await charsPool.query(
        'SELECT COUNT(*) as total FROM pvpstats_battlegrounds'
      )
      totalBattlegrounds += (bgResult as any[])[0].total

      // Count total arena matches
      const [arenaResult] = await charsPool.query(
        'SELECT COUNT(*) as total FROM log_arena_fights'
      )
      totalArenaMatches += (arenaResult as any[])[0].total || 0

      // Get top PvP players by honorable kills
      const [topPvPResult] = await charsPool.query(
        `SELECT
          name,
          level,
          race,
          class,
          totalHonorPoints as honorPoints,
          totalKills,
          arenaPoints
        FROM characters
        WHERE totalHonorPoints > 0
        ORDER BY totalHonorPoints DESC
        LIMIT 20`
      )

      for (const char of topPvPResult as any[]) {
        topPvPPlayers.push({
          name: char.name,
          level: char.level,
          race: char.race,
          class: char.class,
          honorPoints: char.honorPoints,
          totalKills: char.totalKills,
          arenaPoints: char.arenaPoints,
          realm: realm.name,
          realmId: realmId,
        })
      }
    }

    // Sort top PvP players globally
    topPvPPlayers.sort((a, b) => b.honorPoints - a.honorPoints)

    return {
      battlegrounds: {
        total: totalBattlegrounds,
      },
      arenas: {
        total: totalArenaMatches,
      },
      topPlayers: topPvPPlayers.slice(0, 10),
    }
  } catch (error) {
    console.error('Error fetching PvP statistics:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch PvP statistics',
    })
  }
})
