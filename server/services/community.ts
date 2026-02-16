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
 * Options for online players query
 */
export interface OnlinePlayersOptions {
  realmId?: string
  search?: string
  page?: number
  limit?: number
}

/**
 * Paginated response for online players
 */
export interface OnlinePlayersResponse {
  players: OnlinePlayer[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Get list of online players across realms
 */
export async function getOnlinePlayers(
  realms: Record<string, any>,
  options: OnlinePlayersOptions = {}
): Promise<OnlinePlayersResponse> {
  const { realmId: realmIdFilter, search, page = 1, limit = 50 } = options
  const accountFilter = await buildNonBotAccountFilter()
  const realmsToQuery = getRealmsToQuery(realms, realmIdFilter)

  // Query online characters from each realm in parallel
  const realmResults = await Promise.all(
    Object.entries(realmsToQuery).map(async ([realmId, realm]) => {
      const charsPool = await getCharactersDbPool(realmId)

      const [chars] = await charsPool.query<RowDataPacket[]>(
        `SELECT
          guid,
          name,
          level,
          race,
          class,
          zone,
          totaltime,
          account as accountId
         FROM characters
         WHERE online = 1 AND ${accountFilter}`
      )

      return chars.map(char => ({
        guid: char.guid,
        characterName: char.name,
        level: char.level,
        race: char.race,
        class: char.class,
        zone: char.zone,
        accountName: '',
        realm: realm.name,
        realmId: realmId,
        playtime: char.totaltime,
        accountId: char.accountId,
      }))
    })
  )

  const onlinePlayers = realmResults.flat()
  const accountIds = new Set(onlinePlayers.map(p => (p as any).accountId as number))

  // Batch lookup account names
  if (accountIds.size > 0) {
    const authPool = await getAuthDbPool()
    const [accounts] = await authPool.query<RowDataPacket[]>(
      `SELECT id, username FROM account WHERE id IN (${[...accountIds].join(',')})`
    )
    const accountMap = new Map(accounts.map(a => [a.id, a.username]))

    // Fill in account names
    for (const player of onlinePlayers) {
      const accountId = (player as any).accountId
      player.accountName = accountMap.get(accountId) || 'Unknown'
    }
  }

  // Resolve zone names
  const zoneIds = [...new Set(onlinePlayers.map(p => p.zone).filter(z => z > 0))]
  const zoneNames = await getAreaNameBatch(zoneIds)

  // Add zone names to players
  let playersWithZones = onlinePlayers.map(player => ({
    ...player,
    zoneName: zoneNames.get(player.zone) || `Zone ${player.zone}`,
  }))

  // Apply search filter if provided
  if (search) {
    const searchLower = search.toLowerCase()
    playersWithZones = playersWithZones.filter(player =>
      player.characterName.toLowerCase().includes(searchLower) ||
      player.zoneName.toLowerCase().includes(searchLower) ||
      player.guid.toString().includes(searchLower) ||
      player.realm.toLowerCase().includes(searchLower)
    )
  }

  // Calculate pagination
  const total = playersWithZones.length
  const totalPages = Math.ceil(total / limit)
  const startIndex = (page - 1) * limit
  const paginatedPlayers = playersWithZones.slice(startIndex, startIndex + limit)

  return {
    players: paginatedPlayers,
    pagination: { page, limit, total, totalPages }
  }
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

  // Build additional filters (parameterized to prevent SQL injection)
  const additionalFilters: string[] = []
  const filterParams: any[] = []
  if (filters.classId) { additionalFilters.push(`class = ?`); filterParams.push(Number(filters.classId)) }
  if (filters.raceId) { additionalFilters.push(`race = ?`); filterParams.push(Number(filters.raceId)) }
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

  // Aggregate from each realm in parallel
  const realmStats = await Promise.all(
    Object.entries(realmsToQuery).map(async ([realmId]) => {
      const charsPool = await getCharactersDbPool(realmId)

      // Class distribution (apply only race filter, not class filter)
      const classExtraFilter = filters.raceId ? ` AND race = ?` : ''
      const classFilterParams = filters.raceId ? [Number(filters.raceId)] : []

      // Race distribution (apply only class filter, not race filter)
      const raceExtraFilter = filters.classId ? ` AND class = ?` : ''
      const raceFilterParams = filters.classId ? [Number(filters.classId)] : []

      const [
        [charCount],
        [playtime],
        [maxLevel],
        [factions],
        [classes],
        [races],
      ] = await Promise.all([
        charsPool.query<RowDataPacket[]>(
          `SELECT COUNT(*) as total FROM characters WHERE ${accountFilter}${extraFilter}`,
          filterParams
        ),
        charsPool.query<RowDataPacket[]>(
          `SELECT SUM(totaltime) as total FROM characters WHERE ${accountFilter}${extraFilter}`,
          filterParams
        ),
        charsPool.query<RowDataPacket[]>(
          `SELECT COUNT(*) as total FROM characters WHERE level = 80 AND ${accountFilter}${extraFilter}`,
          filterParams
        ),
        charsPool.query<RowDataPacket[]>(
          `SELECT
            CASE
              WHEN race IN (1,3,4,7,11) THEN 'alliance'
              WHEN race IN (2,5,6,8,10) THEN 'horde'
            END as faction,
            COUNT(*) as count
           FROM characters
           WHERE ${accountFilter}${extraFilter}
           GROUP BY faction`,
          filterParams
        ),
        charsPool.query<RowDataPacket[]>(
          `SELECT class, COUNT(*) as count FROM characters WHERE ${accountFilter}${classExtraFilter} GROUP BY class`,
          classFilterParams
        ),
        charsPool.query<RowDataPacket[]>(
          `SELECT race, COUNT(*) as count FROM characters WHERE ${accountFilter}${raceExtraFilter} GROUP BY race`,
          raceFilterParams
        ),
      ])

      return {
        totalChars: charCount[0]?.total ?? 0,
        totalPlaytime: Number(playtime[0]?.total ?? 0),
        maxLevelCount: maxLevel[0]?.total ?? 0,
        factions: factions as RowDataPacket[],
        classes: classes as RowDataPacket[],
        races: races as RowDataPacket[],
      }
    })
  )

  // Merge realm results into stats
  for (const realmResult of realmStats) {
    stats.characters.total += realmResult.totalChars
    stats.playtime.totalSeconds += realmResult.totalPlaytime
    stats.characters.maxLevel += realmResult.maxLevelCount

    for (const row of realmResult.factions) {
      if (row.faction === 'alliance') stats.factions.alliance += row.count
      else if (row.faction === 'horde') stats.factions.horde += row.count
    }

    for (const row of realmResult.classes) {
      stats.classDistribution[row.class] = (stats.classDistribution[row.class] || 0) + row.count
    }

    for (const row of realmResult.races) {
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

  // Build additional filters (parameterized to prevent SQL injection)
  const additionalFilters: string[] = []
  const filterParams: any[] = []
  if (filters.classId) { additionalFilters.push(`class = ?`); filterParams.push(Number(filters.classId)) }
  if (filters.raceId) { additionalFilters.push(`race = ?`); filterParams.push(Number(filters.raceId)) }
  const extraFilter = additionalFilters.length > 0 ? ` AND ${additionalFilters.join(' AND ')}` : ''

  // Query all realms in parallel
  const realmResults = await Promise.all(
    Object.entries(realmsToQuery).map(async ([realmId, realm]) => {
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

      const [rows] = await charsPool.query<RowDataPacket[]>(query, [...filterParams, limit])

      return rows.map(row => ({
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
      }))
    })
  )

  const topPlayers: TopPlayer[] = realmResults.flat()

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

  // Query all realms in parallel
  const realmResults = await Promise.all(
    Object.entries(realmsToQuery).map(async ([realmId, realm]) => {
      const charsPool = await getCharactersDbPool(realmId)

      let bgTotal = 0
      let arenaTotal = 0

      // Battleground count
      try {
        const [bgResult] = await charsPool.query<RowDataPacket[]>(
          'SELECT COUNT(*) as total FROM pvpstats_battlegrounds'
        )
        bgTotal = bgResult[0]?.total ?? 0
      } catch {
        // Table may not exist
      }

      // Arena count
      try {
        const [arenaResult] = await charsPool.query<RowDataPacket[]>(
          'SELECT COUNT(*) as total FROM log_arena_fights'
        )
        arenaTotal = arenaResult[0]?.total ?? 0
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

      return {
        bgTotal,
        arenaTotal,
        players: topPvP.map(char => ({
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
        })),
      }
    })
  )

  // Merge realm results
  for (const result of realmResults) {
    stats.battlegrounds.total += result.bgTotal
    stats.arenas.total += result.arenaTotal
    stats.topPlayers.push(...result.players)
  }

  // Sort globally by honor
  stats.topPlayers.sort((a, b) => b.honorPoints - a.honorPoints)
  stats.topPlayers = stats.topPlayers.slice(0, 20)

  return stats
}

/**
 * Player info for the player directory
 */
export interface DirectoryPlayer {
  guid: number
  name: string
  level: number
  race: number
  class: number
  zone: number
  zoneName: string
  playtime: number
  achievementCount: number
  totalKills: number
  online: boolean
  realm: string
  realmId: string
}

/**
 * Options for searching all players
 */
export interface SearchPlayersOptions {
  search?: string
  page?: number
  limit?: number
  realmId?: string
  classId?: number
  raceId?: number
  zoneId?: number
  minLevel?: number
  maxLevel?: number
  onlineOnly?: boolean
}

/**
 * Paginated response for player search
 */
export interface SearchPlayersResponse {
  players: DirectoryPlayer[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

/**
 * Search all players in the database with optional filters
 */
export async function searchAllPlayers(
  realms: Record<string, any>,
  options: SearchPlayersOptions = {}
): Promise<SearchPlayersResponse> {
  const {
    search,
    page = 1,
    limit = 24,
    realmId,
    classId,
    raceId,
    zoneId,
    minLevel,
    maxLevel,
    onlineOnly
  } = options
  const accountFilter = await buildNonBotAccountFilter()
  const realmsToQuery = getRealmsToQuery(realms, realmId)

  // Build additional filters (parameterized to prevent SQL injection)
  const additionalFilters: string[] = []
  const filterParams: any[] = []
  if (classId) { additionalFilters.push(`c.class = ?`); filterParams.push(Number(classId)) }
  if (raceId) { additionalFilters.push(`c.race = ?`); filterParams.push(Number(raceId)) }
  if (zoneId) { additionalFilters.push(`c.zone = ?`); filterParams.push(Number(zoneId)) }
  if (minLevel !== undefined && minLevel > 0) { additionalFilters.push(`c.level >= ?`); filterParams.push(Number(minLevel)) }
  if (maxLevel !== undefined && maxLevel > 0 && maxLevel < 80) { additionalFilters.push(`c.level <= ?`); filterParams.push(Number(maxLevel)) }
  if (onlineOnly) additionalFilters.push(`c.online = 1`)
  if (search) {
    additionalFilters.push(`c.name LIKE ?`)
    filterParams.push(`%${search}%`)
  }
  const extraFilter = additionalFilters.length > 0 ? ` AND ${additionalFilters.join(' AND ')}` : ''

  // First, count total matching players across all realms in parallel
  const realmEntries = Object.entries(realmsToQuery)
  const realmCounts = await Promise.all(
    realmEntries.map(async ([rId, realm]) => {
      const charsPool = await getCharactersDbPool(rId)
      const [countResult] = await charsPool.query<RowDataPacket[]>(
        `SELECT COUNT(*) as total FROM characters c WHERE ${accountFilter}${extraFilter}`,
        filterParams
      )
      const count = countResult[0]?.total ?? 0
      return { realmId: rId, realm, count }
    })
  )

  const totalCount = realmCounts.reduce((sum, r) => sum + r.count, 0)

  const totalPages = Math.ceil(totalCount / limit)
  const offset = (page - 1) * limit

  // Determine which realm(s) to query based on offset
  const playersRaw: Array<Omit<DirectoryPlayer, 'zoneName'> & { zone: number }> = []
  let currentOffset = offset
  let remainingLimit = limit

  for (const { realmId: rId, realm, count } of realmCounts) {
    if (remainingLimit <= 0) break

    // Skip this realm if offset is beyond its count
    if (currentOffset >= count) {
      currentOffset -= count
      continue
    }

    const charsPool = await getCharactersDbPool(rId)
    const queryLimit = Math.min(remainingLimit, count - currentOffset)

    const [rows] = await charsPool.query<RowDataPacket[]>(
      `SELECT
        c.guid,
        c.name,
        c.level,
        c.race,
        c.class,
        c.zone,
        c.totaltime as playtime,
        c.totalKills,
        c.online,
        (SELECT COUNT(*) FROM character_achievement WHERE guid = c.guid) as achievementCount
       FROM characters c
       WHERE ${accountFilter}${extraFilter}
       ORDER BY c.level DESC, c.totaltime DESC
       LIMIT ? OFFSET ?`,
      [...filterParams, queryLimit, currentOffset]
    )

    for (const row of rows) {
      playersRaw.push({
        guid: row.guid,
        name: row.name,
        level: row.level,
        race: row.race,
        class: row.class,
        zone: row.zone,
        playtime: row.playtime || 0,
        achievementCount: row.achievementCount || 0,
        totalKills: row.totalKills || 0,
        online: row.online === 1,
        realm: realm.name,
        realmId: rId,
      })
    }

    remainingLimit -= rows.length
    currentOffset = 0 // After processing first realm, offset is 0 for subsequent realms
  }

  // Resolve zone names
  const zoneIds = [...new Set(playersRaw.map(p => p.zone).filter(z => z > 0))]
  const zoneNames = await getAreaNameBatch(zoneIds)

  // Add zone names to players
  const players: DirectoryPlayer[] = playersRaw.map(player => ({
    ...player,
    zoneName: zoneNames.get(player.zone) || (player.zone > 0 ? `Zone ${player.zone}` : 'Unknown'),
  }))

  return {
    players,
    pagination: { page, limit, total: totalCount, totalPages }
  }
}
