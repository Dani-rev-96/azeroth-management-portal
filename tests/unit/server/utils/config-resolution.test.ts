import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ─── Config Resolution Chain Tests ──────────────────────────────────────────────
//
// Tests the 3-tier async resolution: self-managed SQLite → Directus → env/hardcoded
// Recreates the resolution logic from server/utils/config/index.ts as pure functions,
// injecting dependencies (avoids importing the actual module which has heavy deps).

// ─── Types (subset of production) ─────────────────────────

interface ResolvedPerkConfig {
  diceSides: number
  rollThreshold: number
  dailyLimit: number
  requiredLevel: number
}

interface PerkGroupConfig {
  enabled: boolean
}

type ConfigBackend = 'env' | 'directus' | 'self-managed'

// ─── Mock data builders ───────────────────────────────────

function mockSelfManagedSettings(overrides: Partial<Record<string, any>> = {}) {
  return {
    id: 1,
    shop_enabled: 1,
    shop_delivery_method: 'bag',
    shop_markup_percent: 15,
    shop_mail_subject: 'Self-Managed Shop',
    shop_mail_body: 'Self-managed delivery',
    eluna_enabled: 1,
    eluna_shop_enabled: 1,
    eluna_gm_mail_enabled: 0,
    perk_fail_debuff_spell_id: 99999,
    perk_fail_debuff_duration_ms: 300000,
    perk_critfail_debuff_spell_id: 88888,
    perk_critfail_debuff_duration_ms: 300000,
    modified_by_user: 0,
    updated_at: '2024-01-01',
    ...overrides,
  }
}

function mockDirectusSettings(overrides: Partial<Record<string, any>> = {}) {
  return {
    shop_enabled: true,
    shop_delivery_method: 'both',
    shop_markup_percent: 25,
    shop_mail_subject: 'Directus Shop',
    shop_mail_body: 'Directus delivery',
    eluna_enabled: true,
    eluna_shop_enabled: true,
    eluna_gm_mail_enabled: true,
    perk_fail_debuff_spell_id: 77777,
    perk_fail_debuff_duration_ms: 500000,
    perk_critfail_debuff_spell_id: 66666,
    perk_critfail_debuff_duration_ms: 500000,
    ...overrides,
  }
}

function mockSelfManagedPerkGroups() {
  return [
    { id: 'buffs', label: 'SM Buffs', icon: '✨', description: '', enabled: 1, sort: 1, modified_by_user: 0, updated_at: null },
    { id: 'mount', label: 'SM Mount', icon: '🐎', description: '', enabled: 0, sort: 2, modified_by_user: 0, updated_at: null },
  ]
}

function mockDirectusPerkGroups() {
  return [
    { id: 'buffs', label: 'Dir Buffs', icon: '✨', description: '', enabled: true, delivery_type: 'aura', sort: 1 },
    { id: 'mount', label: 'Dir Mount', icon: '🐎', description: '', enabled: true, delivery_type: 'spell', sort: 2 },
  ]
}

function mockSelfManagedPerks() {
  return [
    { id: 'buff-str', group_id: 'buffs', name: 'SM Str', dice_sides: 10, roll_threshold: 3, daily_limit: 10, required_level: 5, sort: 1 },
  ]
}

function mockDirectusPerks() {
  return [
    { id: 'buff-str', group: 'buffs', name: 'Dir Str', dice_sides: 12, roll_threshold: 4, daily_limit: 8, required_level: 15, sort: 1 },
  ]
}

function mockSelfManagedShopCategories() {
  return [
    { id: 1, slug: 'sm-weapons', sort: 1, modified_by_user: 0, updated_at: null },
    { id: 2, slug: 'sm-armor', sort: 2, modified_by_user: 0, updated_at: null },
  ]
}

function mockDirectusShopCategories() {
  return [
    { slug: 'dir-weapons', sort: 1 },
    { slug: 'dir-armor', sort: 2 },
  ]
}

// ─── Recreated resolution logic ───────────────────────────

interface ConfigDeps {
  getConfigBackend: () => ConfigBackend
  isSelfManagedEnabled: () => boolean
  getSelfManagedSettings: () => any | null
  getSelfManagedPerkGroups: () => any[] | null
  getSelfManagedPerks: () => any[] | null
  getSelfManagedShopCategories: () => any[] | null
  isDirectusEnabled: () => boolean
  getDirectusSettings: () => Promise<any | null>
  getDirectusPerkGroups: () => Promise<any[] | null>
  getDirectusPerks: () => Promise<any[] | null>
  getDirectusShopCategories: () => Promise<any[] | null>
  getShopConfig: () => any
  getElunaConfig: () => any
  getPerkConfig: () => any
  PERK_REGISTRY: any[]
  PERK_GROUPS: any[]
}

