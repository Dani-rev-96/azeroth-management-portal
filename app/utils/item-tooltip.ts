/**
 * Utility to convert different item data shapes into the normalized ItemTooltipData
 * used by the shared ItemTooltip component.
 */
import type { CharacterItem, ShopItemDetails, ItemTooltipData } from '~/types'
import { getStatName } from '~/utils/wow'

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

/**
 * Convert a CharacterItem (from character detail API) into ItemTooltipData.
 * Stats are stored as flat stat_type1..10 / stat_value1..10 fields.
 */
export function characterItemToTooltipData(item: CharacterItem): ItemTooltipData {
  // Build stats array from flat fields
  const stats: Array<{ type: number; value: number }> = []
  for (let i = 1; i <= 10; i++) {
    const type = item[`stat_type${i}` as keyof CharacterItem] as number | undefined
    const value = item[`stat_value${i}` as keyof CharacterItem] as number | undefined
    if (type && type > 0 && value) {
      stats.push({ type, value })
    }
  }

  return {
    name: item.name,
    quality: item.quality,
    itemLevel: item.itemLevel,
    requiredLevel: item.requiredLevel,
    itemClass: item.itemClass,
    itemSubclass: item.itemSubclass,
    inventoryType: item.inventoryType,
    inventoryTypeName: INVENTORY_TYPE_NAMES[item.inventoryType] || '',
    subclassName: getSubclassName(item.itemClass, item.itemSubclass),
    armor: item.armor,
    dmgMin1: item.dmg_min1,
    dmgMax1: item.dmg_max1,
    dmgType1: item.dmg_type1,
    dmgMin2: item.dmg_min2,
    dmgMax2: item.dmg_max2,
    dmgType2: item.dmg_type2,
    delay: item.delay,
    stats,
    holyRes: item.holy_res,
    fireRes: item.fire_res,
    natureRes: item.nature_res,
    frostRes: item.frost_res,
    shadowRes: item.shadow_res,
    arcaneRes: item.arcane_res,
    enchantmentTexts: item.enchantmentTexts,
    currentDurability: item.durability,
    description: item.description,
  }
}

/**
 * Convert a ShopItemDetails (from shop item-details API) into ItemTooltipData.
 */
export function shopItemToTooltipData(item: ShopItemDetails): ItemTooltipData {
  return {
    name: item.name,
    quality: item.quality,
    itemLevel: item.itemLevel,
    requiredLevel: item.requiredLevel,
    itemClass: item.class,
    itemSubclass: item.subclass,
    inventoryType: item.inventoryType,
    inventoryTypeName: item.inventoryTypeName,
    subclassName: item.subclassName,
    bonding: item.bonding,
    maxCount: item.maxCount,
    armor: item.armor,
    block: item.block,
    dmgMin1: item.dmgMin1,
    dmgMax1: item.dmgMax1,
    dmgType1: item.dmgType1,
    dmgMin2: item.dmgMin2,
    dmgMax2: item.dmgMax2,
    dmgType2: item.dmgType2,
    delay: item.delay,
    stats: item.stats,
    holyRes: item.holyRes,
    fireRes: item.fireRes,
    natureRes: item.natureRes,
    frostRes: item.frostRes,
    shadowRes: item.shadowRes,
    arcaneRes: item.arcaneRes,
    socketColor1: item.socketColor1,
    socketColor2: item.socketColor2,
    socketColor3: item.socketColor3,
    socketBonusName: item.socketBonusName,
    equipEffects: item.equipEffects,
    maxDurability: item.maxDurability,
    allowableClass: item.allowableClass,
    allowableRace: item.allowableRace,
    description: item.description,
    sellPrice: item.sellPrice,
  }
}
