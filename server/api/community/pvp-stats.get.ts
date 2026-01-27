/**
 * GET /api/community/pvp-stats
 * Get PvP statistics from battlegrounds and arenas
 * Query params: realmId (optional) - filter by specific realm
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const realmIdFilter = query.realmId as string | undefined

    const { getAuthDbPool, getCharactersDbPool } = await import('#server/utils/mysql')
    const serverConfig = await useServerConfig()

    // Get non-bot account IDs
    const authPool = await getAuthDbPool()
    const [accountsResult] = await authPool.query(
      'SELECT id FROM account WHERE username NOT LIKE "RNDBOT%"'
    )
    const nonBotAccountIds = (accountsResult as any[]).map(row => row.id)

    if (nonBotAccountIds.length === 0) {
      return {
        battlegrounds: { total: 0 },
        arenas: { total: 0 },
        topPlayers: [],
      }
    }

    const accountFilter = `account IN (${nonBotAccountIds.join(',')})`

    let totalBattlegrounds = 0
    let totalArenaMatches = 0
    const topPvPPlayers = []

    // Determine which realms to query
    const realmsToQuery = realmIdFilter
      ? { [realmIdFilter]: serverConfig.realms[realmIdFilter as keyof typeof serverConfig.realms] }
      : serverConfig.realms

    if (realmIdFilter && !(realmIdFilter in serverConfig.realms)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid realm ID: ${realmIdFilter}`,
      })
    }

    // Aggregate from selected realms
    for (const [realmId, realm] of Object.entries(realmsToQuery)) {
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

      // Get top PvP players by honorable kills (non-bot)
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
        WHERE totalHonorPoints > 0 AND ${accountFilter}
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