function createShopConfigAsync(deps: ConfigDeps) {
  return async () => {
    // 1. Self-managed SQLite
    if (deps.isSelfManagedEnabled()) {
      const settings = deps.getSelfManagedSettings()
      const categories = deps.getSelfManagedShopCategories()
      if (settings) {
        const fallback = deps.getShopConfig()
        return {
          enabled: settings.shop_enabled === 1,
          priceMarkupPercent: settings.shop_markup_percent,
          deliveryMethod: settings.shop_delivery_method as 'mail' | 'bag' | 'both',
          mailSubject: settings.shop_mail_subject,
          mailBody: settings.shop_mail_body,
          categories: (categories && categories.length > 0
            ? categories.map((c: any) => c.slug)
            : fallback.categories) as readonly string[],
        }
      }
    }

    // 2. Directus
    if (deps.isDirectusEnabled()) {
      const [settings, categories] = await Promise.all([
        deps.getDirectusSettings(),
        deps.getDirectusShopCategories(),
      ])
      if (settings) {
        const fallback = deps.getShopConfig()
        return {
          enabled: settings.shop_enabled,
          priceMarkupPercent: settings.shop_markup_percent,
          deliveryMethod: settings.shop_delivery_method as 'mail' | 'bag' | 'both',
          mailSubject: settings.shop_mail_subject,
          mailBody: settings.shop_mail_body,
          categories: (categories && categories.length > 0
            ? categories.map((c: any) => c.slug)
            : fallback.categories) as readonly string[],
        }
      }
    }

    // 3. Env/hardcoded fallback
    return deps.getShopConfig()
  }
}

function createElunaConfigAsync(deps: ConfigDeps) {
  return async () => {
    if (deps.isSelfManagedEnabled()) {
      const settings = deps.getSelfManagedSettings()
      if (settings) {
        return {
          enabled: settings.eluna_enabled === 1,
          shopEnabled: settings.eluna_shop_enabled === 1,
          gmMailEnabled: settings.eluna_gm_mail_enabled === 1,
        }
      }
    }

    if (deps.isDirectusEnabled()) {
      const settings = await deps.getDirectusSettings()
      if (settings) {
        return {
          enabled: settings.eluna_enabled,
          shopEnabled: settings.eluna_shop_enabled,
          gmMailEnabled: settings.eluna_gm_mail_enabled,
        }
      }
    }

    return deps.getElunaConfig()
  }
}

function createPerkConfigAsync(deps: ConfigDeps) {
  return async () => {
    if (deps.isSelfManagedEnabled()) {
      const settings = deps.getSelfManagedSettings()
      const smGroups = deps.getSelfManagedPerkGroups()
      const smPerks = deps.getSelfManagedPerks()

      if (smGroups && smPerks) {
        const groups = {} as Record<string, PerkGroupConfig>
        for (const g of smGroups) {
          groups[g.id] = { enabled: g.enabled === 1 }
        }
        const perks = {} as Record<string, ResolvedPerkConfig>
        for (const p of smPerks) {
          perks[p.id] = { diceSides: p.dice_sides, rollThreshold: p.roll_threshold, dailyLimit: p.daily_limit, requiredLevel: p.required_level }
        }
        return {
          groups, perks,
          failDebuffSpellId: settings?.perk_fail_debuff_spell_id ?? 11196,
          failDebuffDurationMs: settings?.perk_fail_debuff_duration_ms ?? 600000,
          critFailDebuffSpellId: settings?.perk_critfail_debuff_spell_id ?? 15007,
          critFailDebuffDurationMs: settings?.perk_critfail_debuff_duration_ms ?? 600000,
        }
      }
    }

    if (deps.isDirectusEnabled()) {
      const [settings, dGroups, dPerks] = await Promise.all([
        deps.getDirectusSettings(),
        deps.getDirectusPerkGroups(),
        deps.getDirectusPerks(),
      ])

      if (dGroups && dPerks) {
        const groups = {} as Record<string, PerkGroupConfig>
        for (const dg of dGroups) {
          groups[dg.id] = { enabled: dg.enabled }
        }
        const perks = {} as Record<string, ResolvedPerkConfig>
        for (const dp of dPerks) {
          perks[dp.id] = { diceSides: dp.dice_sides, rollThreshold: dp.roll_threshold, dailyLimit: dp.daily_limit, requiredLevel: dp.required_level }
        }
        return {
          groups, perks,
          failDebuffSpellId: settings?.perk_fail_debuff_spell_id ?? 11196,
          failDebuffDurationMs: settings?.perk_fail_debuff_duration_ms ?? 600000,
          critFailDebuffSpellId: settings?.perk_critfail_debuff_spell_id ?? 15007,
          critFailDebuffDurationMs: settings?.perk_critfail_debuff_duration_ms ?? 600000,
        }
      }
    }

    return deps.getPerkConfig()
  }
}

