/**
 * GET /api/shop/item-details
 * Get detailed item information for tooltip display
 * Query params:
 *   - entry: item template entry ID
 *   - realmId: realm to query
 */

import { getShopConfig } from '#server/utils/config'
import type { ShopItemDetails } from '~/types'
import {
  getItemSpellEffects,
  STAT_TYPES,
} from '#server/utils/enchantments'

/** WoW 3.3.5a inventory type names */
const INVENTORY_TYPE_NAMES: Record<number, string> = {
  0: '',
  1: 'Head',
  2: 'Neck',
  3: 'Shoulder',
  4: 'Shirt',
  5: 'Chest',
  6: 'Waist',
  7: 'Legs',
  8: 'Feet',
  9: 'Wrist',
  10: 'Hands',
  11: 'Finger',
  12: 'Trinket',
  13: 'One-Hand',
  14: 'Off Hand',
  15: 'Ranged',
  16: 'Back',
  17: 'Two-Hand',
  18: 'Bag',
  20: 'Robe',
  21: 'Main Hand',
  22: 'Off Hand',
  23: 'Held In Off-hand',
  24: 'Ammo',
  25: 'Thrown',
  26: 'Ranged',
  28: 'Relic',
}

/** WoW 3.3.5a weapon subclass names */
const WEAPON_SUBCLASS_NAMES: Record<number, string> = {
  0: 'Axe',
  1: 'Axe',
  2: 'Bow',
  3: 'Gun',
  4: 'Mace',
  5: 'Mace',
  6: 'Polearm',
  7: 'Sword',
  8: 'Sword',
  9: 'Obsolete',
  10: 'Staff',
  13: 'Fist Weapon',
  14: 'Miscellaneous',
  15: 'Dagger',
  16: 'Thrown',
  17: 'Spear',
  18: 'Crossbow',
  19: 'Wand',
  20: 'Fishing Pole',
}

/** WoW 3.3.5a armor subclass names */
const ARMOR_SUBCLASS_NAMES: Record<number, string> = {
  0: 'Miscellaneous',
  1: 'Cloth',
  2: 'Leather',
  3: 'Mail',
  4: 'Plate',
  5: 'Buckler (Obsolete)',
  6: 'Shield',
  7: 'Libram',
  8: 'Idol',
  9: 'Totem',
  10: 'Sigil',
}

function getSubclassName(itemClass: number, subclass: number): string {
  if (itemClass === 2) return WEAPON_SUBCLASS_NAMES[subclass] || ''
  if (itemClass === 4) return ARMOR_SUBCLASS_NAMES[subclass] || ''
  return ''
}

