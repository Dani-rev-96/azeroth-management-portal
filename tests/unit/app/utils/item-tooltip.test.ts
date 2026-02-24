import { describe, it, expect } from 'vitest'
import {
  characterItemToTooltipData,
  shopItemToTooltipData,
} from '../../../../app/utils/item-tooltip'
import type { CharacterItem, ShopItemDetails } from '../../../../app/types'

// ─── characterItemToTooltipData ─────────────────────────────────────────────────

describe('characterItemToTooltipData', () => {
  const baseItem: CharacterItem = {
    guid: 1,
    itemId: 12345,
    slot: 15,
    displayid: 100,
    name: 'Thunderfury',
    quality: 5,
    itemLevel: 80,
    requiredLevel: 60,
    itemClass: 2,
    itemSubclass: 7,
    inventoryType: 17,
    statsCount: 2,
    stat_type1: 4,
    stat_value1: 20,
    stat_type2: 7,
    stat_value2: 15,
    armor: 0,
    dmg_min1: 36,
    dmg_max1: 68,
    dmg_type1: 0,
    delay: 1900,
  }

  it('maps basic fields correctly', () => {
    const result = characterItemToTooltipData(baseItem)
    expect(result.name).toBe('Thunderfury')
    expect(result.quality).toBe(5)
    expect(result.itemLevel).toBe(80)
    expect(result.requiredLevel).toBe(60)
    expect(result.itemClass).toBe(2)
    expect(result.itemSubclass).toBe(7)
    expect(result.inventoryType).toBe(17)
  })

  it('maps inventory type name from lookup table', () => {
    const result = characterItemToTooltipData(baseItem)
    expect(result.inventoryTypeName).toBe('Two-Hand')
  })

  it('maps weapon subclass name', () => {
    const result = characterItemToTooltipData(baseItem)
    expect(result.subclassName).toBe('Sword')
  })

  it('maps armor subclass for armor items', () => {
    const armorItem: CharacterItem = {
      ...baseItem,
      itemClass: 4,
      itemSubclass: 4,
      inventoryType: 5,
    }
    const result = characterItemToTooltipData(armorItem)
    expect(result.subclassName).toBe('Plate')
    expect(result.inventoryTypeName).toBe('Chest')
  })

  it('builds stats array from flat fields', () => {
    const result = characterItemToTooltipData(baseItem)
    expect(result.stats).toHaveLength(2)
    expect(result.stats[0]).toEqual({ type: 4, value: 20 })
    expect(result.stats[1]).toEqual({ type: 7, value: 15 })
  })

  it('skips empty stat slots', () => {
    const item: CharacterItem = {
      ...baseItem,
      stat_type1: 4,
      stat_value1: 20,
      stat_type2: 0, // type 0 with value should be skipped
      stat_value2: 0,
      stat_type3: undefined,
      stat_value3: undefined,
    }
    const result = characterItemToTooltipData(item)
    expect(result.stats).toHaveLength(1)
  })

  it('maps damage fields', () => {
    const result = characterItemToTooltipData(baseItem)
    expect(result.dmgMin1).toBe(36)
    expect(result.dmgMax1).toBe(68)
    expect(result.dmgType1).toBe(0)
    expect(result.delay).toBe(1900)
  })

  it('maps enchantment texts', () => {
    const item: CharacterItem = {
      ...baseItem,
      enchantmentTexts: ['+30 Spell Power', '+15 Stamina'],
    }
    const result = characterItemToTooltipData(item)
    expect(result.enchantmentTexts).toEqual(['+30 Spell Power', '+15 Stamina'])
  })

  it('maps resistance fields', () => {
    const item: CharacterItem = {
      ...baseItem,
      holy_res: 10,
      fire_res: 20,
      nature_res: 5,
      frost_res: 15,
      shadow_res: 8,
      arcane_res: 12,
    }
    const result = characterItemToTooltipData(item)
    expect(result.holyRes).toBe(10)
    expect(result.fireRes).toBe(20)
    expect(result.natureRes).toBe(5)
    expect(result.frostRes).toBe(15)
    expect(result.shadowRes).toBe(8)
    expect(result.arcaneRes).toBe(12)
  })

  it('returns empty subclass name for non-weapon/armor items', () => {
    const miscItem: CharacterItem = {
      ...baseItem,
      itemClass: 0, // Consumable
      itemSubclass: 0,
    }
    const result = characterItemToTooltipData(miscItem)
    expect(result.subclassName).toBe('')
  })
})

// ─── shopItemToTooltipData ──────────────────────────────────────────────────────

describe('shopItemToTooltipData', () => {
  const baseShopItem: ShopItemDetails = {
    entry: 12345,
    name: 'Ashbringer',
    quality: 5,
    itemLevel: 100,
    requiredLevel: 60,
    class: 2,
    subclass: 7,
    inventoryType: 17,
    inventoryTypeName: 'Two-Hand',
    subclassName: 'Sword',
    bonding: 1,
    maxCount: 1,
    armor: 0,
    block: 0,
    dmgMin1: 200,
    dmgMax1: 300,
    dmgType1: 0,
    delay: 3500,
    stats: [
      { type: 4, value: 40 },
      { type: 7, value: 30 },
    ],
    holyRes: 0,
    fireRes: 0,
    natureRes: 0,
    frostRes: 0,
    shadowRes: 0,
    arcaneRes: 0,
    maxDurability: 120,
    description: 'The Ashbringer',
    sellPrice: 500000,
    icon: 'inv_sword_ashbringer',
    buyPrice: 1000000,
    displayId: 200,
  }

  it('maps basic fields correctly', () => {
    const result = shopItemToTooltipData(baseShopItem)
    expect(result.name).toBe('Ashbringer')
    expect(result.quality).toBe(5)
    expect(result.itemLevel).toBe(100)
    expect(result.requiredLevel).toBe(60)
  })

  it('maps class/subclass from shop format', () => {
    const result = shopItemToTooltipData(baseShopItem)
    expect(result.itemClass).toBe(2)
    expect(result.itemSubclass).toBe(7)
  })

  it('passes through pre-resolved names', () => {
    const result = shopItemToTooltipData(baseShopItem)
    expect(result.inventoryTypeName).toBe('Two-Hand')
    expect(result.subclassName).toBe('Sword')
  })

  it('maps stats array directly', () => {
    const result = shopItemToTooltipData(baseShopItem)
    expect(result.stats).toHaveLength(2)
    expect(result.stats[0]).toEqual({ type: 4, value: 40 })
  })

  it('maps shop-specific fields', () => {
    const result = shopItemToTooltipData(baseShopItem)
    expect(result.bonding).toBe(1)
    expect(result.maxCount).toBe(1)
    expect(result.maxDurability).toBe(120)
    expect(result.sellPrice).toBe(500000)
    expect(result.description).toBe('The Ashbringer')
  })

  it('maps socket fields when present', () => {
    const socketedItem: ShopItemDetails = {
      ...baseShopItem,
      socketColor1: 1,
      socketColor2: 2,
      socketColor3: 4,
      socketBonusName: '+4 Strength',
    }
    const result = shopItemToTooltipData(socketedItem)
    expect(result.socketColor1).toBe(1)
    expect(result.socketColor2).toBe(2)
    expect(result.socketColor3).toBe(4)
    expect(result.socketBonusName).toBe('+4 Strength')
  })
})