function createPerkRegistryAsync(deps: ConfigDeps) {
  return async () => {
    if (deps.isSelfManagedEnabled()) {
      const smPerks = deps.getSelfManagedPerks()
      if (smPerks && smPerks.length > 0) {
        return smPerks.map((p: any) => ({ ...p, source: 'self-managed' }))
      }
    }
    if (deps.isDirectusEnabled()) {
      const dPerks = await deps.getDirectusPerks()
      if (dPerks && dPerks.length > 0) {
        return dPerks.map((p: any) => ({ ...p, source: 'directus' }))
      }
    }
    return deps.PERK_REGISTRY
  }
}

function createPerkGroupsAsync(deps: ConfigDeps) {
  return async () => {
    if (deps.isSelfManagedEnabled()) {
      const smGroups = deps.getSelfManagedPerkGroups()
      if (smGroups && smGroups.length > 0) {
        return smGroups.map((g: any) => ({ ...g, source: 'self-managed' }))
      }
    }
    if (deps.isDirectusEnabled()) {
      const dGroups = await deps.getDirectusPerkGroups()
      if (dGroups && dGroups.length > 0) {
        return dGroups.map((g: any) => ({ ...g, source: 'directus' }))
      }
    }
    return deps.PERK_GROUPS
  }
}

// ─── Default env-based config (mirrors config/index.ts) ──

const envShopConfig = {
  enabled: true,
  priceMarkupPercent: 20,
  deliveryMethod: 'mail' as const,
  mailSubject: 'Your Shop Purchase',
  mailBody: 'Thank you for your purchase! Your items are attached.',
  categories: ['weapons', 'armor', 'consumables', 'trade_goods', 'gems', 'recipes', 'glyphs', 'containers', 'mounts', 'miscellaneous'] as const,
}

const envElunaConfig = {
  enabled: true,
  shopEnabled: true,
  gmMailEnabled: true,
}

const envPerkConfig = {
  groups: { buffs: { enabled: true }, mount: { enabled: true }, scrolls: { enabled: true } },
  perks: { 'buff-str': { diceSides: 20, rollThreshold: 8, dailyLimit: 5, requiredLevel: 60 } },
  failDebuffSpellId: 11196,
  failDebuffDurationMs: 600000,
  critFailDebuffSpellId: 15007,
  critFailDebuffDurationMs: 600000,
}

const hardcodedPerkRegistry = [{ id: 'buff-str', name: 'Hardcoded Str', source: 'hardcoded' }]
const hardcodedPerkGroups = [{ id: 'buffs', label: 'Hardcoded Buffs', source: 'hardcoded' }]

// ─── Helper to build deps with overrides ──────────────────

function buildDeps(overrides: Partial<ConfigDeps> = {}): ConfigDeps {
  return {
    getConfigBackend: () => 'env',
    isSelfManagedEnabled: () => false,
    getSelfManagedSettings: () => null,
    getSelfManagedPerkGroups: () => null,
    getSelfManagedPerks: () => null,
    getSelfManagedShopCategories: () => null,
    isDirectusEnabled: () => false,
    getDirectusSettings: async () => null,
    getDirectusPerkGroups: async () => null,
    getDirectusPerks: async () => null,
    getDirectusShopCategories: async () => null,
    getShopConfig: () => envShopConfig,
    getElunaConfig: () => envElunaConfig,
    getPerkConfig: () => envPerkConfig,
    PERK_REGISTRY: hardcodedPerkRegistry,
    PERK_GROUPS: hardcodedPerkGroups,
    ...overrides,
  }
}

