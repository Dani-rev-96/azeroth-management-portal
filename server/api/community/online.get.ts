/**
 * GET /api/community/online
 * Get list of online characters with their details
 */
export default defineEventHandler(async (event) => {
  try {
    const { getAuthDbPool, getCharactersDbPool } = await import('#server/utils/mysql')
    const serverConfig = await useServerConfig()

    const authPool = await getAuthDbPool()

    // Get all online accounts
    const [onlineAccounts] = await authPool.query(
      'SELECT id, username, online FROM account WHERE online = 1 and username not like "RNDBOT%"'
    )
    const accounts = onlineAccounts as any[]

    if (accounts.length === 0) {
      return []
    }

    const onlinePlayers = []

    // For each realm, check for characters from these accounts
    for (const [realmId, realm] of Object.entries(serverConfig.realms)) {
      const charsPool = await getCharactersDbPool(realmId)

      for (const account of accounts) {
        const [chars] = await charsPool.query(
          `SELECT
            guid,
            name,
            level,
            race,
            class,
            zone,
            online,
            totaltime,
            account as accountId
           FROM characters
           WHERE account = ? AND online = 1
           LIMIT 10`,
          [account.id]
        )

        const characters = chars as any[]

        for (const char of characters) {
          onlinePlayers.push({
            guid: char.guid,
            characterName: char.name,
            level: char.level,
            race: char.race,
            class: char.class,
            zone: char.zone,
            accountName: account.username,
            realm: realm.name,
            realmId: realmId,
            playtime: char.totaltime,
          })
        }
      }
    }

    return onlinePlayers
  } catch (error) {
    console.error('Error fetching online players:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch online players',
    })
  }
})
