import { getAuthenticatedUser } from '#server/utils/auth'
import { getCharactersDbPool, getWorldDbPool } from '#server/utils/mysql'
import { getItemDisplayInfoBatch } from '#server/utils/items-db'
import {
  parseEnchantmentsField,
  getEnchantmentInfo,
  getRandomEnchantments,
  formatEnchantmentEffect,
  STAT_NAME_TO_TYPE,
  type EnchantmentInfo
} from '#server/utils/enchantments'
import { getSpellBatch, getTalentBySpellId, getSpellIconBatch } from '#server/utils/dbc-db'

/**
 * GET /api/characters/[guid]/[realmId]
 * Get detailed character information including equipped items and talents
 */
export default defineEventHandler(async (event) => {
  try {
    const user = await getAuthenticatedUser(event)
    const guid = parseInt(getRouterParam(event, 'guid') || '0')
    const realmId = getRouterParam(event, 'realmId') || ''

    if (!guid || !realmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Character GUID and realm ID are required'
      })
    }

    // Get character and world database pools for the realm
    const charsPool = await getCharactersDbPool(realmId)
    const worldPool = await getWorldDbPool(realmId, 'world')

    // Get character basic info
    const [characters] = await charsPool.query(`
      SELECT
        guid, name, race, class, gender, level, money,
        health, power1 as mana, power2 as rage, power3 as focus, power4 as energy, power5 as happiness,
        totaltime, leveltime, logout_time, is_logout_resting,
        arenaPoints, totalHonorPoints, totalKills,
        chosenTitle, knownTitles,
        equipmentCache
      FROM characters
      WHERE guid = ?
    `, [guid])

    if (!Array.isArray(characters) || characters.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Character not found'
      })
    }

    const character = characters[0] as any

    // Get client locale from headers (default to English)
    const acceptLanguage = getHeader(event, 'accept-language') || 'en'
    const locale = acceptLanguage.startsWith('de') ? 'deDE' :
                   acceptLanguage.startsWith('es') ? 'esES' :
                   acceptLanguage.startsWith('fr') ? 'frFR' :
                   acceptLanguage.startsWith('ru') ? 'ruRU' :
                   acceptLanguage.startsWith('ko') ? 'koKR' :
                   acceptLanguage.startsWith('zh') ? 'zhCN' :
                   'enUS'

    // Get equipped items from character database
    const [charItems] = await charsPool.query(`
      SELECT
        ci.guid as char_guid,
        ci.item as itemId,
        ci.slot,
        ii.itemEntry,
        ii.enchantments,
        ii.durability,
        ii.randomPropertyId
      FROM character_inventory ci
      JOIN item_instance ii ON ci.item = ii.guid
      WHERE ci.guid = ? AND ci.bag = 0 AND ci.slot < 19
      ORDER BY ci.slot
    `, [guid])

    // Get item details from world database
    const itemEntries = (charItems as any[]).map((i: any) => i.itemEntry)
    let enrichedItems: any[] = []

    if (itemEntries.length > 0) {
      const placeholders = itemEntries.map(() => '?').join(',')

      // Query item_template with optional localization
      const [itemTemplates] = await worldPool.query(`
        SELECT
          it.entry,
          it.displayid,
          it.name,
          COALESCE(itl.Name, it.name) as localizedName,
          COALESCE(itl.Description, it.description) as localizedDescription,
          it.Quality as quality,
          it.ItemLevel as itemLevel,
          it.RequiredLevel as requiredLevel,
          it.class as itemClass,
          it.subclass as itemSubclass,
          it.InventoryType as inventoryType,
          it.stat_type1, it.stat_value1,
          it.stat_type2, it.stat_value2,
          it.stat_type3, it.stat_value3,
          it.stat_type4, it.stat_value4,
          it.stat_type5, it.stat_value5,
          it.stat_type6, it.stat_value6,
          it.stat_type7, it.stat_value7,
          it.stat_type8, it.stat_value8,
          it.stat_type9, it.stat_value9,
          it.stat_type10, it.stat_value10,
          it.dmg_min1, it.dmg_max1, it.dmg_type1,
          it.dmg_min2, it.dmg_max2, it.dmg_type2,
          it.armor,
          it.holy_res, it.fire_res, it.nature_res, it.frost_res, it.shadow_res, it.arcane_res,
          it.delay
        FROM item_template it
        LEFT JOIN item_template_locale itl ON it.entry = itl.ID AND itl.locale = ?
        WHERE it.entry IN (${placeholders})
      `, [locale, ...itemEntries])

      // Create lookup map
      const itemMap = new Map()
      ;(itemTemplates as any[]).forEach((item: any) => {
        itemMap.set(item.entry, item)
      })

      // Get ItemDisplayInfo for icon mapping from database
      const displayIds = (itemTemplates as any[])
        .map((item: any) => item.displayid)
        .filter((id: number) => id > 0)

      const itemDisplayInfos = await getItemDisplayInfoBatch(displayIds)
      const displayInfoMap = new Map()
      itemDisplayInfos.forEach((info) => {
        displayInfoMap.set(info.id, info)
      })

      // Enrich character items with template data
      enrichedItems = (charItems as any[]).map((charItem: any) => {
        const template = itemMap.get(charItem.itemEntry)
        if (!template) return null

        // Calculate stats count
        let statsCount = 0
        for (let i = 1; i <= 10; i++) {
          if (template[`stat_type${i}`] > 0) statsCount++
        }

        // Get icon from ItemDisplayInfo
        const displayInfo = displayInfoMap.get(template.displayid)
        const iconName = displayInfo?.inventory_icon_1 || 'inv_misc_questionmark'

        // Parse enchantments
        const parsedEnchants = charItem.enchantments ? parseEnchantmentsField(charItem.enchantments) : []

        return {
          guid: charItem.char_guid,
          itemId: charItem.itemId,
          slot: charItem.slot,
          displayid: template.displayid,
          name: template.localizedName || template.name,
          description: template.localizedDescription,
          quality: template.quality,
          itemLevel: template.itemLevel,
          requiredLevel: template.requiredLevel,
          itemClass: template.itemClass,
          itemSubclass: template.itemSubclass,
          inventoryType: template.inventoryType,
          armor: template.armor,
          statsCount,
          stat_type1: template.stat_type1,
          stat_value1: template.stat_value1,
          stat_type2: template.stat_type2,
          stat_value2: template.stat_value2,
          stat_type3: template.stat_type3,
          stat_value3: template.stat_value3,
          stat_type4: template.stat_type4,
          stat_value4: template.stat_value4,
          stat_type5: template.stat_type5,
          stat_value5: template.stat_value5,
          stat_type6: template.stat_type6,
          stat_value6: template.stat_value6,
          stat_type7: template.stat_type7,
          stat_value7: template.stat_value7,
          stat_type8: template.stat_type8,
          stat_value8: template.stat_value8,
          stat_type9: template.stat_type9,
          stat_value9: template.stat_value9,
          stat_type10: template.stat_type10,
          stat_value10: template.stat_value10,
          dmg_min1: template.dmg_min1,
          dmg_max1: template.dmg_max1,
          dmg_type1: template.dmg_type1,
          dmg_min2: template.dmg_min2,
          dmg_max2: template.dmg_max2,
          dmg_type2: template.dmg_type2,
          holy_res: template.holy_res,
          fire_res: template.fire_res,
          nature_res: template.nature_res,
          frost_res: template.frost_res,
          shadow_res: template.shadow_res,
          arcane_res: template.arcane_res,
          delay: template.delay,
          enchantments: charItem.enchantments,
          parsedEnchants,
          durability: charItem.durability,
          randomPropertyId: charItem.randomPropertyId,
          icon: iconName
        }
      }).filter(Boolean)

      // Now enrich all items with full enchantment data
      for (const item of enrichedItems) {
        const enchantInfos: EnchantmentInfo[] = []

        // Get regular enchantments (these are shown with ✨)
        if (item.parsedEnchants && item.parsedEnchants.length > 0) {
          const regularEnchants = await getEnchantmentInfo(item.parsedEnchants)
          enchantInfos.push(...regularEnchants)
        }

        // Get random property/suffix stats (these are added to base stats, NOT shown as enchantments)
        if (item.randomPropertyId && item.randomPropertyId !== 0) {
          const randomEnchants = await getRandomEnchantments(item.randomPropertyId, item.itemLevel)

          // Add random property stats to item's stat fields
          for (const enchantInfo of randomEnchants) {
            for (const effect of enchantInfo.effects) {
              if (effect.stat && effect.value) {
                // Special case: Armor is added to the base armor value, not as a stat
                if (effect.stat === 'Armor') {
                  item.armor = (item.armor || 0) + effect.value
                  continue
                }

                // Find the stat type ID for this stat name
                const statTypeId = STAT_NAME_TO_TYPE[effect.stat]
                if (statTypeId !== undefined) {
                  // Add to next available stat slot
                  const currentStatCount = item.statsCount || 0
                  if (currentStatCount < 10) {
                    const nextSlot = currentStatCount + 1
                    item[`stat_type${nextSlot}` as keyof typeof item] = statTypeId as any
                    item[`stat_value${nextSlot}` as keyof typeof item] = effect.value as any
                    item.statsCount = nextSlot
                  }
                }
              }
            }
          }
        }

        // Format enchantments for display (only regular enchantments, not random properties)
        item.enchantmentInfos = enchantInfos
        item.enchantmentTexts = enchantInfos.flatMap(info =>
          info.effects.map(effect => formatEnchantmentEffect(effect))
        )
      }
    }

    // Get talents for both specs
    const [talents] = await charsPool.query(`
      SELECT guid, spell, specMask
      FROM character_talent
      WHERE guid = ?
      ORDER BY specMask, spell
    `, [guid])

    // Enrich talents with spell names, icons, and correct rank calculation
    const enrichedTalents = []
    if ((talents as any[]).length > 0) {
      const spellIds = (talents as any[]).map((t: any) => t.spell)
      const spells = await getSpellBatch(spellIds)
      const spellMap = new Map(spells.map(s => [s.id, s]))

      // Get spell icons
      const iconIds = spells.map(s => s.spell_icon_id).filter(id => id > 0)
      const icons = await getSpellIconBatch(iconIds)
      const iconMap = new Map(icons.map(i => [i.id, i]))

      // Group talents by talentId to calculate ranks
      const talentGroups = new Map<number, any[]>()

      for (const talent of talents as any[]) {
        const talentInfo = await getTalentBySpellId(talent.spell)
        if (!talentInfo) continue

        if (!talentGroups.has(talentInfo.id)) {
          talentGroups.set(talentInfo.id, [])
        }
        talentGroups.get(talentInfo.id)!.push({
          ...talent,
          talentInfo
        })
      }

      // Now process each talent with correct rank calculation
      for (const talent of talents as any[]) {
        const spell = spellMap.get(talent.spell)
        const talentInfo = await getTalentBySpellId(talent.spell)

        if (!talentInfo) {
          enrichedTalents.push({
            guid: talent.guid,
            spell: talent.spell,
            specMask: talent.specMask,
            spellName: spell?.name || `Spell ${talent.spell}`,
            spellRank: spell?.rank || '',
            spellIconTexture: '',
            talentId: undefined,
            tabId: undefined,
            tier: undefined,
            column: undefined,
            currentRank: 1,
            maxRank: 1
          })
          continue
        }

        // Calculate max rank from talent data
        const rankIds = [
          talentInfo.rank_id_1,
          talentInfo.rank_id_2,
          talentInfo.rank_id_3,
          talentInfo.rank_id_4,
          talentInfo.rank_id_5
        ]
        const maxRank = rankIds.filter(id => id > 0).length

        // Find which rank this spell is
        let currentRank = 1
        for (let i = 0; i < rankIds.length; i++) {
          if (rankIds[i] === talent.spell) {
            currentRank = i + 1
            break
          }
        }

        // Get icon texture
        const icon = spell?.spell_icon_id ? iconMap.get(spell.spell_icon_id) : undefined
        const iconTexture = icon?.texture_filename || ''

        enrichedTalents.push({
          guid: talent.guid,
          spell: talent.spell,
          specMask: talent.specMask,
          spellName: spell?.name || `Spell ${talent.spell}`,
          spellRank: spell?.rank || '',
          spellIconTexture: iconTexture,
          talentId: talentInfo.id,
          tabId: talentInfo.tab_id,
          tier: talentInfo.tier_id,
          column: talentInfo.column_index,
          currentRank,
          maxRank
        })
      }
    }

    // Get achievements
    const [achievements] = await charsPool.query(`
      SELECT achievement, date
      FROM character_achievement
      WHERE guid = ?
      ORDER BY date DESC
      LIMIT 10
    `, [guid])

    // Get statistics
    console.log('[Character Stats] Querying for guid:', guid)
    let stats: any[] = []
    try {
      const [statsResult] = await charsPool.query(`
        SELECT
          guid, maxhealth,
          maxpower1, maxpower2, maxpower3, maxpower4, maxpower5, maxpower6, maxpower7,
          strength, agility, stamina, intellect, spirit, armor,
          resHoly, resFire, resNature, resFrost, resShadow, resArcane,
          blockPct, dodgePct, parryPct, critPct, rangedCritPct, spellCritPct,
          attackPower, rangedAttackPower, spellPower, resilience
        FROM character_stats
        WHERE guid = ?
      `, [guid])
      stats = statsResult as any[]
    } catch (error) {
      console.error('[Character Stats] Error querying character_stats:', error)
      // Table might not exist, continue without stats
      stats = []
    }

    return {
      character: {
        guid: character.guid,
        name: character.name,
        race: character.race,
        class: character.class,
        gender: character.gender,
        level: character.level,
        money: character.money,
        health: character.health,
        mana: character.mana,
        rage: character.rage,
        focus: character.focus,
        energy: character.energy,
        happiness: character.happiness,
        totalTime: character.totaltime,
        levelTime: character.leveltime,
        logoutTime: character.logout_time,
        isLogoutResting: character.is_logout_resting,
        arenaPoints: character.arenaPoints,
        honorPoints: character.totalHonorPoints,
        totalKills: character.totalKills,
        chosenTitle: character.chosenTitle,
        knownTitles: character.knownTitles,
        equipmentCache: character.equipmentCache,
        specCount: 1, // Default value
        activeSpec: 0 // Default value
      },
      items: enrichedItems,
      talents: enrichedTalents || [],
      achievements: achievements || [],
      stats: stats || [],
      realmId
    }
  } catch (error: any) {
    console.error('Error fetching character details:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch character details'
    })
  }
})
