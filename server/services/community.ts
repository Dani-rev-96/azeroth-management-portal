/**
 * Community Statistics Service
 * Centralized service for community-related queries
 */

import type { RowDataPacket, Pool } from 'mysql2/promise'
import { getAuthDbPool, getCharactersDbPool } from '#server/utils/mysql'
import { getNonBotAccountIds, buildNonBotAccountFilter } from '#server/utils/account-filter'
import { getRealmsToQuery } from '#server/utils/realm-query'
import { getAreaNameBatch } from '#server/utils/dbc-db'

// Types
export interface OnlinePlayer {
  guid: number
  characterName: string
  level: number
  race: number
  class: number
  zone: number
  zoneName: string
  accountName: string
  realm: string
  realmId: string
  playtime: number
}

export interface GeneralStats {
  accounts: { total: number; online: number }
  characters: { total: number; maxLevel: number }
  playtime: { totalSeconds: number; totalHours: number; totalDays: number }
  factions: { alliance: number; horde: number }
  classDistribution: Record<number, number>
  raceDistribution: Record<number, number>
}

export interface TopPlayer {
  guid: number
  name: string
  level: number
  race: number
  class: number
  playtime: number
  achievementCount: number
  totalKills: number
  realm: string
  realmId: string
}

export interface PvPStats {
  battlegrounds: { total: number }
  arenas: { total: number }
  topPlayers: Array<{
    guid?: number
    name: string
    level: number
    race: number
    class: number
    honorPoints: number
    totalKills: number
    arenaPoints: number
    realm: string
    realmId: string
  }>
}

/**
 * Filter options for community queries
 */
export interface CommunityFilters {
  realmId?: string
  classId?: number
  raceId?: number
}

/**
 * Get list of online players across realms
 */
