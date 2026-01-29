import {
  getSpellItemEnchantmentBatch,
  getItemRandomSuffix,
  getItemRandomProperties,
  getSpellBatch,
  type SpellItemEnchantment
} from './dbc-db'

/**
 * Suffix factor lookup table based on item level
 * This approximates the values from RandPropPoints.dbc
 * The actual values vary by slot type, but this provides reasonable estimates
 * Values are for "Good" (green) quality items with standard slots
 */
const SUFFIX_FACTOR_BY_LEVEL: Record<number, number> = {
  // Levels 1-10
  1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 2, 10: 2,
  // Levels 11-20
  11: 2, 12: 2, 13: 2, 14: 3, 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 4,
  // Levels 21-30
  21: 4, 22: 4, 23: 4, 24: 5, 25: 5, 26: 5, 27: 6, 28: 6, 29: 6, 30: 7,
  // Levels 31-40
  31: 7, 32: 7, 33: 8, 34: 8, 35: 9, 36: 9, 37: 10, 38: 10, 39: 11, 40: 11,
  // Levels 41-50
  41: 12, 42: 12, 43: 13, 44: 14, 45: 14, 46: 15, 47: 16, 48: 16, 49: 17, 50: 18,
  // Levels 51-60
  51: 19, 52: 20, 53: 21, 54: 22, 55: 23, 56: 24, 57: 25, 58: 26, 59: 27, 60: 28,
  // Levels 61-70 (TBC)
  61: 30, 62: 32, 63: 34, 64: 36, 65: 38, 66: 40, 67: 42, 68: 44, 69: 47, 70: 50,
  // Levels 71-80 (WotLK)
  71: 53, 72: 56, 73: 59, 74: 62, 75: 66, 76: 70, 77: 74, 78: 78, 79: 82, 80: 86,
  // Higher levels (scaled estimate)
  81: 90, 82: 95, 83: 100, 84: 105, 85: 110, 86: 116, 87: 122, 88: 128, 89: 135, 90: 142,
}

/**
 * Get the suffix factor for calculating random suffix stat values
 * Formula: stat_value = floor(suffixFactor * allocationPct / 10000)
 */
export function getSuffixFactor(itemLevel: number): number {
  // Direct lookup if available
  if (SUFFIX_FACTOR_BY_LEVEL[itemLevel]) {
    return SUFFIX_FACTOR_BY_LEVEL[itemLevel]
  }

  // For levels beyond our table, extrapolate
  if (itemLevel > 90) {
    // Roughly 5-6% increase per level at high levels
    return Math.floor(142 * Math.pow(1.055, itemLevel - 90))
  }

  // For any missing levels, interpolate
  const levels = Object.keys(SUFFIX_FACTOR_BY_LEVEL).map(Number).sort((a, b) => a - b)
  let lower = 1, upper = 90
  for (const lvl of levels) {
    if (lvl <= itemLevel) lower = lvl
    if (lvl >= itemLevel) { upper = lvl; break }
  }

  if (lower === upper) {
    return SUFFIX_FACTOR_BY_LEVEL[lower] || 1
  }

  // Linear interpolation
  const lowerVal = SUFFIX_FACTOR_BY_LEVEL[lower] || 1
  const upperVal = SUFFIX_FACTOR_BY_LEVEL[upper] || 1
  const ratio = (itemLevel - lower) / (upper - lower)
  return Math.floor(lowerVal + (upperVal - lowerVal) * ratio)
}

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
 * Reverse mapping: stat name to type ID
 */