// ═════════════════════════════════════════════════════════════
// Tests: Shop Config Resolution
// ═════════════════════════════════════════════════════════════

describe('Config Resolution: getShopConfigAsync', () => {
  it('falls back to env when no backends enabled', async () => {
    const deps = buildDeps()
    const result = await createShopConfigAsync(deps)()
    expect(result.priceMarkupPercent).toBe(20)
    expect(result.deliveryMethod).toBe('mail')
    expect(result.categories).toContain('weapons')
  })

  it('returns self-managed when enabled and has data', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => mockSelfManagedSettings(),
      getSelfManagedShopCategories: () => mockSelfManagedShopCategories(),
    })
    const result = await createShopConfigAsync(deps)()
    expect(result.priceMarkupPercent).toBe(15)
    expect(result.deliveryMethod).toBe('bag')
    expect(result.mailSubject).toBe('Self-Managed Shop')
    expect(result.categories).toContain('sm-weapons')
    expect(result.categories).toContain('sm-armor')
  })

  it('returns Directus when enabled and has data (no self-managed)', async () => {
    const deps = buildDeps({
      isDirectusEnabled: () => true,
      getDirectusSettings: async () => mockDirectusSettings(),
      getDirectusShopCategories: async () => mockDirectusShopCategories(),
    })
    const result = await createShopConfigAsync(deps)()
    expect(result.priceMarkupPercent).toBe(25)
    expect(result.deliveryMethod).toBe('both')
    expect(result.mailSubject).toBe('Directus Shop')
    expect(result.categories).toContain('dir-weapons')
  })

  it('self-managed takes priority over Directus', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => mockSelfManagedSettings(),
      getSelfManagedShopCategories: () => mockSelfManagedShopCategories(),
      isDirectusEnabled: () => true,
      getDirectusSettings: async () => mockDirectusSettings(),
      getDirectusShopCategories: async () => mockDirectusShopCategories(),
    })
    const result = await createShopConfigAsync(deps)()
    // Should get self-managed values, NOT Directus
    expect(result.priceMarkupPercent).toBe(15)
    expect(result.mailSubject).toBe('Self-Managed Shop')
  })

  it('falls through to Directus if self-managed is enabled but has no data', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => null, // No data yet
      isDirectusEnabled: () => true,
      getDirectusSettings: async () => mockDirectusSettings(),
      getDirectusShopCategories: async () => mockDirectusShopCategories(),
    })
    const result = await createShopConfigAsync(deps)()
    expect(result.priceMarkupPercent).toBe(25)
    expect(result.mailSubject).toBe('Directus Shop')
  })

  it('falls through to env if both backends have no data', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => null,
      isDirectusEnabled: () => true,
      getDirectusSettings: async () => null,
    })
    const result = await createShopConfigAsync(deps)()
    expect(result.priceMarkupPercent).toBe(20)
    expect(result.deliveryMethod).toBe('mail')
  })

  it('uses fallback categories when self-managed has settings but no categories', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => mockSelfManagedSettings(),
      getSelfManagedShopCategories: () => null, // No categories in DB
    })
    const result = await createShopConfigAsync(deps)()
    expect(result.priceMarkupPercent).toBe(15) // Self-managed settings
    expect(result.categories).toContain('weapons') // But env fallback categories
  })
})

// ═════════════════════════════════════════════════════════════
// Tests: Eluna Config Resolution
// ═════════════════════════════════════════════════════════════

