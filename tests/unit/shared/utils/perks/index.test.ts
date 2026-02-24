import { describe, it, expect } from 'vitest'
import {
  PERK_REGISTRY,
  PERK_GROUPS,
  MOUNT_PERKS,
  QUEST_PERKS,
  BUFF_PERKS,
  SCROLL_PERKS,
  TELEPORT_PERKS,
  getPerkById,
  getPerksByGroup,
  getPerkGroupMeta,
  getActiveGroups,
} from '../../../../../shared/utils/perks'
import type { PerkDefinition, PerkGroup } from '../../../../../shared/utils/perks'

// ─── getPerkById ────────────────────────────────────────────────────────────────

describe('getPerkById', () => {
  it('finds mount perk by id', () => {
    const perk = getPerkById('flying')
    expect(perk).toBeDefined()
    expect(perk!.name).toBe('Old World Flying')
    expect(perk!.group).toBe('mount')
  })

  it('finds quest perk by id', () => {
    const perk = getPerkById('drakefire')
    expect(perk).toBeDefined()
    expect(perk!.name).toBe('Drakefire Amulet')
    expect(perk!.group).toBe('quest')
  })

  it('finds buff perk by id', () => {
    const perk = getPerkById('buff-motw-r1')
    expect(perk).toBeDefined()
    expect(perk!.deliveryType).toBe('aura')
  })

  it('finds scroll perk by id', () => {
    const perk = getPerkById('scroll-intellect-i')
    expect(perk).toBeDefined()
    expect(perk!.deliveryType).toBe('bag-item')
  })

  it('finds teleport perk by id', () => {
    const perk = getPerkById('teleport-stormwind')
    expect(perk).toBeDefined()
    expect(perk!.deliveryType).toBe('teleport')
  })

  it('returns undefined for non-existent id', () => {
    expect(getPerkById('non-existent')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(getPerkById('')).toBeUndefined()
  })
})

// ─── getPerksByGroup ────────────────────────────────────────────────────────────

describe('getPerksByGroup', () => {
  it('returns mount perks', () => {
    const perks = getPerksByGroup('mount')
    expect(perks).toHaveLength(MOUNT_PERKS.length)
    perks.forEach(p => expect(p.group).toBe('mount'))
  })

  it('returns quest perks', () => {
    const perks = getPerksByGroup('quest')
    expect(perks).toHaveLength(QUEST_PERKS.length)
    perks.forEach(p => expect(p.group).toBe('quest'))
  })

  it('returns buff perks', () => {
    const perks = getPerksByGroup('buffs')
    expect(perks).toHaveLength(BUFF_PERKS.length)
    perks.forEach(p => expect(p.group).toBe('buffs'))
  })

  it('returns scroll perks', () => {
    const perks = getPerksByGroup('scrolls')
    expect(perks).toHaveLength(SCROLL_PERKS.length)
    perks.forEach(p => expect(p.group).toBe('scrolls'))
  })

  it('returns teleport perks', () => {
    const perks = getPerksByGroup('teleport')
    expect(perks).toHaveLength(TELEPORT_PERKS.length)
    perks.forEach(p => expect(p.group).toBe('teleport'))
  })

  it('returns empty array for non-existent group', () => {
    expect(getPerksByGroup('nonexistent' as PerkGroup)).toHaveLength(0)
  })
})

// ─── getPerkGroupMeta ───────────────────────────────────────────────────────────

describe('getPerkGroupMeta', () => {
  it('returns metadata for mount group', () => {
    const meta = getPerkGroupMeta('mount')
    expect(meta).toBeDefined()
    expect(meta!.label).toBe('Mounts & Abilities')
    expect(meta!.icon).toBe('🦅')
  })

  it('returns metadata for all defined groups', () => {
    const groups: PerkGroup[] = ['mount', 'quest', 'buffs', 'scrolls', 'teleport']
    for (const group of groups) {
      const meta = getPerkGroupMeta(group)
      expect(meta).toBeDefined()
      expect(meta!.id).toBe(group)
      expect(meta!.label).toBeTruthy()
      expect(meta!.description).toBeTruthy()
      expect(meta!.envKey).toBeTruthy()
    }
  })

  it('returns undefined for non-existent group', () => {
    expect(getPerkGroupMeta('fake' as PerkGroup)).toBeUndefined()
  })
})

// ─── getActiveGroups ────────────────────────────────────────────────────────────

describe('getActiveGroups', () => {
  it('returns all 5 groups', () => {
    const groups = getActiveGroups()
    expect(groups).toHaveLength(5)
  })

  it('preserves PERK_GROUPS display order', () => {
    const groups = getActiveGroups()
    const expectedOrder: PerkGroup[] = ['mount', 'quest', 'buffs', 'scrolls', 'teleport']
    expect(groups).toEqual(expectedOrder)
  })
})

// ─── PERK_GROUPS ────────────────────────────────────────────────────────────────

describe('PERK_GROUPS', () => {
  it('has 5 groups', () => {
    expect(PERK_GROUPS).toHaveLength(5)
  })

  it('each group has required metadata fields', () => {
    for (const group of PERK_GROUPS) {
      expect(group.id).toBeTruthy()
      expect(group.label).toBeTruthy()
      expect(group.icon).toBeTruthy()
      expect(group.description).toBeTruthy()
      expect(group.envKey).toMatch(/^NUXT_PERK_GROUP_/)
    }
  })

  it('group IDs are unique', () => {
    const ids = PERK_GROUPS.map(g => g.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

// ─── PERK_REGISTRY ──────────────────────────────────────────────────────────────

describe('PERK_REGISTRY', () => {
  it('is non-empty', () => {
    expect(PERK_REGISTRY.length).toBeGreaterThan(0)
  })

  it('total perks = sum of all group arrays', () => {
    const expected = MOUNT_PERKS.length + QUEST_PERKS.length + BUFF_PERKS.length + SCROLL_PERKS.length + TELEPORT_PERKS.length
    expect(PERK_REGISTRY).toHaveLength(expected)
  })

  it('all perk IDs are unique', () => {
    const ids = PERK_REGISTRY.map(p => p.id)
    const duplicates = ids.filter((id, i) => ids.indexOf(id) !== i)
    expect(duplicates).toEqual([])
  })

  it('all perks have required fields', () => {
    for (const perk of PERK_REGISTRY) {
      expect(perk.id).toBeTruthy()
      expect(perk.group).toBeTruthy()
      expect(perk.name).toBeTruthy()
      expect(perk.icon).toBeTruthy()
      expect(perk.description).toBeTruthy()
      expect(perk.successMessage).toBeTruthy()
      expect(perk.deliveryType).toBeTruthy()
      expect(perk.envPrefix).toBeTruthy()
      expect(perk.accent).toBeTruthy()
      expect(typeof perk.requiredLevel).toBe('number')
      expect(typeof perk.requiresOnline).toBe('boolean')
      expect(typeof perk.oneTime).toBe('boolean')
      expect(typeof perk.defaultDiceSides).toBe('number')
      expect(typeof perk.defaultRollThreshold).toBe('number')
      expect(typeof perk.defaultDailyLimit).toBe('number')
    }
  })

  it('all envPrefixes are unique', () => {
    const prefixes = PERK_REGISTRY.map(p => p.envPrefix)
    const duplicates = prefixes.filter((p, i) => prefixes.indexOf(p) !== i)
    expect(duplicates).toEqual([])
  })

  it('all perks reference valid groups', () => {
    const validGroups = PERK_GROUPS.map(g => g.id)
    for (const perk of PERK_REGISTRY) {
      expect(validGroups).toContain(perk.group)
    }
  })

  it('dice sides and roll threshold are logically valid', () => {
    for (const perk of PERK_REGISTRY) {
      expect(perk.defaultDiceSides).toBeGreaterThan(0)
      expect(perk.defaultRollThreshold).toBeGreaterThan(0)
      expect(perk.defaultRollThreshold).toBeLessThanOrEqual(perk.defaultDiceSides)
    }
  })

  it('requiredLevel is between 0 and 80', () => {
    for (const perk of PERK_REGISTRY) {
      expect(perk.requiredLevel).toBeGreaterThanOrEqual(0)
      expect(perk.requiredLevel).toBeLessThanOrEqual(80)
    }
  })
})

// ─── Delivery Type Validation ───────────────────────────────────────────────────

describe('Perk Delivery Types', () => {
  const VALID_DELIVERY_TYPES = ['spell', 'item', 'bag-item', 'aura', 'teleport']

  it('all perks use valid delivery types', () => {
    for (const perk of PERK_REGISTRY) {
      expect(VALID_DELIVERY_TYPES).toContain(perk.deliveryType)
    }
  })

  it('mount perks use spell delivery', () => {
    for (const perk of MOUNT_PERKS) {
      expect(perk.deliveryType).toBe('spell')
    }
  })

  it('quest perks use item delivery', () => {
    for (const perk of QUEST_PERKS) {
      expect(perk.deliveryType).toBe('item')
    }
  })

  it('buff perks use aura delivery', () => {
    for (const perk of BUFF_PERKS) {
      expect(perk.deliveryType).toBe('aura')
    }
  })

  it('scroll perks use bag-item delivery', () => {
    for (const perk of SCROLL_PERKS) {
      expect(perk.deliveryType).toBe('bag-item')
    }
  })

  it('teleport perks use teleport delivery', () => {
    for (const perk of TELEPORT_PERKS) {
      expect(perk.deliveryType).toBe('teleport')
    }
  })
})

// ─── Buff Perk Specifics ────────────────────────────────────────────────────────

describe('Buff Perks', () => {
  it('all buff perks have auraDurationMs set', () => {
    for (const perk of BUFF_PERKS) {
      expect(perk.auraDurationMs).toBeDefined()
      expect(perk.auraDurationMs).toBeGreaterThan(0)
    }
  })

  it('all buff perks have a rankGroup', () => {
    for (const perk of BUFF_PERKS) {
      expect(perk.rankGroup).toBeTruthy()
    }
  })

  it('all buff perks have gameId set', () => {
    for (const perk of BUFF_PERKS) {
      expect(perk.gameId).toBeGreaterThan(0)
    }
  })

  it('all buff perks require online', () => {
    for (const perk of BUFF_PERKS) {
      expect(perk.requiresOnline).toBe(true)
    }
  })

  it('all buff perks are not one-time', () => {
    for (const perk of BUFF_PERKS) {
      expect(perk.oneTime).toBe(false)
    }
  })

  it('buff failDebuffDurationMs matches auraDurationMs when set', () => {
    for (const perk of BUFF_PERKS) {
      if (perk.failDebuffDurationMs !== undefined) {
        expect(perk.failDebuffDurationMs).toBe(perk.auraDurationMs)
      }
    }
  })
})

// ─── Scroll Perk Specifics ──────────────────────────────────────────────────────

describe('Scroll Perks', () => {
  it('all scroll perks have a rankGroup', () => {
    for (const perk of SCROLL_PERKS) {
      expect(perk.rankGroup).toBeTruthy()
    }
  })

  it('all scroll perks have itemCount set', () => {
    for (const perk of SCROLL_PERKS) {
      expect(perk.itemCount).toBeDefined()
      expect(perk.itemCount).toBeGreaterThan(0)
    }
  })

  it('all scroll perks have gameId (item entry) set', () => {
    for (const perk of SCROLL_PERKS) {
      expect(perk.gameId).toBeGreaterThan(0)
    }
  })

  it('all scroll perks require online', () => {
    for (const perk of SCROLL_PERKS) {
      expect(perk.requiresOnline).toBe(true)
    }
  })
})

// ─── Teleport Perk Specifics ────────────────────────────────────────────────────

describe('Teleport Perks', () => {
  it('all teleport perks have coordinates set', () => {
    for (const perk of TELEPORT_PERKS) {
      expect(perk.teleportMapId).toBeDefined()
      expect(typeof perk.teleportX).toBe('number')
      expect(typeof perk.teleportY).toBe('number')
      expect(typeof perk.teleportZ).toBe('number')
    }
  })

  it('all teleport perks require online', () => {
    for (const perk of TELEPORT_PERKS) {
      expect(perk.requiresOnline).toBe(true)
    }
  })

  it('all teleport perks use Dazed as fail debuff', () => {
    for (const perk of TELEPORT_PERKS) {
      expect(perk.failDebuffSpellId).toBe(1604)
    }
  })

  it('all teleport perks have 60s fail debuff duration', () => {
    for (const perk of TELEPORT_PERKS) {
      expect(perk.failDebuffDurationMs).toBe(60000)
    }
  })

  it('no teleport perks are one-time', () => {
    for (const perk of TELEPORT_PERKS) {
      expect(perk.oneTime).toBe(false)
    }
  })
})

// ─── Mount Perk Specifics ───────────────────────────────────────────────────────

describe('Mount Perks', () => {
  it('flying perk is one-time', () => {
    const flying = getPerkById('flying')!
    expect(flying.oneTime).toBe(true)
  })

  it('flying perk requires level 60', () => {
    const flying = getPerkById('flying')!
    expect(flying.requiredLevel).toBe(60)
  })

  it('flying perk uses spell delivery', () => {
    const flying = getPerkById('flying')!
    expect(flying.deliveryType).toBe('spell')
  })

  it('flying perk has unlimited daily limit (0)', () => {
    const flying = getPerkById('flying')!
    expect(flying.defaultDailyLimit).toBe(0)
  })
})

// ─── Quest Perk Specifics ───────────────────────────────────────────────────────

describe('Quest Perks', () => {
  it('drakefire perk is one-time', () => {
    const drakefire = getPerkById('drakefire')!
    expect(drakefire.oneTime).toBe(true)
  })

  it('drakefire perk uses item delivery', () => {
    const drakefire = getPerkById('drakefire')!
    expect(drakefire.deliveryType).toBe('item')
  })

  it('drakefire has mail metadata', () => {
    const drakefire = getPerkById('drakefire')!
    expect(drakefire.mailSubject).toBeTruthy()
    expect(drakefire.mailBody).toBeTruthy()
    expect(drakefire.itemCount).toBe(1)
  })
})
