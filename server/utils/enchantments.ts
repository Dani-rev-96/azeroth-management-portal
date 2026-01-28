import {
  getSpellItemEnchantmentBatch,
  getItemRandomSuffix,
  getItemRandomProperties,
  type SpellItemEnchantment
} from './dbc-db'

/**
 * Enchantment slot types
 */
export const ENCHANTMENT_SLOTS = {
  PERMANENT: 0,
  TEMPORARY: 1,
  SOCKET_1: 2,
  SOCKET_2: 3,
  SOCKET_3: 4,
  BONUS: 5,
  PRISMATIC: 6,
  // Random properties/suffix use slots 7-11
} as const

/**
 * Enchantment effect types (from SpellItemEnchantmentType.dbc)
 */
export const ENCHANTMENT_TYPES = {
  NONE: 0,
  COMBAT_SPELL: 1,
  DAMAGE: 2,
  EQUIP_SPELL: 3,
  RESISTANCE: 4,
  STAT: 5,
  TOTEM: 6,
  USE_SPELL: 7,
  PRISMATIC_SOCKET: 8
} as const

/**
 * Stat types for enchantment effects
 */
export const STAT_TYPES: Record<number, string> = {
  0: 'Mana',
  1: 'Health',
  3: 'Agility',
  4: 'Strength',
  5: 'Intellect',
  6: 'Spirit',
  7: 'Stamina',
  12: 'Defense Rating',
  13: 'Dodge Rating',
  14: 'Parry Rating',
  15: 'Block Rating',
  16: 'Melee Hit Rating',
  17: 'Ranged Hit Rating',
  18: 'Spell Hit Rating',
  19: 'Melee Critical Strike Rating',
  20: 'Ranged Critical Strike Rating',
  21: 'Spell Critical Strike Rating',
  28: 'Melee Haste Rating',
  29: 'Ranged Haste Rating',
  30: 'Spell Haste Rating',
  31: 'Hit Rating',
  32: 'Critical Strike Rating',
  35: 'Resilience Rating',
  36: 'Haste Rating',
  37: 'Expertise Rating',
  38: 'Attack Power',
  39: 'Ranged Attack Power',
  43: 'Mana Regeneration',
  44: 'Armor Penetration Rating',
  45: 'Spell Power',
  47: 'Spell Penetration'
}

/**
 * Parsed enchantment from item_instance.enchantments field
 */
export interface ParsedEnchantment {
  slot: number
  enchantId: number
  duration: number
  charges: number
}

/**
 * Enchantment effect with human-readable stat
 */
export interface EnchantmentEffect {
  type: number
  stat?: string
  value: number
  spellId?: number
}

/**
 * Complete enchantment info with effects
 */
export interface EnchantmentInfo {
  id: number
  name: string
  slot: number
  effects: EnchantmentEffect[]
  duration?: number
  charges?: number
}

/**
 * Parse the enchantments field from item_instance table
 * Format: 36 numbers = 12 slots × (enchantId, duration, charges)
 * Note: Some databases may have trailing/leading spaces resulting in extra empty values
 */
export function parseEnchantmentsField(enchantmentsString: string): ParsedEnchantment[] {
  // Trim and split, then filter out empty strings
  const numbers = enchantmentsString.trim().split(/\s+/).map(n => parseInt(n, 10)).filter(n => !isNaN(n))

  if (numbers.length !== 36) {
    console.warn(`[Enchantments] Invalid field length: ${numbers.length}, expected 36. Raw: "${enchantmentsString.substring(0, 50)}..."`)
    // Try to work with what we have if it's close
    if (numbers.length < 30 || numbers.length > 40) {
      return []
    }
  }

  const enchantments: ParsedEnchantment[] = []

  for (let slot = 0; slot < 12; slot++) {
    const idx = slot * 3
    const enchantId = numbers[idx] ?? 0
    const duration = numbers[idx + 1] ?? 0
    const charges = numbers[idx + 2] ?? 0

    if (enchantId && enchantId > 0) {
      enchantments.push({ slot, enchantId, duration, charges })
    }
  }

  return enchantments
}

/**
 * Convert enchantment DB record to effects
 */
