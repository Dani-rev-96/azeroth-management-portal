import { describe, it, expect } from 'vitest'
import {
  getClassName,
  getClassColor,
  getClassIcon,
  getRaceName,
  getRaceIcon,
  getFaction,
  getFactionColor,
  getQualityName,
  getQualityColor,
  getStatName,
  formatGold,
  formatMoney,
  formatPlaytime,
  formatPlaytimeFull,
  formatFileSize,
  formatDate,
  formatRelativeTime,
  getSlotName,
  getGenderName,
  WOW_CLASSES,
  WOW_RACES,
  ALLIANCE_RACES,
  HORDE_RACES,
  ITEM_QUALITY,
  EQUIPMENT_SLOTS,
} from '../../../../app/utils/wow'

// ─── Class Data ─────────────────────────────────────────────────────────────────

describe('WoW Class Helpers', () => {
  describe('getClassName', () => {
    it('returns correct name for all classes', () => {
      expect(getClassName(1)).toBe('Warrior')
      expect(getClassName(2)).toBe('Paladin')
      expect(getClassName(3)).toBe('Hunter')
      expect(getClassName(4)).toBe('Rogue')
      expect(getClassName(5)).toBe('Priest')
      expect(getClassName(6)).toBe('Death Knight')
      expect(getClassName(7)).toBe('Shaman')
      expect(getClassName(8)).toBe('Mage')
      expect(getClassName(9)).toBe('Warlock')
      expect(getClassName(11)).toBe('Druid')
    })

    it('returns fallback for unknown class IDs', () => {
      expect(getClassName(0)).toBe('Class 0')
      expect(getClassName(10)).toBe('Class 10')
      expect(getClassName(99)).toBe('Class 99')
    })
  })

  describe('getClassColor', () => {
    it('returns correct color for Warrior', () => {
      expect(getClassColor(1)).toBe('#c79c6e')
    })

    it('returns correct color for Death Knight', () => {
      expect(getClassColor(6)).toBe('#c41f3b')
    })

    it('returns white for unknown class', () => {
      expect(getClassColor(99)).toBe('#ffffff')
    })
  })

  describe('getClassIcon', () => {
    it('returns icon for known class', () => {
      expect(getClassIcon(1)).toBe('⚔️')
    })

    it('returns question mark for unknown class', () => {
      expect(getClassIcon(99)).toBe('❓')
    })
  })

  it('WOW_CLASSES has 10 entries (no class 10)', () => {
    expect(Object.keys(WOW_CLASSES)).toHaveLength(10)
    expect(WOW_CLASSES[10]).toBeUndefined()
  })
})

// ─── Race Data ──────────────────────────────────────────────────────────────────

describe('WoW Race Helpers', () => {
  describe('getRaceName', () => {
    it('returns correct names', () => {
      expect(getRaceName(1)).toBe('Human')
      expect(getRaceName(2)).toBe('Orc')
      expect(getRaceName(10)).toBe('Blood Elf')
      expect(getRaceName(11)).toBe('Draenei')
    })

    it('returns fallback for unknown race IDs', () => {
      expect(getRaceName(99)).toBe('Race 99')
    })
  })

  describe('getRaceIcon', () => {
    it('returns icon for known race', () => {
      expect(getRaceIcon(1)).toBe('👤')
    })

    it('returns question mark for unknown race', () => {
      expect(getRaceIcon(99)).toBe('❓')
    })
  })

  describe('getFaction', () => {
    it('identifies Alliance races', () => {
      for (const raceId of ALLIANCE_RACES) {
        expect(getFaction(raceId)).toBe('Alliance')
      }
    })

    it('identifies Horde races', () => {
      for (const raceId of HORDE_RACES) {
        expect(getFaction(raceId)).toBe('Horde')
      }
    })

    it('returns Unknown for unrecognized race', () => {
      expect(getFaction(99)).toBe('Unknown')
      expect(getFaction(0)).toBe('Unknown')
    })
  })

  describe('getFactionColor', () => {
    it('returns blue for Alliance', () => {
      expect(getFactionColor(1)).toBe('#0078ff')
    })

    it('returns red for Horde', () => {
      expect(getFactionColor(2)).toBe('#b30000')
    })

    it('returns gray for unknown', () => {
      expect(getFactionColor(99)).toBe('#808080')
    })
  })

  it('ALLIANCE_RACES has correct count', () => {
    expect(ALLIANCE_RACES).toHaveLength(6)
  })

  it('HORDE_RACES has correct count', () => {
    expect(HORDE_RACES).toHaveLength(6)
  })

  it('faction race sets do not overlap', () => {
    const overlap = ALLIANCE_RACES.filter(r => HORDE_RACES.includes(r))
    expect(overlap).toHaveLength(0)
  })
})

// ─── Item Quality ───────────────────────────────────────────────────────────────

