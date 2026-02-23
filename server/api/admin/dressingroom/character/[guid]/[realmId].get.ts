/**
 * GET /api/admin/dressingroom/character/[guid]/[realmId]
 * Get full character details for dressing room editing
 * GM only — returns items, professions, money, spells, and basic info
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getCharactersDbPool, getWorldDbPool } from '#server/utils/mysql'
import { verifyCharacterOwnership } from '#server/utils/dressingroom'

export default defineEventHandler(async (event) => {
  try {
    const { id: userId, ownAccountOnly } = await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

    const guid = parseInt(getRouterParam(event, 'guid') || '0')
    const realmId = getRouterParam(event, 'realmId') || ''

    if (!guid || !realmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Character GUID and realm ID are required',
      })
    }

    const charPool = await getCharactersDbPool(realmId)
    const worldPool = await getWorldDbPool(realmId)

    // Get character basic info
    const [characters] = await charPool.query(`
      SELECT guid, name, race, class, gender, level, money, online, account,
             health, power1 as mana, totaltime, totalKills, totalHonorPoints, arenaPoints,
             knownTitles, chosenTitle
      FROM characters
      WHERE guid = ? AND deleteDate IS NULL
    `, [guid])

    if (!Array.isArray(characters) || characters.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Character not found',
      })
    }

    if (ownAccountOnly) verifyCharacterOwnership(userId, (characters as any[])[0].account)

    const character = (characters as any[])[0]

    // Get equipped items with names from world DB
    const [charItems] = await charPool.query(`
      SELECT ci.slot, ci.item as instanceGuid, ii.itemEntry
      FROM character_inventory ci
      JOIN item_instance ii ON ci.item = ii.guid
      WHERE ci.guid = ? AND ci.bag = 0 AND ci.slot < 19
      ORDER BY ci.slot
    `, [guid])

    const itemEntries = (charItems as any[]).map((i: any) => i.itemEntry)
    let items: any[] = []

    if (itemEntries.length > 0) {
      const placeholders = itemEntries.map(() => '?').join(',')
      const [templates] = await worldPool.query(`
        SELECT entry, name, Quality as quality, ItemLevel as itemLevel, InventoryType as inventoryType
        FROM item_template
        WHERE entry IN (${placeholders})
      `, itemEntries)

      const templateMap = new Map((templates as any[]).map(t => [t.entry, t]))

      items = (charItems as any[]).map(ci => {
        const template = templateMap.get(ci.itemEntry)
        return {
          slot: ci.slot,
          instanceGuid: ci.instanceGuid,
          itemEntry: ci.itemEntry,
          name: template?.name || `Item #${ci.itemEntry}`,
          quality: template?.quality || 0,
          itemLevel: template?.itemLevel || 0,
          inventoryType: template?.inventoryType || 0,
        }
      })
    }

    // Get professions (skills with skill type = profession in character_skills)
    // Profession skill IDs in WoW 3.3.5a
    const professionSkillIds = [
      164, // Blacksmithing
      165, // Leatherworking
      171, // Alchemy
      182, // Herbalism
      186, // Mining
      197, // Tailoring
      202, // Engineering
      333, // Enchanting
      393, // Skinning
      755, // Jewelcrafting
      773, // Inscription
      129, // First Aid
      185, // Cooking
      356, // Fishing
      762, // Riding
    ]

    const skillPlaceholders = professionSkillIds.map(() => '?').join(',')
    const [skills] = await charPool.query(`
      SELECT skill, value, max
      FROM character_skills
      WHERE guid = ? AND skill IN (${skillPlaceholders})
      ORDER BY skill
    `, [guid, ...professionSkillIds])

    const professionNames: Record<number, string> = {
      164: 'Blacksmithing',
      165: 'Leatherworking',
      171: 'Alchemy',
      182: 'Herbalism',
      186: 'Mining',
      197: 'Tailoring',
      202: 'Engineering',
      333: 'Enchanting',
      393: 'Skinning',
      755: 'Jewelcrafting',
      773: 'Inscription',
      129: 'First Aid',
      185: 'Cooking',
      356: 'Fishing',
      762: 'Riding',
    }

    const professions = (skills as any[]).map(s => ({
      skillId: s.skill,
      name: professionNames[s.skill] || `Skill ${s.skill}`,
      value: s.value,
      max: s.max,
    }))

    // Get learned spells (count + useful spells)
    const [spellCount] = await charPool.query(`
      SELECT COUNT(*) as total FROM character_spell WHERE guid = ?
    `, [guid])

    // Get recently learned spells (last 50 by spell ID desc)
    const [recentSpells] = await charPool.query(`
      SELECT spell FROM character_spell
      WHERE guid = ?
      ORDER BY spell DESC LIMIT 50
    `, [guid])

    return {
      character: {
        guid: character.guid,
        name: character.name,
        race: character.race,
        class: character.class,
        gender: character.gender,
        level: character.level,
        money: Number(character.money),
        online: character.online === 1,
        account: character.account,
        health: character.health,
        mana: character.mana,
        totalTime: character.totaltime,
        totalKills: character.totalKills,
        honorPoints: character.totalHonorPoints,
        arenaPoints: character.arenaPoints,
        knownTitles: character.knownTitles || '',
        chosenTitle: character.chosenTitle || 0,
      },
      items,
      professions,
      spellCount: (spellCount as any[])[0]?.total || 0,
      recentSpellIds: (recentSpells as any[]).map(s => s.spell),
      realmId,
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    console.error('[DressingRoom] Error fetching character:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch character details',
    })
  }
})