function enchantmentToEffects(enchant: SpellItemEnchantment): EnchantmentEffect[] {
  const effects: EnchantmentEffect[] = []

  for (let i = 1; i <= 3; i++) {
    const effectType = enchant[`effect_${i}` as keyof SpellItemEnchantment] as number
    const minPoints = enchant[`effect_points_min_${i}` as keyof SpellItemEnchantment] as number
    const maxPoints = enchant[`effect_points_max_${i}` as keyof SpellItemEnchantment] as number
    const arg = enchant[`effect_arg_${i}` as keyof SpellItemEnchantment] as number

    if (effectType === ENCHANTMENT_TYPES.NONE) continue

    const value = maxPoints || minPoints

    if (effectType === ENCHANTMENT_TYPES.STAT) {
      // Stat enchantment - arg is the stat type
      const statName = STAT_TYPES[arg] || `Stat ${arg}`
      effects.push({
        type: effectType,
        stat: statName,
        value
      })
    } else if (effectType === ENCHANTMENT_TYPES.RESISTANCE) {
      // Resistance - arg is school (0=physical, 1=holy, 2=fire, etc.)
      const resistTypes = ['Armor', 'Holy Resistance', 'Fire Resistance', 'Nature Resistance', 'Frost Resistance', 'Shadow Resistance', 'Arcane Resistance']
      const resistName = resistTypes[arg] || `Resistance ${arg}`
      effects.push({
        type: effectType,
        stat: resistName,
        value
      })
    } else if (effectType === ENCHANTMENT_TYPES.DAMAGE) {
      // Weapon damage
      effects.push({
        type: effectType,
        stat: 'Weapon Damage',
        value
      })
    } else if (effectType === ENCHANTMENT_TYPES.COMBAT_SPELL ||
               effectType === ENCHANTMENT_TYPES.EQUIP_SPELL ||
               effectType === ENCHANTMENT_TYPES.USE_SPELL) {
      // Spell effect - arg is spell ID
      effects.push({
        type: effectType,
        value,
        spellId: arg
      })
    } else {
      // Generic effect
      effects.push({
        type: effectType,
        value
      })
    }
  }

  return effects
}

/**
 * Get full enchantment info for item enchantments
 */
export async function getEnchantmentInfo(parsedEnchants: ParsedEnchantment[]): Promise<EnchantmentInfo[]> {
  if (parsedEnchants.length === 0) return []

  // Get all enchantment data
  const enchantIds = parsedEnchants.map(e => e.enchantId)
  const enchantRecords = await getSpellItemEnchantmentBatch(enchantIds)

  // Map to lookup
  const enchantMap = new Map<number, SpellItemEnchantment>()
  enchantRecords.forEach(e => enchantMap.set(e.id, e))

  // Build result
  const result: EnchantmentInfo[] = []

  for (const parsed of parsedEnchants) {
    const enchant = enchantMap.get(parsed.enchantId)
    if (!enchant) continue

    const effects = enchantmentToEffects(enchant)

    result.push({
      id: enchant.id,
      name: enchant.name,
      slot: parsed.slot,
      effects,
      duration: parsed.duration > 0 ? parsed.duration : undefined,
      charges: parsed.charges > 0 ? parsed.charges : undefined
    })
  }

  return result
}

/**
 * Get enchantments from random properties/suffix
 */
export async function getRandomEnchantments(
  randomPropertyId: number,
  itemLevel?: number
): Promise<EnchantmentInfo[]> {
  if (randomPropertyId === 0) return []

  const result: EnchantmentInfo[] = []

  if (randomPropertyId > 0) {
    // Random Properties
    const props = await getItemRandomProperties(randomPropertyId)
    if (!props) return []

    const enchantIds = [
      props.enchantment_1,
      props.enchantment_2,
      props.enchantment_3,
      props.enchantment_4,
      props.enchantment_5
    ].filter(id => id > 0)

    if (enchantIds.length > 0) {
      const enchants = await getSpellItemEnchantmentBatch(enchantIds)
      for (const enchant of enchants) {
        result.push({
          id: enchant.id,
          name: props.name,
          slot: -1, // Random property
          effects: enchantmentToEffects(enchant)
        })
      }
    }
  } else if (randomPropertyId < 0) {
    // Random Suffix (negative ID)
    const suffix = await getItemRandomSuffix(-randomPropertyId)
    if (!suffix) return []

    const enchantIds = [
      suffix.enchantment_1,
      suffix.enchantment_2,
      suffix.enchantment_3,
      suffix.enchantment_4,
      suffix.enchantment_5
    ].filter(id => id > 0)

    if (enchantIds.length > 0) {
      const enchants = await getSpellItemEnchantmentBatch(enchantIds)
      const allocations = [
        suffix.allocation_pct_1,
        suffix.allocation_pct_2,
        suffix.allocation_pct_3,
        suffix.allocation_pct_4,
        suffix.allocation_pct_5
      ]

      for (let i = 0; i < enchants.length; i++) {
        const enchant = enchants[i]
        if (!enchant) continue

        const allocation = allocations[i] || 0

        // Scale effects by allocation percentage and item level
        let effects = enchantmentToEffects(enchant)

        // Apply allocation scaling if itemLevel is provided
        if (itemLevel && allocation > 0) {
          effects = effects.map(effect => ({
            ...effect,
            value: Math.floor(effect.value * allocation / 10000)
          }))
        }

        result.push({
          id: enchant.id,
          name: suffix.name,
          slot: -1, // Random suffix
          effects
        })
      }
    }
  }

  return result
}

/**
 * Format enchantment effects as readable text
 */
export function formatEnchantmentEffect(effect: EnchantmentEffect): string {
  if (effect.stat) {
    return `+${effect.value} ${effect.stat}`
  }
  if (effect.spellId) {
    return `Spell ${effect.spellId}`
  }
  return `Effect ${effect.type}: ${effect.value}`
}