export default defineEventHandler(async (event) => {
  try {
    const shopConfig = await getShopConfig()

    if (!shopConfig.enabled) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Shop is currently disabled',
      })
    }

    const query = getQuery(event)
    const entry = parseInt(query.entry as string)
    const realmId = (query.realmId as string) || 'wotlk'

    if (!entry || isNaN(entry) || entry <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid item entry ID',
      })
    }

    const { getWorldDbPool } = await import('#server/utils/mysql')
    const pool = await getWorldDbPool(realmId)

    const [rows] = await pool.query(
      `SELECT
        entry,
        name,
        description,
        class,
        subclass,
        Quality as quality,
        BuyPrice as buyPrice,
        SellPrice as sellPrice,
        displayid,
        InventoryType as inventoryType,
        ItemLevel as itemLevel,
        RequiredLevel as requiredLevel,
        stackable as maxStackSize,
        bonding,
        armor,
        block,
        dmg_min1 as dmgMin1,
        dmg_max1 as dmgMax1,
        dmg_type1 as dmgType1,
        dmg_min2 as dmgMin2,
        dmg_max2 as dmgMax2,
        dmg_type2 as dmgType2,
        delay,
        holy_res as holyRes,
        fire_res as fireRes,
        nature_res as natureRes,
        frost_res as frostRes,
        shadow_res as shadowRes,
        arcane_res as arcaneRes,
        stat_type1, stat_value1,
        stat_type2, stat_value2,
        stat_type3, stat_value3,
        stat_type4, stat_value4,
        stat_type5, stat_value5,
        stat_type6, stat_value6,
        stat_type7, stat_value7,
        stat_type8, stat_value8,
        stat_type9, stat_value9,
        stat_type10, stat_value10,
        socketColor_1 as socketColor1,
        socketColor_2 as socketColor2,
        socketColor_3 as socketColor3,
        socketBonus,
        AllowableClass as allowableClass,
        AllowableRace as allowableRace,
        itemset as itemSet,
        maxcount as maxCount,
        MaxDurability as maxDurability,
        spellid_1, spelltrigger_1,
        spellid_2, spelltrigger_2,
        spellid_3, spelltrigger_3,
        spellid_4, spelltrigger_4,
        spellid_5, spelltrigger_5
      FROM item_template
      WHERE entry = ?`,
      [entry]
    )

    const items = rows as any[]
    if (items.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Item not found',
      })
    }

    const item = items[0]

    // Get icon
    const { getItemDisplayInfo } = await import('#server/utils/dbc-db')
    let iconName = ''
    if (item.displayid > 0) {
      const displayInfo = await getItemDisplayInfo(item.displayid)
      if (displayInfo) {
        iconName = displayInfo.inventory_icon_1 || ''
        if (iconName.includes('\\')) {
          iconName = iconName.split('\\').pop() || ''
        }
        iconName = iconName.toLowerCase()
      }
    }

    // Build stats array (filter out type 0 / value 0 entries)
    const stats: Array<{ type: number; value: number }> = []
    for (let i = 1; i <= 10; i++) {
      const type = item[`stat_type${i}`]
      const value = item[`stat_value${i}`]
      if (type > 0 && value !== 0) {
        stats.push({ type, value })
      }
    }

    // Resolve equip spell effects ("Equip: Increases X by Y")
    const spellIds: { spellId: number; trigger: number }[] = []
    for (let i = 1; i <= 5; i++) {
      const spellId = item[`spellid_${i}`]
      const trigger = item[`spelltrigger_${i}`]
      if (spellId && spellId > 0) {
        spellIds.push({ spellId, trigger })
      }
    }

    const equipEffects: string[] = []
    if (spellIds.length > 0) {
      const spellEffects = await getItemSpellEffects(spellIds)
      for (const effect of spellEffects) {
        if (effect.stat && effect.value) {
          equipEffects.push(`Equip: +${effect.value} ${effect.stat}`)
        }
      }
    }

    // Resolve socket bonus enchantment name
    let socketBonusName = ''
    if (item.socketBonus > 0) {
      const { getSpellItemEnchantmentBatch } = await import('#server/utils/dbc-db')
      const enchants = await getSpellItemEnchantmentBatch([item.socketBonus])
      const enchant = enchants[0]
      if (enchant) {
        // Check if this is a stat-type enchantment (effect type 5)
        if (enchant.effect_1 === 5 && enchant.effect_arg_1 !== undefined) {
          const statName = STAT_TYPES[enchant.effect_arg_1]
          if (statName) {
            socketBonusName = `+${enchant.effect_points_min_1} ${statName}`
          }
        }
        if (!socketBonusName && enchant.name) {
          socketBonusName = enchant.name
        }
      }
    }

    // Calculate markup price
    const markupMultiplier = 1 + (shopConfig.priceMarkupPercent / 100)

    const result: ShopItemDetails = {
      entry: item.entry,
      name: item.name,
      description: item.description || '',
      class: item.class,
      subclass: item.subclass,
      quality: item.quality,
      buyPrice: item.buyPrice,
      sellPrice: item.sellPrice,
      shopPrice: Math.ceil(item.buyPrice * markupMultiplier),
      icon: iconName,
      inventoryType: item.inventoryType,
      itemLevel: item.itemLevel,
      requiredLevel: item.requiredLevel,
      maxStackSize: item.maxStackSize || 1,
      bonding: item.bonding || 0,
      armor: item.armor || 0,
      block: item.block || 0,
      dmgMin1: item.dmgMin1 || 0,
      dmgMax1: item.dmgMax1 || 0,
      dmgType1: item.dmgType1 || 0,
      dmgMin2: item.dmgMin2 || 0,
      dmgMax2: item.dmgMax2 || 0,
      dmgType2: item.dmgType2 || 0,
      delay: item.delay || 0,
      stats,
      holyRes: item.holyRes || 0,
      fireRes: item.fireRes || 0,
      natureRes: item.natureRes || 0,
      frostRes: item.frostRes || 0,
      shadowRes: item.shadowRes || 0,
      arcaneRes: item.arcaneRes || 0,
      socketColor1: item.socketColor1 || 0,
      socketColor2: item.socketColor2 || 0,
      socketColor3: item.socketColor3 || 0,
      socketBonus: item.socketBonus || 0,
      socketBonusName,
      equipEffects,
      allowableClass: item.allowableClass ?? -1,
      allowableRace: item.allowableRace ?? -1,
      itemSet: item.itemSet || 0,
      maxCount: item.maxCount || 0,
      maxDurability: item.maxDurability || 0,
      subclassName: getSubclassName(item.class, item.subclass),
      inventoryTypeName: INVENTORY_TYPE_NAMES[item.inventoryType] || '',
    }

    return result
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error fetching item details:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch item details',
      data: {
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
})
