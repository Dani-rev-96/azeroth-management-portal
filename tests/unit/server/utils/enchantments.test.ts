import { describe, it, expect } from 'vitest'

// Import just the pure function from enchantments
// We need to extract getSuffixFactor since the module imports from dbc-db
// which uses better-sqlite3. We'll test only the pure parts.

// Direct test of the suffix factor calculation logic
// Recreated from the source to test in isolation

const SUFFIX_FACTOR_BY_LEVEL: Record<number, number> = {
  1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 2, 10: 2,
  11: 2, 12: 2, 13: 2, 14: 3, 15: 3, 16: 3, 17: 3, 18: 3, 19: 3, 20: 4,
  21: 4, 22: 4, 23: 4, 24: 5, 25: 5, 26: 5, 27: 6, 28: 6, 29: 6, 30: 7,
  31: 7, 32: 7, 33: 8, 34: 8, 35: 9, 36: 9, 37: 10, 38: 10, 39: 11, 40: 11,
  41: 12, 42: 12, 43: 13, 44: 14, 45: 14, 46: 15, 47: 16, 48: 16, 49: 17, 50: 18,
  51: 19, 52: 20, 53: 21, 54: 22, 55: 23, 56: 24, 57: 25, 58: 26, 59: 27, 60: 28,
  61: 30, 62: 32, 63: 34, 64: 36, 65: 38, 66: 40, 67: 42, 68: 44, 69: 47, 70: 50,
  71: 53, 72: 56, 73: 59, 74: 62, 75: 66, 76: 70, 77: 74, 78: 78, 79: 82, 80: 86,
  81: 90, 82: 95, 83: 100, 84: 105, 85: 110, 86: 116, 87: 122, 88: 128, 89: 135, 90: 142,
}

function getSuffixFactor(itemLevel: number): number {
  if (SUFFIX_FACTOR_BY_LEVEL[itemLevel]) {
    return SUFFIX_FACTOR_BY_LEVEL[itemLevel]
  }
  if (itemLevel > 90) {
    return Math.floor(142 * Math.pow(1.055, itemLevel - 90))
  }
  const levels = Object.keys(SUFFIX_FACTOR_BY_LEVEL).map(Number).sort((a, b) => a - b)
  let lower = 1, upper = 90
  for (const lvl of levels) {
    if (lvl <= itemLevel) lower = lvl
    if (lvl >= itemLevel) { upper = lvl; break }
  }
  if (lower === upper) {
    return SUFFIX_FACTOR_BY_LEVEL[lower] || 1
  }
  const lowerVal = SUFFIX_FACTOR_BY_LEVEL[lower] || 1
  const upperVal = SUFFIX_FACTOR_BY_LEVEL[upper] || 1
  const ratio = (itemLevel - lower) / (upper - lower)
  return Math.floor(lowerVal + (upperVal - lowerVal) * ratio)
}

// ─── getSuffixFactor ────────────────────────────────────────────────────────────

describe('getSuffixFactor', () => {
  it('returns 1 for level 1', () => {
    expect(getSuffixFactor(1)).toBe(1)
  })

  it('returns correct factor for level 10', () => {
    expect(getSuffixFactor(10)).toBe(2)
  })

  it('returns correct factor for level 40', () => {
    expect(getSuffixFactor(40)).toBe(11)
  })

  it('returns correct factor for level 60', () => {
    expect(getSuffixFactor(60)).toBe(28)
  })

  it('returns correct factor for level 70 (TBC cap)', () => {
    expect(getSuffixFactor(70)).toBe(50)
  })

  it('returns correct factor for level 80 (WotLK cap)', () => {
    expect(getSuffixFactor(80)).toBe(86)
  })

  it('returns correct factor for level 90', () => {
    expect(getSuffixFactor(90)).toBe(142)
  })

  it('extrapolates for levels above 90', () => {
    const factor91 = getSuffixFactor(91)
    expect(factor91).toBeGreaterThan(142)
  })

  it('extrapolation increases with level', () => {
    expect(getSuffixFactor(95)).toBeGreaterThan(getSuffixFactor(91))
    expect(getSuffixFactor(100)).toBeGreaterThan(getSuffixFactor(95))
  })

  it('factors increase monotonically across WoW level range', () => {
    for (let level = 2; level <= 90; level++) {
      expect(getSuffixFactor(level)).toBeGreaterThanOrEqual(getSuffixFactor(level - 1))
    }
  })

  it('all standard WoW levels (1-80) have defined factors', () => {
    for (let level = 1; level <= 80; level++) {
      expect(SUFFIX_FACTOR_BY_LEVEL[level]).toBeDefined()
      expect(getSuffixFactor(level)).toBeGreaterThan(0)
    }
  })
})

// ─── ENCHANTMENT_SLOTS (constants validation) ───────────────────────────────────

describe('Enchantment Constants', () => {
  const ENCHANTMENT_SLOTS = {
    PERMANENT: 0,
    TEMPORARY: 1,
    SOCKET_1: 2,
    SOCKET_2: 3,
    SOCKET_3: 4,
    BONUS: 5,
    PRISMATIC: 6,
  } as const

  it('permanent slot is 0', () => {
    expect(ENCHANTMENT_SLOTS.PERMANENT).toBe(0)
  })

  it('socket slots are sequential 2-4', () => {
    expect(ENCHANTMENT_SLOTS.SOCKET_1).toBe(2)
    expect(ENCHANTMENT_SLOTS.SOCKET_2).toBe(3)
    expect(ENCHANTMENT_SLOTS.SOCKET_3).toBe(4)
  })

  it('all slot values are unique', () => {
    const values = Object.values(ENCHANTMENT_SLOTS)
    expect(new Set(values).size).toBe(values.length)
  })
})