describe('Item Quality Helpers', () => {
  describe('getQualityName', () => {
    it('returns correct quality names', () => {
      expect(getQualityName(0)).toBe('Poor')
      expect(getQualityName(1)).toBe('Common')
      expect(getQualityName(2)).toBe('Uncommon')
      expect(getQualityName(3)).toBe('Rare')
      expect(getQualityName(4)).toBe('Epic')
      expect(getQualityName(5)).toBe('Legendary')
      expect(getQualityName(6)).toBe('Artifact')
      expect(getQualityName(7)).toBe('Heirloom')
    })

    it('returns Unknown for invalid quality', () => {
      expect(getQualityName(99)).toBe('Unknown')
      expect(getQualityName(-1)).toBe('Unknown')
    })
  })

  describe('getQualityColor', () => {
    it('returns gray for Poor', () => {
      expect(getQualityColor(0)).toBe('#9d9d9d')
    })

    it('returns purple for Epic', () => {
      expect(getQualityColor(4)).toBe('#a335ee')
    })

    it('returns white for unknown quality', () => {
      expect(getQualityColor(99)).toBe('#ffffff')
    })
  })

  it('ITEM_QUALITY covers all 8 WoW quality tiers', () => {
    expect(Object.keys(ITEM_QUALITY)).toHaveLength(8)
  })
})

// ─── Stat Types ─────────────────────────────────────────────────────────────────

describe('getStatName', () => {
  it('returns names for well-known stats', () => {
    expect(getStatName(3)).toBe('Agility')
    expect(getStatName(4)).toBe('Strength')
    expect(getStatName(5)).toBe('Intellect')
    expect(getStatName(7)).toBe('Stamina')
    expect(getStatName(45)).toBe('Spell Power')
  })

  it('returns Unknown pattern for unmapped stat types', () => {
    expect(getStatName(999)).toBe('Unknown (999)')
    expect(getStatName(2)).toBe('Unknown (2)')
  })
})

// ─── formatGold ─────────────────────────────────────────────────────────────────

describe('formatGold', () => {
  it('formats zero as "0g"', () => {
    expect(formatGold(0)).toBe('0g')
  })

  it('formats negative as "0g"', () => {
    expect(formatGold(-100)).toBe('0g')
  })

  it('formats copper-only amounts (no gold)', () => {
    expect(formatGold(50)).toBe('50c')
  })

  it('formats silver amounts', () => {
    expect(formatGold(100)).toBe('1s')
    expect(formatGold(500)).toBe('5s')
  })

  it('formats silver + copper (no gold)', () => {
    expect(formatGold(150)).toBe('1s 50c')
  })

  it('formats gold amounts', () => {
    expect(formatGold(10000)).toBe('1g')
    expect(formatGold(50000)).toBe('5g')
  })

  it('formats gold + silver', () => {
    expect(formatGold(10500)).toBe('1g 5s')
  })

  it('formats gold + silver (copper suppressed when gold present)', () => {
    // When gold > 0, copper part is suppressed
    expect(formatGold(10050)).toBe('1g')
  })

  it('formats large gold amounts with locale formatting', () => {
    const result = formatGold(100000000) // 10000g
    expect(result).toContain('g')
  })

  it('handles null/undefined gracefully', () => {
    expect(formatGold(null as any)).toBe('0g')
    expect(formatGold(undefined as any)).toBe('0g')
  })
})

// ─── formatMoney ────────────────────────────────────────────────────────────────

describe('formatMoney', () => {
  it('formats zero copper', () => {
    expect(formatMoney(0)).toBe('0c')
  })

  it('formats gold + silver + copper', () => {
    expect(formatMoney(12345)).toBe('1g 23s 45c')
  })

  it('shows silver as 0s when gold present but no silver', () => {
    expect(formatMoney(10050)).toBe('1g 0s 50c')
  })

  it('formats pure gold amount', () => {
    expect(formatMoney(10000)).toBe('1g 0s 0c')
  })
})

// ─── formatPlaytime ─────────────────────────────────────────────────────────────

describe('formatPlaytime', () => {
  it('returns "0h" for zero seconds', () => {
    expect(formatPlaytime(0)).toBe('0h')
  })

  it('returns "0h" for negative values', () => {
    expect(formatPlaytime(-100)).toBe('0h')
  })

  it('formats minutes', () => {
    expect(formatPlaytime(300)).toBe('5m')
    expect(formatPlaytime(60)).toBe('1m')
  })

  it('formats hours', () => {
    expect(formatPlaytime(3600)).toBe('1h')
    expect(formatPlaytime(7200)).toBe('2h')
  })

  it('formats days + hours', () => {
    expect(formatPlaytime(90000)).toBe('1d 1h') // 25 hours
  })

  it('formats exact days without remainder', () => {
    expect(formatPlaytime(86400)).toBe('1d')
  })

  it('handles null gracefully', () => {
    expect(formatPlaytime(null as any)).toBe('0h')
  })
})