export const STAT_NAME_TO_TYPE: Record<string, number> = {
  'Mana': 0,
  'Health': 1,
  'Agility': 3,
  'Strength': 4,
  'Intellect': 5,
  'Spirit': 6,
  'Stamina': 7,
  'Defense Rating': 12,
  'Dodge Rating': 13,
  'Parry Rating': 14,
  'Block Rating': 15,
  'Melee Hit Rating': 16,
  'Ranged Hit Rating': 17,
  'Spell Hit Rating': 18,
  'Melee Critical Strike Rating': 19,
  'Ranged Critical Strike Rating': 20,
  'Spell Critical Strike Rating': 21,
  'Melee Haste Rating': 28,
  'Ranged Haste Rating': 29,
  'Spell Haste Rating': 30,
  'Hit Rating': 31,
  'Critical Strike Rating': 32,
  'Resilience Rating': 35,
  'Haste Rating': 36,
  'Expertise Rating': 37,
  'Attack Power': 38,
  'Ranged Attack Power': 39,
  'Mana Regeneration': 43,
  'Armor Penetration Rating': 44,
  'Spell Power': 45,
  'Spell Penetration': 47
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
    // Skip slots 7-11 (random properties/suffix) as these are handled separately via randomPropertyId
    if (slot >= 7 && slot <= 11) {
      continue
    }

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

  // Resolve spell effects - collect all spell IDs from effects
  const spellIdsToResolve: number[] = []
  for (const info of result) {
    for (const effect of info.effects) {
      if (effect.spellId && effect.spellId > 0) {
        spellIdsToResolve.push(effect.spellId)
      }
    }
  }

  // Batch fetch spells if any need resolving
  if (spellIdsToResolve.length > 0) {
    const spells = await getSpellBatch(spellIdsToResolve)
    const spellMap = new Map(spells.map(s => [s.id, s]))

    // Replace spell effects with resolved effects
    for (const info of result) {
      const newEffects: EnchantmentEffect[] = []
      for (const effect of info.effects) {
        if (effect.spellId && effect.spellId > 0) {
          const spell = spellMap.get(effect.spellId)
          if (spell) {
            const resolvedEffects = resolveSpellToEnchantmentEffects(spell)
            if (resolvedEffects.length > 0) {
              newEffects.push(...resolvedEffects)
            } else {
              // Fallback to spell name if we can't parse effects
              newEffects.push({
                type: effect.type,
                stat: spell.name || undefined,
                value: effect.value,
                spellId: effect.spellId
              })
            }
          } else {
            newEffects.push(effect)
          }
        } else {
          newEffects.push(effect)
        }
      }
      info.effects = newEffects
    }
  }

  return result
}

/**
 * Resolve a spell's aura effects into enchantment effects
 */
function resolveSpellToEnchantmentEffects(spell: {
  id: number
  name: string
  effect_aura_1: number
  effect_aura_2: number
  effect_aura_3: number
  effect_base_points_1: number
  effect_base_points_2: number
  effect_base_points_3: number
  effect_misc_value_1: number
  effect_misc_value_2: number
  effect_misc_value_3: number
}): EnchantmentEffect[] {
  const effects: EnchantmentEffect[] = []
  const seenStats = new Set<string>()

  for (let i = 1; i <= 3; i++) {
    const aura = spell[`effect_aura_${i}` as keyof typeof spell] as number
    const basePoints = spell[`effect_base_points_${i}` as keyof typeof spell] as number
    const miscValue = spell[`effect_misc_value_${i}` as keyof typeof spell] as number
    const value = basePoints + 1

    if (aura === 0) continue

    // SPELL_AURA_MOD_STAT (29) - misc_value is stat type, -1 = all stats
    if (aura === 29) {
      if (miscValue === -1) {
        // All stats - show as "All Stats"
        if (!seenStats.has('All Stats')) {
          seenStats.add('All Stats')
          effects.push({ type: ENCHANTMENT_TYPES.STAT, stat: 'All Stats', value })
        }
      } else {
        const statName = STAT_TYPES[miscValue] || `Stat ${miscValue}`
        if (!seenStats.has(statName)) {
          seenStats.add(statName)
          effects.push({ type: ENCHANTMENT_TYPES.STAT, stat: statName, value })
        }
      }
    }
    // SPELL_AURA_MOD_DAMAGE_DONE (13) / MOD_HEALING_DONE (135) - Spell Power
    else if (aura === 13 || aura === 135) {
      if (!seenStats.has('Spell Power')) {
        seenStats.add('Spell Power')
        effects.push({ type: ENCHANTMENT_TYPES.STAT, stat: 'Spell Power', value })
      }
    }
    // SPELL_AURA_MOD_ATTACK_POWER (99)
    else if (aura === 99) {
      if (!seenStats.has('Attack Power')) {
        seenStats.add('Attack Power')
        effects.push({ type: ENCHANTMENT_TYPES.STAT, stat: 'Attack Power', value })
      }
    }
    // SPELL_AURA_MOD_RANGED_ATTACK_POWER (124)
    else if (aura === 124) {
      if (!seenStats.has('Ranged Attack Power')) {
        seenStats.add('Ranged Attack Power')
        effects.push({ type: ENCHANTMENT_TYPES.STAT, stat: 'Ranged Attack Power', value })
      }
    }
    // SPELL_AURA_MOD_INCREASE_MOUNTED_SPEED (4) - Mount speed
    else if (aura === 4) {
      if (!seenStats.has('Mount Speed')) {
        seenStats.add('Mount Speed')
        effects.push({ type: ENCHANTMENT_TYPES.EQUIP_SPELL, stat: `+${value}% Mount Speed`, value: 0 })
      }
    }
    // SPELL_AURA_MOD_RATING (189) - Combat rating
    else if (aura === 189) {
      // miscValue is a bitmask of rating types, but often it's just one
      // Common ones: 1=defense, 2=dodge, 4=parry, 8=block, 16=meleehit, etc.
      const ratingNames: Record<number, string> = {
        1: 'Defense Rating', 2: 'Dodge Rating', 4: 'Parry Rating', 8: 'Block Rating',
        16: 'Melee Hit Rating', 32: 'Ranged Hit Rating', 64: 'Spell Hit Rating',
        128: 'Melee Crit Rating', 256: 'Ranged Crit Rating', 512: 'Spell Crit Rating',
        1024: 'Melee Haste Rating', 2048: 'Ranged Haste Rating', 4096: 'Spell Haste Rating',
        16384: 'Resilience Rating', 32768: 'Expertise Rating', 65536: 'Armor Penetration'
      }
      const statName = ratingNames[miscValue] || `Rating ${miscValue}`
      if (!seenStats.has(statName)) {
        seenStats.add(statName)
        effects.push({ type: ENCHANTMENT_TYPES.STAT, stat: statName, value })
      }
    }
    // SPELL_AURA_MOD_SKILL (115) - Skill bonus
    else if (aura === 115) {
      // miscValue is the skill ID
      effects.push({ type: ENCHANTMENT_TYPES.EQUIP_SPELL, stat: `+${value} Skill`, value: 0 })
    }
    // SPELL_AURA_MOD_THREAT (17) - Threat modifier
    else if (aura === 17) {
      const threatMod = value > 0 ? `+${value}%` : `${value}%`
      effects.push({ type: ENCHANTMENT_TYPES.EQUIP_SPELL, stat: `${threatMod} Threat`, value: 0 })
    }
    // SPELL_AURA_MOD_RESISTANCE (22) - Resistance
    else if (aura === 22) {
      const resistTypes = ['All Resistances', 'Holy Resistance', 'Fire Resistance', 'Nature Resistance', 'Frost Resistance', 'Shadow Resistance', 'Arcane Resistance']
      const resistName = resistTypes[miscValue] || `Resistance ${miscValue}`
      if (!seenStats.has(resistName)) {
        seenStats.add(resistName)
        effects.push({ type: ENCHANTMENT_TYPES.RESISTANCE, stat: resistName, value })
      }
    }
    // SPELL_AURA_MOD_INCREASE_SPEED (31) - Run speed
    else if (aura === 31) {
      effects.push({ type: ENCHANTMENT_TYPES.EQUIP_SPELL, stat: `+${value}% Run Speed`, value: 0 })
    }
    // SPELL_AURA_MOD_INCREASE_SWIM_SPEED (32) - Swim speed
    else if (aura === 32) {
      effects.push({ type: ENCHANTMENT_TYPES.EQUIP_SPELL, stat: `+${value}% Swim Speed`, value: 0 })
    }
  }

  return effects
}

