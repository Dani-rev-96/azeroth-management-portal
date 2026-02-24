import { describe, it, expect } from 'vitest'

// ─── Dressingroom: Character Ownership Logic ────────────────────────────────────

describe('Dressingroom: Character Ownership Verification', () => {
  interface AccountMapping {
    external_id: string
    wow_account_id: number
    display_name: string
  }

  function verifyCharacterOwnership(
    mappings: AccountMapping[],
    characterAccountId: number
  ): boolean {
    const userAccountIds = mappings.map(m => m.wow_account_id)
    return userAccountIds.includes(characterAccountId)
  }

  const userMappings: AccountMapping[] = [
    { external_id: 'user-1', wow_account_id: 100, display_name: 'User1' },
    { external_id: 'user-1', wow_account_id: 200, display_name: 'User1Alt' },
  ]

  it('returns true when character belongs to user account', () => {
    expect(verifyCharacterOwnership(userMappings, 100)).toBe(true)
    expect(verifyCharacterOwnership(userMappings, 200)).toBe(true)
  })

  it('returns false for unowned character', () => {
    expect(verifyCharacterOwnership(userMappings, 300)).toBe(false)
    expect(verifyCharacterOwnership(userMappings, 999)).toBe(false)
  })

  it('returns false with empty mappings', () => {
    expect(verifyCharacterOwnership([], 100)).toBe(false)
  })
})

// ─── Dressingroom: Money Operations ─────────────────────────────────────────────

describe('Dressingroom: Money Mode Logic', () => {
  const GOLD_CAP = 2147483647 // max signed 32-bit int (copper)

  function calculateNewMoney(
    currentMoney: number,
    amount: number,
    mode: 'set' | 'add' | 'remove'
  ): number {
    switch (mode) {
      case 'set':
        return Math.max(0, Math.min(amount, GOLD_CAP))
      case 'add':
        return Math.min(currentMoney + amount, GOLD_CAP)
      case 'remove':
        return Math.max(currentMoney - amount, 0)
      default:
        return currentMoney
    }
  }

  it('set mode: sets exact amount', () => {
    expect(calculateNewMoney(5000, 10000, 'set')).toBe(10000)
  })

  it('set mode: clamps to gold cap', () => {
    expect(calculateNewMoney(0, GOLD_CAP + 1, 'set')).toBe(GOLD_CAP)
  })

  it('set mode: floors at 0', () => {
    expect(calculateNewMoney(5000, -100, 'set')).toBe(0)
  })

  it('add mode: adds to current', () => {
    expect(calculateNewMoney(5000, 3000, 'add')).toBe(8000)
  })

  it('add mode: caps at gold cap', () => {
    expect(calculateNewMoney(GOLD_CAP - 100, 200, 'add')).toBe(GOLD_CAP)
  })

  it('remove mode: subtracts from current', () => {
    expect(calculateNewMoney(5000, 3000, 'remove')).toBe(2000)
  })

  it('remove mode: floors at 0', () => {
    expect(calculateNewMoney(1000, 5000, 'remove')).toBe(0)
  })

  it('remove mode: exact amount results in 0', () => {
    expect(calculateNewMoney(5000, 5000, 'remove')).toBe(0)
  })
})

// ─── Dressingroom: Level Validation ─────────────────────────────────────────────

describe('Dressingroom: Level Validation', () => {
  function validateLevel(level: number): boolean {
    return Number.isInteger(level) && level >= 1 && level <= 80
  }

  it('accepts valid levels', () => {
    expect(validateLevel(1)).toBe(true)
    expect(validateLevel(40)).toBe(true)
    expect(validateLevel(80)).toBe(true)
  })

  it('rejects level 0', () => {
    expect(validateLevel(0)).toBe(false)
  })

  it('rejects level above 80', () => {
    expect(validateLevel(81)).toBe(false)
  })

  it('rejects negative levels', () => {
    expect(validateLevel(-1)).toBe(false)
  })

  it('rejects floating point', () => {
    expect(validateLevel(10.5)).toBe(false)
  })
})

// ─── Dressingroom: Reputation Standing ──────────────────────────────────────────