// ─── formatPlaytimeFull ─────────────────────────────────────────────────────────

describe('formatPlaytimeFull', () => {
  it('returns "0 hours" for zero', () => {
    expect(formatPlaytimeFull(0)).toBe('0 hours')
  })

  it('formats hours', () => {
    expect(formatPlaytimeFull(3600)).toBe('1 hours')
    expect(formatPlaytimeFull(18000)).toBe('5 hours')
  })

  it('formats days + remaining hours', () => {
    expect(formatPlaytimeFull(90000)).toBe('1 days, 1 hours')
  })
})

// ─── formatFileSize ─────────────────────────────────────────────────────────────

describe('formatFileSize', () => {
  it('formats 0 bytes', () => {
    expect(formatFileSize(0)).toBe('0 B')
  })

  it('formats bytes', () => {
    expect(formatFileSize(500)).toBe('500 B')
  })

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1.0 KB')
    expect(formatFileSize(1536)).toBe('1.5 KB')
  })

  it('formats megabytes', () => {
    expect(formatFileSize(1048576)).toBe('1.0 MB')
  })

  it('formats gigabytes', () => {
    expect(formatFileSize(1073741824)).toBe('1.0 GB')
  })

  it('formats terabytes', () => {
    expect(formatFileSize(1099511627776)).toBe('1.0 TB')
  })
})

// ─── formatDate ─────────────────────────────────────────────────────────────────

describe('formatDate', () => {
  it('returns "-" for null', () => {
    expect(formatDate(null)).toBe('-')
  })

  it('returns "-" for undefined', () => {
    expect(formatDate(undefined)).toBe('-')
  })

  it('returns "-" for invalid date string', () => {
    expect(formatDate('not-a-date')).toBe('-')
  })

  it('formats a valid Date object', () => {
    const date = new Date('2024-01-15T10:30:00Z')
    const result = formatDate(date)
    expect(result).toContain('2024')
    expect(result).toContain('15')
  })

  it('formats a valid date string', () => {
    const result = formatDate('2024-06-15T12:00:00Z')
    expect(result).toContain('2024')
  })
})

// ─── formatRelativeTime ─────────────────────────────────────────────────────────

describe('formatRelativeTime', () => {
  it('returns "-" for null', () => {
    expect(formatRelativeTime(null)).toBe('-')
  })

  it('returns "-" for undefined', () => {
    expect(formatRelativeTime(undefined)).toBe('-')
  })

  it('returns "-" for invalid date', () => {
    expect(formatRelativeTime('invalid')).toBe('-')
  })

  it('returns "Just now" for very recent dates', () => {
    const now = new Date()
    expect(formatRelativeTime(now)).toBe('Just now')
  })

  it('returns minutes ago', () => {
    const date = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago
    expect(formatRelativeTime(date)).toBe('5 minutes ago')
  })

  it('returns singular minute', () => {
    const date = new Date(Date.now() - 1 * 60 * 1000 - 30000) // 1.5 minutes ago
    expect(formatRelativeTime(date)).toBe('1 minute ago')
  })

  it('returns hours ago', () => {
    const date = new Date(Date.now() - 3 * 60 * 60 * 1000) // 3 hours ago
    expect(formatRelativeTime(date)).toBe('3 hours ago')
  })

  it('returns days ago', () => {
    const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000) // 5 days ago
    expect(formatRelativeTime(date)).toBe('5 days ago')
  })

  it('falls back to formatDate for old dates (>30 days)', () => {
    const date = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000)
    const result = formatRelativeTime(date)
    // Should contain year, not "ago"
    expect(result).not.toContain('ago')
  })
})

// ─── Equipment Slots ────────────────────────────────────────────────────────────

describe('getSlotName', () => {
  it('returns correct slot names', () => {
    expect(getSlotName(0)).toBe('Head')
    expect(getSlotName(15)).toBe('Main Hand')
    expect(getSlotName(16)).toBe('Off Hand')
    expect(getSlotName(17)).toBe('Ranged')
    expect(getSlotName(18)).toBe('Tabard')
  })

  it('returns fallback for unknown slots', () => {
    expect(getSlotName(99)).toBe('Slot 99')
  })

  it('EQUIPMENT_SLOTS has 19 entries', () => {
    expect(Object.keys(EQUIPMENT_SLOTS)).toHaveLength(19)
  })
})

// ─── Gender ─────────────────────────────────────────────────────────────────────

describe('getGenderName', () => {
  it('returns Male for 0', () => {
    expect(getGenderName(0)).toBe('Male')
  })

  it('returns Female for 1', () => {
    expect(getGenderName(1)).toBe('Female')
  })

  it('returns Unknown for other values', () => {
    expect(getGenderName(2)).toBe('Unknown')
    expect(getGenderName(-1)).toBe('Unknown')
  })
})