/**
 * Get enchantments from random properties/suffix
 * @param randomPropertyId - Positive for ItemRandomProperties, negative for ItemRandomSuffix
 * @param itemLevel - The item level, used to look up suffix factor for random suffix items
 */
export async function getRandomEnchantments(
  randomPropertyId: number,
  itemLevel?: number
): Promise<EnchantmentInfo[]> {
  if (randomPropertyId === 0) return []

  const result: EnchantmentInfo[] = []

  if (randomPropertyId > 0) {
    // Random Properties (positive ID)
    // These enchantments typically have fixed values stored in effect_points_min/max
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
    // The stat values are calculated using: floor(suffixFactor * allocationPct / 10000)
    const suffix = await getItemRandomSuffix(-randomPropertyId)
    if (!suffix) return []

    // Get suffix factor from item level using lookup table
    const suffixFactor = itemLevel ? getSuffixFactor(itemLevel) : 0

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

        // For random suffixes, the enchantment's effect_points_min/max are 0
        // We need to calculate the actual value using: floor(suffixFactor * allocationPct / 10000)
        let effects = enchantmentToEffectsWithSuffixScaling(enchant, suffixFactor, allocation)

        result.push({
          id: enchant.id,
          name: suffix.name || suffix.internal_name || '',
          slot: -1, // Random suffix
          effects
        })
      }
    }
  }

  return result
}

/**
 * Convert enchantment to effects with suffix scaling for random suffix items
 * The stat value is calculated as: floor(suffixFactor * allocationPct / 10000)
 */
