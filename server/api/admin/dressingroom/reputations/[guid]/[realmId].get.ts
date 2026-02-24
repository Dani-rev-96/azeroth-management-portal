/**
 * GET /api/admin/dressingroom/reputations/[guid]/[realmId]
 * Get all character reputations with faction names
 * GM only
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { verifyCharacterOwnership } from '#server/utils/dressingroom'

// WotLK 3.3.5a faction IDs and names
const FACTION_NAMES: Record<number, string> = {
  // Alliance
  72: 'Stormwind', 47: 'Ironforge', 69: 'Darnassus', 930: 'Exodar', 54: 'Gnomeregan',
  // Horde
  76: 'Orgrimmar', 68: 'Undercity', 81: 'Thunder Bluff', 911: 'Silvermoon City', 530: 'Darkspear Trolls',
  // Neutral - Classic
  529: 'Argent Dawn', 576: 'Timbermaw Hold', 609: 'Cenarion Circle',
  749: 'Hydraxian Waterlords', 809: 'Shen\'dralar', 910: 'Brood of Nozdormu',
  87: 'Bloodsail Buccaneers', 21: 'Booty Bay', 369: 'Gadgetzan', 470: 'Ratchet', 577: 'Everlook',
  349: 'Ravenholdt', 270: 'Zandalar Tribe',
  // PvP
  890: 'Silverwing Sentinels', 889: 'Warsong Outriders',
  509: 'The League of Arathor', 510: 'The Defilers',
  730: 'Stormpike Guard', 729: 'Frostwolf Clan',
  // BC Factions
  932: 'The Aldor', 934: 'The Scryers', 935: 'The Sha\'tar',
  933: 'The Consortium', 941: 'The Mag\'har', 942: 'Cenarion Expedition',
  946: 'Honor Hold', 947: 'Thrallmar', 967: 'The Violet Eye',
  970: 'Sporeggar', 978: 'Kurenai', 989: 'Keepers of Time',
  990: 'The Scale of the Sands', 1011: 'Lower City', 1012: 'Ashtongue Deathsworn',
  1015: 'Netherwing', 1031: 'Sha\'tari Skyguard', 1038: 'Ogri\'la',
  1077: 'Shattered Sun Offensive',
  // WotLK Factions
  1037: 'Alliance Vanguard', 1052: 'Horde Expedition',
  1068: 'Explorers\' League', 1126: 'The Frostborn',
  1064: 'The Taunka', 1067: 'The Hand of Vengeance',
  1085: 'Warsong Offensive', 1050: 'Valiance Expedition',
  1091: 'The Wyrmrest Accord', 1090: 'Kirin Tor',
  1098: 'Knights of the Ebon Blade', 1106: 'Argent Crusade',
  1104: 'Frenzyheart Tribe', 1105: 'The Oracles',
  1119: 'The Sons of Hodir', 1156: 'The Ashen Verdict',
  1073: 'The Kalu\'ak',
  1094: 'The Silver Covenant', 1124: 'The Sunreavers',
}

// Reputation standing thresholds
const STANDING_LEVELS = [
  { name: 'Exalted', min: 42000 },
  { name: 'Revered', min: 21000 },
  { name: 'Honored', min: 9000 },
  { name: 'Friendly', min: 3000 },
  { name: 'Neutral', min: 0 },
  { name: 'Unfriendly', min: -3000 },
  { name: 'Hostile', min: -6000 },
  { name: 'Hated', min: -42000 },
]

function getStandingName(standing: number): string {
  for (const level of STANDING_LEVELS) {
    if (standing >= level.min) return level.name
  }
  return 'Hated'
}

export default defineEventHandler(async (event) => {
  try {
    const { id: userId, ownAccountOnly } = await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

    const guid = parseInt(getRouterParam(event, 'guid') || '0')
    const realmId = getRouterParam(event, 'realmId') || ''

    if (!guid || !realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Character GUID and realm ID are required' })
    }

    const charPool = await getCharactersDbPool(realmId)

    // Verify character exists
    const [chars] = await charPool.query(
      'SELECT guid, name, account FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )
    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    if (ownAccountOnly) verifyCharacterOwnership(userId, (chars as any[])[0].account)

    // Try reading from the reputation cache first (absolute standings from Eluna)
    // character_reputation.standing stores base-relative offsets, but
    // web_reputation_cache.standing stores actual absolute values from Player:GetReputation()
    let reputations: any[] = []
    let fromCache = false

    try {
      const [cacheRows] = await charPool.query(
        'SELECT faction_id, standing FROM web_reputation_cache WHERE character_guid = ? ORDER BY faction_id',
        [guid]
      )
      const cacheData = cacheRows as any[]

      if (cacheData.length > 0) {
        fromCache = true
        reputations = cacheData.map((r: any) => ({
          factionId: r.faction_id,
          factionName: FACTION_NAMES[r.faction_id] || `Faction #${r.faction_id}`,
          standing: r.standing,
          standingName: getStandingName(r.standing),
          flags: 0,
          known: FACTION_NAMES[r.faction_id] !== undefined,
        }))
      }
    } catch {
      // Cache table may not exist (Eluna not running yet) - fall through to direct read
    }

    // Fall back to character_reputation if no cache available
    if (!fromCache) {
      const [reps] = await charPool.query(
        'SELECT faction, standing, flags FROM character_reputation WHERE guid = ? ORDER BY faction',
        [guid]
      )

      reputations = (reps as any[]).map((r: any) => ({
        factionId: r.faction,
        factionName: FACTION_NAMES[r.faction] || `Faction #${r.faction}`,
        standing: r.standing,
        standingName: getStandingName(r.standing),
        flags: r.flags,
        known: FACTION_NAMES[r.faction] !== undefined,
      }))
    }

    return {
      characterName: (chars as any[])[0].name,
      reputations,
      standingLevels: STANDING_LEVELS,
      fromCache,
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    console.error('[DressingRoom] Error fetching reputations:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch reputations' })
  }
})