describe('Config Resolution: getElunaConfigAsync', () => {
  it('falls back to env when no backends enabled', async () => {
    const deps = buildDeps()
    const result = await createElunaConfigAsync(deps)()
    expect(result.enabled).toBe(true)
    expect(result.shopEnabled).toBe(true)
    expect(result.gmMailEnabled).toBe(true)
  })

  it('returns self-managed Eluna config', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => mockSelfManagedSettings({ eluna_gm_mail_enabled: 0 }),
    })
    const result = await createElunaConfigAsync(deps)()
    expect(result.enabled).toBe(true)
    expect(result.shopEnabled).toBe(true)
    expect(result.gmMailEnabled).toBe(false)
  })

  it('returns Directus Eluna config', async () => {
    const deps = buildDeps({
      isDirectusEnabled: () => true,
      getDirectusSettings: async () => mockDirectusSettings({ eluna_enabled: false }),
    })
    const result = await createElunaConfigAsync(deps)()
    expect(result.enabled).toBe(false)
  })

  it('self-managed takes priority over Directus for Eluna config', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => mockSelfManagedSettings({ eluna_gm_mail_enabled: 0 }),
      isDirectusEnabled: () => true,
      getDirectusSettings: async () => mockDirectusSettings({ eluna_gm_mail_enabled: true }),
    })
    const result = await createElunaConfigAsync(deps)()
    // Self-managed: gm_mail disabled (integer 0 → false)
    expect(result.gmMailEnabled).toBe(false)
  })

  it('correctly converts SQLite integer booleans', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => mockSelfManagedSettings({
        eluna_enabled: 0,
        eluna_shop_enabled: 1,
        eluna_gm_mail_enabled: 0,
      }),
    })
    const result = await createElunaConfigAsync(deps)()
    expect(result.enabled).toBe(false)
    expect(result.shopEnabled).toBe(true)
    expect(result.gmMailEnabled).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════
// Tests: Perk Config Resolution
// ═════════════════════════════════════════════════════════════

describe('Config Resolution: getPerkConfigAsync', () => {
  it('falls back to env-based perk config', async () => {
    const deps = buildDeps()
    const result = await createPerkConfigAsync(deps)()
    expect(result.groups).toEqual(envPerkConfig.groups)
    expect(result.perks).toEqual(envPerkConfig.perks)
    expect(result.failDebuffSpellId).toBe(11196)
  })

  it('returns self-managed perk config with groups and perks', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => mockSelfManagedSettings(),
      getSelfManagedPerkGroups: () => mockSelfManagedPerkGroups(),
      getSelfManagedPerks: () => mockSelfManagedPerks(),
    })
    const result = await createPerkConfigAsync(deps)()
    expect(result.groups['buffs']).toEqual({ enabled: true })
    expect(result.groups['mount']).toEqual({ enabled: false }) // enabled: 0 → false
    expect(result.perks['buff-str'].diceSides).toBe(10)
    expect(result.perks['buff-str'].rollThreshold).toBe(3)
    expect(result.failDebuffSpellId).toBe(99999) // From self-managed settings
    expect(result.critFailDebuffSpellId).toBe(88888)
  })

  it('returns Directus perk config', async () => {
    const deps = buildDeps({
      isDirectusEnabled: () => true,
      getDirectusSettings: async () => mockDirectusSettings(),
      getDirectusPerkGroups: async () => mockDirectusPerkGroups(),
      getDirectusPerks: async () => mockDirectusPerks(),
    })
    const result = await createPerkConfigAsync(deps)()
    expect(result.groups['buffs']).toEqual({ enabled: true })
    expect(result.perks['buff-str'].diceSides).toBe(12)
    expect(result.failDebuffSpellId).toBe(77777)
  })

  it('self-managed perk config takes priority over Directus', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => mockSelfManagedSettings(),
      getSelfManagedPerkGroups: () => mockSelfManagedPerkGroups(),
      getSelfManagedPerks: () => mockSelfManagedPerks(),
      isDirectusEnabled: () => true,
      getDirectusSettings: async () => mockDirectusSettings(),
      getDirectusPerkGroups: async () => mockDirectusPerkGroups(),
      getDirectusPerks: async () => mockDirectusPerks(),
    })
    const result = await createPerkConfigAsync(deps)()
    expect(result.perks['buff-str'].diceSides).toBe(10) // self-managed
    expect(result.failDebuffSpellId).toBe(99999) // self-managed
  })

  it('falls through when self-managed has no perk groups', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => mockSelfManagedSettings(),
      getSelfManagedPerkGroups: () => null, // No groups yet
      getSelfManagedPerks: () => mockSelfManagedPerks(),
      isDirectusEnabled: () => true,
      getDirectusSettings: async () => mockDirectusSettings(),
      getDirectusPerkGroups: async () => mockDirectusPerkGroups(),
      getDirectusPerks: async () => mockDirectusPerks(),
    })
    const result = await createPerkConfigAsync(deps)()
    // Should fall through to Directus
    expect(result.perks['buff-str'].diceSides).toBe(12) // Directus
  })

  it('uses default debuff values when settings is null', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => null,
      getSelfManagedPerkGroups: () => mockSelfManagedPerkGroups(),
      getSelfManagedPerks: () => mockSelfManagedPerks(),
    })
    const result = await createPerkConfigAsync(deps)()
    expect(result.failDebuffSpellId).toBe(11196)
    expect(result.critFailDebuffSpellId).toBe(15007)
  })
})