function enchantmentToEffectsWithSuffixScaling(
  enchant: SpellItemEnchantment,
  suffixFactor: number,
  allocationPct: number
): EnchantmentEffect[] {
  const effects: EnchantmentEffect[] = []
  const calculatedValue = Math.floor(suffixFactor * allocationPct / 10000)

  for (let i = 1; i <= 3; i++) {
    const effectType = enchant[`effect_${i}` as keyof SpellItemEnchantment] as number
    const arg = enchant[`effect_arg_${i}` as keyof SpellItemEnchantment] as number

    if (effectType === ENCHANTMENT_TYPES.NONE) continue

    // For random suffixes, the value comes from the calculation, not the enchantment record
    const value = calculatedValue

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
 * Format enchantment effects as readable text
 */
export function formatEnchantmentEffect(effect: EnchantmentEffect): string {
  if (effect.stat) {
    // If value is 0 or stat already includes the value (like "+4% Mount Speed"), just return stat
    if (effect.value === 0 || effect.stat.startsWith('+') || effect.stat.startsWith('-')) {
      return effect.stat
    }
    return `+${effect.value} ${effect.stat}`
  }
  if (effect.spellId) {
    return `Spell ${effect.spellId}`
  }
  return `Effect ${effect.type}: ${effect.value}`
}

/**
 * Item spell effect parsed from item_template spell fields
 */
export interface ItemSpellEffect {
  spellId: number
  trigger: number // 0=Use, 1=Equip, 2=Chance on Hit
  stat?: string
  value?: number
  description?: string
}

/**
 * Spell effect types that grant stats
 * Effect ID 13 = Add Modifier
 * Effect ID 99 = Mod Stat
 */
const SPELL_EFFECT_MOD_STAT = 99

/**
 * Aura types that grant stats
 * Aura 13 = Mod Damage Done (spell power)
 * Aura 22 = Mod Resistance
 * Aura 29 = Mod Stat
 * Aura 99 = Mod Attack Power
 * Aura 124 = Mod Ranged Attack Power
 */
const STAT_GRANTING_AURAS: Record<number, string> = {
  13: 'Spell Power',      // SPELL_AURA_MOD_DAMAGE_DONE - actually spell damage/healing
  22: 'Resistance',       // SPELL_AURA_MOD_RESISTANCE
  29: 'Stat',             // SPELL_AURA_MOD_STAT - generic stat mod, uses misc value
  99: 'Attack Power',     // SPELL_AURA_MOD_ATTACK_POWER
  124: 'Ranged Attack Power',
  135: 'Spell Power',     // SPELL_AURA_MOD_HEALING_DONE (converted to spell power in WotLK)
}

/**
 * Get stat-granting effects from item spells
 * Returns effects for "Equip: Increases X by Y" type bonuses
 */
export async function getItemSpellEffects(
  spellIds: { spellId: number; trigger: number }[]
): Promise<ItemSpellEffect[]> {
  // Filter to only equip effects (trigger = 1) with valid spell IDs
  const equipSpells = spellIds.filter(s => s.trigger === 1 && s.spellId > 0)
  if (equipSpells.length === 0) return []

  const ids = equipSpells.map(s => s.spellId)
  const spells = await getSpellBatch(ids)

  const effects: ItemSpellEffect[] = []

  for (const spell of spells) {
    // Track stats already added for this spell to avoid duplicates
    // (e.g., spell power from both MOD_DAMAGE_DONE and MOD_HEALING_DONE)
    const seenStats = new Set<string>()

    // Check each of the 3 spell effects
    for (let i = 1; i <= 3; i++) {
      const aura = spell[`effect_aura_${i}` as keyof typeof spell] as number
      const basePoints = spell[`effect_base_points_${i}` as keyof typeof spell] as number
      const miscValue = spell[`effect_misc_value_${i}` as keyof typeof spell] as number

      // Check if this is a stat-granting aura
      if (aura === 13 || aura === 135) {
        // Spell Power / Healing (SPELL_AURA_MOD_DAMAGE_DONE / MOD_HEALING_DONE)
        // In WotLK these are unified as Spell Power - only add once per spell
        if (!seenStats.has('Spell Power')) {
          seenStats.add('Spell Power')
          effects.push({
            spellId: spell.id,
            trigger: 1,
            stat: 'Spell Power',
            value: basePoints + 1, // Base points is typically value - 1
          })
        }
      } else if (aura === 29) {
        // Mod Stat - misc value determines which stat
        const statName = STAT_TYPES[miscValue] || `Stat ${miscValue}`
        if (!seenStats.has(statName)) {
          seenStats.add(statName)
          effects.push({
            spellId: spell.id,
            trigger: 1,
            stat: statName,
            value: basePoints + 1,
          })
        }
      } else if (aura === 99 || aura === 124) {
        // Attack Power / Ranged Attack Power
        const statName = aura === 124 ? 'Ranged Attack Power' : 'Attack Power'
        if (!seenStats.has(statName)) {
          seenStats.add(statName)
          effects.push({
            spellId: spell.id,
            trigger: 1,
            stat: statName,
            value: basePoints + 1,
          })
        }
      }
    }
  }

  return effects
}