describe('Dressingroom: Reputation Standing', () => {
  const STANDING_RANGES = {
    Hated: { min: -42000, max: -6001 },
    Hostile: { min: -6000, max: -3001 },
    Unfriendly: { min: -3000, max: -1 },
    Neutral: { min: 0, max: 2999 },
    Friendly: { min: 3000, max: 8999 },
    Honored: { min: 9000, max: 20999 },
    Revered: { min: 21000, max: 41999 },
    Exalted: { min: 42000, max: 42999 },
  }

  function getStandingName(standing: number): string {
    for (const [name, range] of Object.entries(STANDING_RANGES)) {
      if (standing >= range.min && standing <= range.max) return name
    }
    return 'Unknown'
  }

  it('identifies Hated standing', () => {
    expect(getStandingName(-42000)).toBe('Hated')
    expect(getStandingName(-10000)).toBe('Hated')
  })

  it('identifies Neutral standing', () => {
    expect(getStandingName(0)).toBe('Neutral')
    expect(getStandingName(2999)).toBe('Neutral')
  })

  it('identifies Exalted standing', () => {
    expect(getStandingName(42000)).toBe('Exalted')
    expect(getStandingName(42999)).toBe('Exalted')
  })

  it('identifies all intermediate standings', () => {
    expect(getStandingName(-5000)).toBe('Hostile')
    expect(getStandingName(-1000)).toBe('Unfriendly')
    expect(getStandingName(5000)).toBe('Friendly')
    expect(getStandingName(15000)).toBe('Honored')
    expect(getStandingName(30000)).toBe('Revered')
  })

  it('standing boundaries are continuous', () => {
    // Each range's max + 1 should equal the next range's min
    expect(STANDING_RANGES.Hated.max + 1).toBe(STANDING_RANGES.Hostile.min)
    expect(STANDING_RANGES.Hostile.max + 1).toBe(STANDING_RANGES.Unfriendly.min)
    expect(STANDING_RANGES.Unfriendly.max + 1).toBe(STANDING_RANGES.Neutral.min)
    expect(STANDING_RANGES.Neutral.max + 1).toBe(STANDING_RANGES.Friendly.min)
    expect(STANDING_RANGES.Friendly.max + 1).toBe(STANDING_RANGES.Honored.min)
    expect(STANDING_RANGES.Honored.max + 1).toBe(STANDING_RANGES.Revered.min)
    expect(STANDING_RANGES.Revered.max + 1).toBe(STANDING_RANGES.Exalted.min)
  })
})

// ─── Dressingroom: Title Bitmask ────────────────────────────────────────────────

describe('Dressingroom: Title Bitmask Operations', () => {
  // knownTitles is space-separated uint32 array, each bit = title ID
  function hasTitleKnown(knownTitles: string, titleId: number): boolean {
    const parts = knownTitles.split(' ').map(Number)
    const arrayIndex = Math.floor(titleId / 32)
    const bitIndex = titleId % 32
    if (arrayIndex >= parts.length) return false
    return (parts[arrayIndex] & (1 << bitIndex)) !== 0
  }

  function addTitle(knownTitles: string, titleId: number): string {
    const parts = knownTitles.split(' ').map(Number)
    const arrayIndex = Math.floor(titleId / 32)
    const bitIndex = titleId % 32
    while (parts.length <= arrayIndex) parts.push(0)
    parts[arrayIndex] |= (1 << bitIndex)
    return parts.join(' ')
  }

  function removeTitle(knownTitles: string, titleId: number): string {
    const parts = knownTitles.split(' ').map(Number)
    const arrayIndex = Math.floor(titleId / 32)
    const bitIndex = titleId % 32
    if (arrayIndex < parts.length) {
      parts[arrayIndex] &= ~(1 << bitIndex)
    }
    return parts.join(' ')
  }

  it('detects title at bit 0', () => {
    expect(hasTitleKnown('1 0 0', 0)).toBe(true) // bit 0 set
    expect(hasTitleKnown('0 0 0', 0)).toBe(false)
  })

  it('detects title at higher bit', () => {
    expect(hasTitleKnown('4 0 0', 2)).toBe(true) // bit 2 set (4 = 0b100)
    expect(hasTitleKnown('4 0 0', 1)).toBe(false) // bit 1 not set
  })

  it('detects title in second uint32', () => {
    expect(hasTitleKnown('0 1 0', 32)).toBe(true) // bit 0 of second word
    expect(hasTitleKnown('0 0 0', 32)).toBe(false)
  })

  it('adds a title', () => {
    const result = addTitle('0 0 0', 5)
    expect(hasTitleKnown(result, 5)).toBe(true)
  })

  it('removes a title', () => {
    const withTitle = addTitle('0 0 0', 5)
    const withoutTitle = removeTitle(withTitle, 5)
    expect(hasTitleKnown(withoutTitle, 5)).toBe(false)
  })

  it('add is idempotent', () => {
    const added1 = addTitle('0 0 0', 10)
    const added2 = addTitle(added1, 10)
    expect(added1).toBe(added2)
  })

  it('remove is idempotent', () => {
    const removed1 = removeTitle('0 0 0', 10)
    const removed2 = removeTitle(removed1, 10)
    expect(removed1).toBe(removed2)
  })

  it('adding multiple titles preserves all', () => {
    let titles = '0 0 0'
    titles = addTitle(titles, 1)
    titles = addTitle(titles, 5)
    titles = addTitle(titles, 33)
    expect(hasTitleKnown(titles, 1)).toBe(true)
    expect(hasTitleKnown(titles, 5)).toBe(true)
    expect(hasTitleKnown(titles, 33)).toBe(true)
    expect(hasTitleKnown(titles, 0)).toBe(false)
  })
})