// ═════════════════════════════════════════════════════════════
// Tests: Perk Registry Resolution
// ═════════════════════════════════════════════════════════════

describe('Config Resolution: getPerkRegistryAsync', () => {
  it('returns hardcoded registry when no backends enabled', async () => {
    const deps = buildDeps()
    const result = await createPerkRegistryAsync(deps)()
    expect(result).toEqual(hardcodedPerkRegistry)
  })

  it('returns self-managed perks when available', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedPerks: () => mockSelfManagedPerks(),
    })
    const result = await createPerkRegistryAsync(deps)()
    expect(result[0].source).toBe('self-managed')
    expect(result[0].name).toBe('SM Str')
  })

  it('returns Directus perks when self-managed has no data', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedPerks: () => null,
      isDirectusEnabled: () => true,
      getDirectusPerks: async () => mockDirectusPerks(),
    })
    const result = await createPerkRegistryAsync(deps)()
    expect(result[0].source).toBe('directus')
  })

  it('self-managed takes priority over Directus for registry', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedPerks: () => mockSelfManagedPerks(),
      isDirectusEnabled: () => true,
      getDirectusPerks: async () => mockDirectusPerks(),
    })
    const result = await createPerkRegistryAsync(deps)()
    expect(result[0].source).toBe('self-managed')
  })

  it('falls all the way to hardcoded if both backends return empty', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedPerks: () => [],
      isDirectusEnabled: () => true,
      getDirectusPerks: async () => [],
    })
    const result = await createPerkRegistryAsync(deps)()
    expect(result).toEqual(hardcodedPerkRegistry)
  })
})

// ═════════════════════════════════════════════════════════════
// Tests: Perk Groups Resolution
// ═════════════════════════════════════════════════════════════

describe('Config Resolution: getPerkGroupsAsync', () => {
  it('returns hardcoded groups when no backends enabled', async () => {
    const deps = buildDeps()
    const result = await createPerkGroupsAsync(deps)()
    expect(result).toEqual(hardcodedPerkGroups)
  })

  it('returns self-managed groups when available', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedPerkGroups: () => mockSelfManagedPerkGroups(),
    })
    const result = await createPerkGroupsAsync(deps)()
    expect(result[0].source).toBe('self-managed')
    expect(result[0].label).toBe('SM Buffs')
  })

  it('returns Directus groups when self-managed empty', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedPerkGroups: () => [],
      isDirectusEnabled: () => true,
      getDirectusPerkGroups: async () => mockDirectusPerkGroups(),
    })
    const result = await createPerkGroupsAsync(deps)()
    expect(result[0].source).toBe('directus')
  })

  it('self-managed takes priority over Directus for groups', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedPerkGroups: () => mockSelfManagedPerkGroups(),
      isDirectusEnabled: () => true,
      getDirectusPerkGroups: async () => mockDirectusPerkGroups(),
    })
    const result = await createPerkGroupsAsync(deps)()
    expect(result[0].source).toBe('self-managed')
  })
})

// ═════════════════════════════════════════════════════════════
// Tests: isElunaShopEnabledAsync / isElunaGmMailEnabledAsync
// ═════════════════════════════════════════════════════════════

