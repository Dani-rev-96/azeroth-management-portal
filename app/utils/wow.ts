/**
 * WoW-specific helper utilities
 * Constants and formatters for World of Warcraft data
 */

// ==========================================================================
// Class Data
// ==========================================================================

export const WOW_CLASSES: Record<number, string> = {
  1: 'Warrior',
  2: 'Paladin',
  3: 'Hunter',
  4: 'Rogue',
  5: 'Priest',
  6: 'Death Knight',
  7: 'Shaman',
  8: 'Mage',
  9: 'Warlock',
  11: 'Druid',
}

export const WOW_CLASS_COLORS: Record<number, string> = {
  1: '#c79c6e',  // Warrior
  2: '#f58cba',  // Paladin
  3: '#abd473',  // Hunter
  4: '#fff569',  // Rogue
  5: '#ffffff',  // Priest
  6: '#c41f3b',  // Death Knight
  7: '#0070de',  // Shaman
  8: '#69ccf0',  // Mage
  9: '#9482c9',  // Warlock
  11: '#ff7d0a', // Druid
}

export const WOW_CLASS_ICONS: Record<number, string> = {
  1: '⚔️',  // Warrior
  2: '🛡️',  // Paladin
  3: '🏹',  // Hunter
  4: '🗡️',  // Rogue
  5: '✨',  // Priest
  6: '💀',  // Death Knight
  7: '⚡',  // Shaman
  8: '❄️',  // Mage
  9: '🔥',  // Warlock
  11: '🐻', // Druid
}

export function getClassName(classId: number): string {
  return WOW_CLASSES[classId] || `Class ${classId}`
}

export function getClassColor(classId: number): string {
  return WOW_CLASS_COLORS[classId] || '#ffffff'
}

export function getClassIcon(classId: number): string {
  return WOW_CLASS_ICONS[classId] || '❓'
}

// ==========================================================================
// Race Data
// ==========================================================================

export const WOW_RACES: Record<number, string> = {
  1: 'Human',
  2: 'Orc',
  3: 'Dwarf',
  4: 'Night Elf',
  5: 'Undead',
  6: 'Tauren',
  7: 'Gnome',
  8: 'Troll',
  9: 'Goblin',
  10: 'Blood Elf',
  11: 'Draenei',
  22: 'Worgen',
}

export const WOW_RACE_ICONS: Record<number, string> = {
  1: '👤',   // Human
  2: '💪',   // Orc
  3: '⛏️',   // Dwarf
  4: '🌙',   // Night Elf
  5: '☠️',   // Undead
  6: '🐃',   // Tauren
  7: '🔧',   // Gnome
  8: '🏝️',   // Troll
  9: '💰',   // Goblin
  10: '✨',  // Blood Elf
  11: '🔷',  // Draenei
  22: '🐺',  // Worgen
}

export const ALLIANCE_RACES = [1, 3, 4, 7, 11, 22] // Human, Dwarf, Night Elf, Gnome, Draenei, Worgen
export const HORDE_RACES = [2, 5, 6, 8, 9, 10]    // Orc, Undead, Tauren, Troll, Goblin, Blood Elf

export function getRaceName(raceId: number): string {
  return WOW_RACES[raceId] || `Race ${raceId}`
}

export function getRaceIcon(raceId: number): string {
  return WOW_RACE_ICONS[raceId] || '❓'
}

export function getFaction(raceId: number): 'Alliance' | 'Horde' | 'Unknown' {
  if (ALLIANCE_RACES.includes(raceId)) return 'Alliance'
  if (HORDE_RACES.includes(raceId)) return 'Horde'
  return 'Unknown'
}

export function getFactionColor(raceId: number): string {
  const faction = getFaction(raceId)
  return faction === 'Alliance' ? '#0078ff' : faction === 'Horde' ? '#b30000' : '#808080'
}

// ==========================================================================
// Item Quality
// ==========================================================================

export const ITEM_QUALITY: Record<number, { name: string; color: string }> = {
  0: { name: 'Poor', color: '#9d9d9d' },
  1: { name: 'Common', color: '#ffffff' },
  2: { name: 'Uncommon', color: '#1eff00' },
  3: { name: 'Rare', color: '#0070dd' },
  4: { name: 'Epic', color: '#a335ee' },
  5: { name: 'Legendary', color: '#ff8000' },
  6: { name: 'Artifact', color: '#e6cc80' },
  7: { name: 'Heirloom', color: '#00ccff' },
}

export function getQualityName(quality: number): string {
  return ITEM_QUALITY[quality]?.name || 'Unknown'
}