export async function getOnlinePlayers(
  realms: Record<string, any>,
  realmIdFilter?: string
): Promise<OnlinePlayer[]> {
  const authPool = await getAuthDbPool()

  // Get online non-bot accounts
  const [onlineAccounts] = await authPool.query<RowDataPacket[]>(
    'SELECT id, username, online FROM account WHERE online = 1 AND username NOT LIKE "RNDBOT%"'
  )

  if (onlineAccounts.length === 0) {
    return []
  }

  const realmsToQuery = getRealmsToQuery(realms, realmIdFilter)
  const onlinePlayers: Array<Omit<OnlinePlayer, 'zoneName'> & { zone: number }> = []

  for (const [realmId, realm] of Object.entries(realmsToQuery)) {
    const charsPool = await getCharactersDbPool(realmId)

    for (const account of onlineAccounts) {
      const [chars] = await charsPool.query<RowDataPacket[]>(
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

      for (const char of chars) {
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

  // Resolve zone names
  const zoneIds = [...new Set(onlinePlayers.map(p => p.zone).filter(z => z > 0))]
  const zoneNames = await getAreaNameBatch(zoneIds)

  return onlinePlayers.map(player => ({
    ...player,
    zoneName: zoneNames.get(player.zone) || `Zone ${player.zone}`,
  }))
}

/**
 * Get general statistics across realms
 */
export async function getGeneralStats(
  realms: Record<string, any>,
  filters: CommunityFilters = {}
): Promise<GeneralStats> {
  const nonBotAccountIds = await getNonBotAccountIds()
  const accountFilter = await buildNonBotAccountFilter()
  const realmsToQuery = getRealmsToQuery(realms, filters.realmId)

  // Build additional filters for class/race
  const additionalFilters: string[] = []
  if (filters.classId) additionalFilters.push(`class = ${filters.classId}`)
  if (filters.raceId) additionalFilters.push(`race = ${filters.raceId}`)
  const extraFilter = additionalFilters.length > 0 ? ` AND ${additionalFilters.join(' AND ')}` : ''

  // Get auth-level stats
  const authPool = await getAuthDbPool()
  const [onlineResult] = await authPool.query<RowDataPacket[]>(
    'SELECT COUNT(*) as total FROM account WHERE online = 1 AND username NOT LIKE "RNDBOT%"'
  )

  const stats: GeneralStats = {
    accounts: {
      total: nonBotAccountIds.length,
      online: onlineResult[0]?.total ?? 0,
    },
    characters: { total: 0, maxLevel: 0 },
    playtime: { totalSeconds: 0, totalHours: 0, totalDays: 0 },
    factions: { alliance: 0, horde: 0 },
    classDistribution: {},
    raceDistribution: {},
  }

  // Aggregate from each realm
  for (const [realmId] of Object.entries(realmsToQuery)) {
    const charsPool = await getCharactersDbPool(realmId)

    // Total characters (with optional class/race filter)
    const [charCount] = await charsPool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM characters WHERE ${accountFilter}${extraFilter}`
    )
    stats.characters.total += charCount[0]?.total ?? 0

    // Total playtime
    const [playtime] = await charsPool.query<RowDataPacket[]>(
      `SELECT SUM(totaltime) as total FROM characters WHERE ${accountFilter}${extraFilter}`
    )
    stats.playtime.totalSeconds += Number(playtime[0]?.total ?? 0)

    // Max level characters
    const [maxLevel] = await charsPool.query<RowDataPacket[]>(
      `SELECT COUNT(*) as total FROM characters WHERE level = 80 AND ${accountFilter}${extraFilter}`
    )
    stats.characters.maxLevel += maxLevel[0]?.total ?? 0

    // Faction distribution
    const [factions] = await charsPool.query<RowDataPacket[]>(
      `SELECT
        CASE
          WHEN race IN (1,3,4,7,11) THEN 'alliance'
          WHEN race IN (2,5,6,8,10) THEN 'horde'
        END as faction,
        COUNT(*) as count
       FROM characters
       WHERE ${accountFilter}${extraFilter}
       GROUP BY faction`
    )
    for (const row of factions) {
      if (row.faction === 'alliance') stats.factions.alliance += row.count
      else if (row.faction === 'horde') stats.factions.horde += row.count
    }

    // Class distribution (apply only race filter, not class filter)
    const classExtraFilter = filters.raceId ? ` AND race = ${filters.raceId}` : ''
    const [classes] = await charsPool.query<RowDataPacket[]>(
      `SELECT class, COUNT(*) as count FROM characters WHERE ${accountFilter}${classExtraFilter} GROUP BY class`
    )
    for (const row of classes) {
      stats.classDistribution[row.class] = (stats.classDistribution[row.class] || 0) + row.count
    }

    // Race distribution (apply only class filter, not race filter)
    const raceExtraFilter = filters.classId ? ` AND class = ${filters.classId}` : ''
    const [races] = await charsPool.query<RowDataPacket[]>(
      `SELECT race, COUNT(*) as count FROM characters WHERE ${accountFilter}${raceExtraFilter} GROUP BY race`
    )
    for (const row of races) {
      stats.raceDistribution[row.race] = (stats.raceDistribution[row.race] || 0) + row.count
    }
  }

  // Calculate derived playtime stats
  stats.playtime.totalHours = Math.floor(stats.playtime.totalSeconds / 3600)
  stats.playtime.totalDays = Math.floor(stats.playtime.totalSeconds / 86400)

  return stats
}

/**
 * Get top players by metric
 */
export async function getTopPlayers(
  realms: Record<string, any>,
  metric: 'level' | 'playtime' | 'achievements' = 'level',
  limit: number = 10,
  filters: CommunityFilters = {}
): Promise<TopPlayer[]> {
  const accountFilter = await buildNonBotAccountFilter()
  const realmsToQuery = getRealmsToQuery(realms, filters.realmId)
  const topPlayers: TopPlayer[] = []

  // Build additional filters for class/race
  const additionalFilters: string[] = []
  if (filters.classId) additionalFilters.push(`class = ${filters.classId}`)
  if (filters.raceId) additionalFilters.push(`race = ${filters.raceId}`)
  const extraFilter = additionalFilters.length > 0 ? ` AND ${additionalFilters.join(' AND ')}` : ''

  for (const [realmId, realm] of Object.entries(realmsToQuery)) {
    const charsPool = await getCharactersDbPool(realmId)

    let query: string

    switch (metric) {
      case 'playtime':
        query = `
          SELECT guid, name, level, race, class, totaltime as playtime, totalKills
          FROM characters
          WHERE ${accountFilter}${extraFilter}
          ORDER BY totaltime DESC
          LIMIT ?`
        break

      case 'achievements':
        query = `
          SELECT c.guid, c.name, c.level, c.race, c.class, c.totaltime as playtime,
                 c.totalKills, COUNT(ca.achievement) as achievementCount
          FROM characters c
          LEFT JOIN character_achievement ca ON c.guid = ca.guid
          WHERE ${accountFilter}${extraFilter}
          GROUP BY c.guid
          ORDER BY achievementCount DESC
          LIMIT ?`
        break

      case 'level':
      default:
        query = `
          SELECT guid, name, level, race, class, totaltime as playtime, totalKills
          FROM characters
          WHERE ${accountFilter}${extraFilter}
          ORDER BY level DESC, totaltime DESC
          LIMIT ?`
    }

    const [rows] = await charsPool.query<RowDataPacket[]>(query, [limit])

    for (const row of rows) {
      topPlayers.push({
        guid: row.guid,
        name: row.name,
        level: row.level,
        race: row.race,
        class: row.class,
        playtime: row.playtime || 0,
        achievementCount: row.achievementCount || 0,
        totalKills: row.totalKills || 0,
        realm: realm.name,
        realmId: realmId,
      })
    }
  }

  // Sort globally
  switch (metric) {
    case 'playtime':
      topPlayers.sort((a, b) => b.playtime - a.playtime)
      break
    case 'achievements':
      topPlayers.sort((a, b) => b.achievementCount - a.achievementCount)
      break
    default:
      topPlayers.sort((a, b) => b.level - a.level || b.playtime - a.playtime)
  }

  return topPlayers.slice(0, limit)
}

/**
 * Get PvP statistics
 */
export async function getPvPStats(
  realms: Record<string, any>,
  realmIdFilter?: string
): Promise<PvPStats> {
  const accountFilter = await buildNonBotAccountFilter()
  const realmsToQuery = getRealmsToQuery(realms, realmIdFilter)

  const stats: PvPStats = {
    battlegrounds: { total: 0 },
    arenas: { total: 0 },
    topPlayers: [],
  }

  for (const [realmId, realm] of Object.entries(realmsToQuery)) {
    const charsPool = await getCharactersDbPool(realmId)

    // Battleground count
    try {
      const [bgResult] = await charsPool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM pvpstats_battlegrounds'
      )
      stats.battlegrounds.total += bgResult[0]?.total ?? 0
    } catch {
      // Table may not exist
    }

    // Arena count
    try {
      const [arenaResult] = await charsPool.query<RowDataPacket[]>(
        'SELECT COUNT(*) as total FROM log_arena_fights'
      )
      stats.arenas.total += arenaResult[0]?.total ?? 0
    } catch {
      // Table may not exist
    }

    // Top PvP players
    const [topPvP] = await charsPool.query<RowDataPacket[]>(
      `SELECT
        guid,
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

    for (const char of topPvP) {
      stats.topPlayers.push({
        guid: char.guid,
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

  // Sort globally by honor
  stats.topPlayers.sort((a, b) => b.honorPoints - a.honorPoints)
  stats.topPlayers = stats.topPlayers.slice(0, 20)

  return stats
}