describe('Config Resolution: Eluna feature flag helpers', () => {
  function createIsElunaShopEnabled(deps: ConfigDeps) {
    return async () => {
      const config = await createElunaConfigAsync(deps)()
      return config.enabled && config.shopEnabled
    }
  }

  function createIsElunaGmMailEnabled(deps: ConfigDeps) {
    return async () => {
      const config = await createElunaConfigAsync(deps)()
      return config.enabled && config.gmMailEnabled
    }
  }

  it('isElunaShopEnabled returns true when both enabled', async () => {
    const deps = buildDeps()
    expect(await createIsElunaShopEnabled(deps)()).toBe(true)
  })

  it('isElunaShopEnabled returns false when eluna disabled', async () => {
    const deps = buildDeps({
      getElunaConfig: () => ({ enabled: false, shopEnabled: true, gmMailEnabled: true }),
    })
    expect(await createIsElunaShopEnabled(deps)()).toBe(false)
  })

  it('isElunaGmMailEnabled uses self-managed settings', async () => {
    const deps = buildDeps({
      isSelfManagedEnabled: () => true,
      getSelfManagedSettings: () => mockSelfManagedSettings({
        eluna_enabled: 1,
        eluna_gm_mail_enabled: 0,
      }),
    })
    expect(await createIsElunaGmMailEnabled(deps)()).toBe(false)
  })

  it('isElunaGmMailEnabled returns true from Directus', async () => {
    const deps = buildDeps({
      isDirectusEnabled: () => true,
      getDirectusSettings: async () => mockDirectusSettings({
        eluna_enabled: true,
        eluna_gm_mail_enabled: true,
      }),
    })
    expect(await createIsElunaGmMailEnabled(deps)()).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════
// Tests: Env-based sync config (existing behavior)
// ═════════════════════════════════════════════════════════════

describe('Config Resolution: Env-based getShopConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function getShopConfig() {
    const deliveryMethod = (process.env.NUXT_PUBLIC_SHOP_DELIVERY_METHOD || 'mail') as 'mail' | 'bag' | 'both'
    const markupPercent = parseInt(process.env.NUXT_PUBLIC_SHOP_MARKUP_PERCENT || '20', 10)
    return {
      enabled: process.env.NUXT_SHOP_ENABLED !== 'false',
      priceMarkupPercent: markupPercent,
      deliveryMethod,
      mailSubject: process.env.NUXT_SHOP_MAIL_SUBJECT || 'Your Shop Purchase',
      mailBody: process.env.NUXT_SHOP_MAIL_BODY || 'Thank you for your purchase! Your items are attached.',
      categories: ['weapons', 'armor', 'consumables', 'trade_goods', 'gems', 'recipes', 'glyphs', 'containers', 'mounts', 'miscellaneous'] as const,
    }
  }

  it('returns defaults when no env vars set', () => {
    const config = getShopConfig()
    expect(config.enabled).toBe(true)
    expect(config.priceMarkupPercent).toBe(20)
    expect(config.deliveryMethod).toBe('mail')
    expect(config.categories).toHaveLength(10)
  })

  it('reads shop settings from env vars', () => {
    process.env.NUXT_PUBLIC_SHOP_DELIVERY_METHOD = 'bag'
    process.env.NUXT_PUBLIC_SHOP_MARKUP_PERCENT = '50'
    process.env.NUXT_SHOP_MAIL_SUBJECT = 'Custom Subject'

    const config = getShopConfig()
    expect(config.deliveryMethod).toBe('bag')
    expect(config.priceMarkupPercent).toBe(50)
    expect(config.mailSubject).toBe('Custom Subject')
  })

  it('shop can be disabled via env var', () => {
    process.env.NUXT_SHOP_ENABLED = 'false'
    expect(getShopConfig().enabled).toBe(false)
  })
})

describe('Config Resolution: Env-based getElunaConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function getElunaConfig() {
    return {
      enabled: process.env.NUXT_ELUNA_ENABLED !== 'false',
      shopEnabled: process.env.NUXT_ELUNA_SHOP_ENABLED !== 'false',
      gmMailEnabled: process.env.NUXT_ELUNA_GM_MAIL_ENABLED !== 'false',
    }
  }

  it('defaults to all enabled', () => {
    delete process.env.NUXT_ELUNA_ENABLED
    delete process.env.NUXT_ELUNA_SHOP_ENABLED
    delete process.env.NUXT_ELUNA_GM_MAIL_ENABLED

    const config = getElunaConfig()
    expect(config.enabled).toBe(true)
    expect(config.shopEnabled).toBe(true)
    expect(config.gmMailEnabled).toBe(true)
  })

  it('disables individual features via env', () => {
    process.env.NUXT_ELUNA_ENABLED = 'true'
    process.env.NUXT_ELUNA_SHOP_ENABLED = 'false'
    process.env.NUXT_ELUNA_GM_MAIL_ENABLED = 'false'

    const config = getElunaConfig()
    expect(config.enabled).toBe(true)
    expect(config.shopEnabled).toBe(false)
    expect(config.gmMailEnabled).toBe(false)
  })

  it('master switch disables all', () => {
    process.env.NUXT_ELUNA_ENABLED = 'false'

    const config = getElunaConfig()
    expect(config.enabled).toBe(false)
  })
})