export function getQualityColor(quality: number): string {
  return ITEM_QUALITY[quality]?.color || '#ffffff'
}

// ==========================================================================
// Stat Types
// ==========================================================================

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
  16: 'Hit Melee Rating',
  17: 'Hit Ranged Rating',
  18: 'Hit Spell Rating',
  19: 'Crit Melee Rating',
  20: 'Crit Ranged Rating',
  21: 'Crit Spell Rating',
  28: 'Haste Melee Rating',
  29: 'Haste Ranged Rating',
  30: 'Haste Spell Rating',
  31: 'Hit Rating',
  32: 'Crit Rating',
  35: 'Resilience Rating',
  36: 'Haste Rating',
  37: 'Expertise Rating',
  38: 'Attack Power',
  39: 'Ranged Attack Power',
  40: 'Feral Attack Power',
  41: 'Spell Healing',
  42: 'Spell Damage',
  43: 'Mana Regeneration',
  44: 'Armor Penetration Rating',
  45: 'Spell Power',
  46: 'Health Regen',
  47: 'Spell Penetration',
  48: 'Block Value',
}

export function getStatName(statType: number): string {
  return STAT_TYPES[statType] || `Unknown (${statType})`
}

// ==========================================================================
// Formatting Utilities
// ==========================================================================

/**
 * Format copper amount to gold/silver/copper display
 */
export function formatGold(copper: number): string {
  if (!copper || copper <= 0) return '0g'

  const gold = Math.floor(copper / 10000)
  const silver = Math.floor((copper % 10000) / 100)
  const copperRemainder = copper % 100

  const parts: string[] = []
  if (gold > 0) parts.push(`${gold.toLocaleString()}g`)
  if (silver > 0) parts.push(`${silver}s`)
  if (copperRemainder > 0 && gold === 0) parts.push(`${copperRemainder}c`)

  return parts.join(' ') || '0g'
}

/**
 * Format copper amount to full gold/silver/copper display (always shows all parts)
 */
export function formatMoney(copper: number): string {
  const gold = Math.floor(copper / 10000)
  const silver = Math.floor((copper % 10000) / 100)
  const copperRemainder = copper % 100

  const parts: string[] = []
  if (gold > 0) parts.push(`${gold}g`)
  if (silver > 0 || gold > 0) parts.push(`${silver}s`)
  parts.push(`${copperRemainder}c`)

  return parts.join(' ')
}

/**
 * Format playtime seconds to human readable string
 */
export function formatPlaytime(seconds: number): string {
  if (!seconds || seconds <= 0) return '0h'

  const hours = Math.floor(seconds / 3600)
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  const minutes = Math.floor((seconds % 3600) / 60)

  if (days > 0) {
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
  if (hours > 0) {
    return `${hours}h`
  }
  return `${minutes}m`
}

/**
 * Format playtime with full breakdown
 */
export function formatPlaytimeFull(seconds: number): string {
  if (!seconds || seconds <= 0) return '0 hours'

  const hours = Math.floor(seconds / 3600)
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24

  if (days > 0) {
    return `${days} days, ${remainingHours} hours`
  }
  return `${hours} hours`
}

/**
 * Format file size in bytes to human readable
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)} ${units[i]}`
}

/**
 * Format date to localized string
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '-'

  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'

  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format date to relative time (e.g., "2 hours ago")
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '-'

  const d = typeof date === 'string' ? new Date(date) : date
  if (isNaN(d.getTime())) return '-'

  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHours = Math.floor(diffMin / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 30) return formatDate(date)
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffMin > 0) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`
  return 'Just now'
}

// ==========================================================================
// Equipment Slots
// ==========================================================================

export const EQUIPMENT_SLOTS: Record<number, string> = {
  0: 'Head',
  1: 'Neck',
  2: 'Shoulder',
  3: 'Shirt',
  4: 'Chest',
  5: 'Waist',
  6: 'Legs',
  7: 'Feet',
  8: 'Wrist',
  9: 'Hands',
  10: 'Ring 1',
  11: 'Ring 2',
  12: 'Trinket 1',
  13: 'Trinket 2',
  14: 'Back',
  15: 'Main Hand',
  16: 'Off Hand',
  17: 'Ranged',
  18: 'Tabard',
}

export function getSlotName(slotId: number): string {
  return EQUIPMENT_SLOTS[slotId] || `Slot ${slotId}`
}

// ==========================================================================
// Gender
// ==========================================================================

export const GENDERS: Record<number, string> = {
  0: 'Male',
  1: 'Female',
}

export function getGenderName(genderId: number): string {
  return GENDERS[genderId] || 'Unknown'
}
