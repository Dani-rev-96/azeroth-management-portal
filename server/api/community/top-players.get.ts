/**
 * GET /api/community/top-players
 * Get top players by various metrics
 * Query params: metric (level, playtime, achievements), limit (default 10), realmId (optional)
 */
export default defineEventHandler(async (event) => {
  try {
    const query = getQuery(event)
    const metric = (query.metric as string) || 'level'
    const limit = parseInt((query.limit as string) || '10')
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
      return []
    }

    const accountFilter = `account IN (${nonBotAccountIds.join(',')})`

    const topPlayers = []

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

      let sqlQuery = ''
      let orderBy = ''

      switch (metric) {
        case 'playtime':
          sqlQuery = `
            SELECT
              name,
              level,
              race,
              class,
              totaltime as playtime,
              account
            FROM characters
            WHERE ${accountFilter}
            ORDER BY totaltime DESC
            LIMIT ?
          `
          orderBy = 'playtime'
          break

        case 'achievements':
          sqlQuery = `
            SELECT
              c.name,
              c.level,
              c.race,
              c.class,
              c.totaltime as playtime,
              c.account,
              COUNT(ca.achievement) as achievement_count
            FROM characters c
            LEFT JOIN character_achievement ca ON c.guid = ca.guid
            WHERE ${accountFilter}
            GROUP BY c.guid
            ORDER BY achievement_count DESC
            LIMIT ?
          `
          orderBy = 'achievement_count'
          break

        case 'level':
        default:
          sqlQuery = `
            SELECT
              name,
              level,
              race,
              class,
              totaltime as playtime,
              account,
              totalKills
            FROM characters
            WHERE ${accountFilter}
            ORDER BY level DESC, totaltime DESC
            LIMIT ?
          `
          orderBy = 'level'
          break
      }

      const [results] = await charsPool.query(sqlQuery, [limit * 2]) // Get more to sort globally

      for (const char of results as any[]) {
        topPlayers.push({
          name: char.name,
          level: char.level,
          race: char.race,
          class: char.class,
          playtime: char.playtime,
          achievementCount: char.achievement_count || 0,
          totalKills: char.totalKills || 0,
          realm: realm.name,
          realmId: realmId,
        })
      }
    }

    // Sort globally and limit
    topPlayers.sort((a, b) => {
      switch (metric) {
        case 'playtime':
          return b.playtime - a.playtime
        case 'achievements':
          return b.achievementCount - a.achievementCount
        case 'level':
        default:
          if (b.level === a.level) {
            return b.playtime - a.playtime
          }
          return b.level - a.level
      }
    })

    return topPlayers.slice(0, limit)
  } catch (error) {
    console.error('Error fetching top players:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch top players',
    })
  }
})
