import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { join } from 'path'
import { existsSync, unlinkSync, mkdirSync, rmSync } from 'fs'
import { tmpdir } from 'os'

// ─── Test Helpers ─────────────────────────────────────────

/**
 * Creates an in-memory (or tmp-file) portal-config database
 * with the same schema as the production module.
 * This avoids importing the module directly (which has module-level
 * side effects like registering shutdown handlers).
 */

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS portal_settings (
    id INTEGER PRIMARY KEY DEFAULT 1,
    shop_enabled INTEGER NOT NULL DEFAULT 1,
    shop_delivery_method TEXT NOT NULL DEFAULT 'mail',
    shop_markup_percent INTEGER NOT NULL DEFAULT 20,
    shop_mail_subject TEXT NOT NULL DEFAULT 'Your Shop Purchase',
    shop_mail_body TEXT NOT NULL DEFAULT 'Thank you for your purchase! Your items are attached.',
    eluna_enabled INTEGER NOT NULL DEFAULT 1,
    eluna_shop_enabled INTEGER NOT NULL DEFAULT 1,
    eluna_gm_mail_enabled INTEGER NOT NULL DEFAULT 1,
    perk_fail_debuff_spell_id INTEGER NOT NULL DEFAULT 11196,
    perk_fail_debuff_duration_ms INTEGER NOT NULL DEFAULT 600000,
    perk_critfail_debuff_spell_id INTEGER NOT NULL DEFAULT 15007,
    perk_critfail_debuff_duration_ms INTEGER NOT NULL DEFAULT 600000,
    modified_by_user INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS perk_groups (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    enabled INTEGER NOT NULL DEFAULT 1,
    sort INTEGER NOT NULL DEFAULT 0,
    modified_by_user INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS perks (
    id TEXT PRIMARY KEY,
    group_id TEXT NOT NULL,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    success_message TEXT NOT NULL DEFAULT '',
    delivery_type TEXT NOT NULL,
    game_id INTEGER NOT NULL DEFAULT 0,
    aura_duration_ms INTEGER,
    required_level INTEGER NOT NULL DEFAULT 0,
    requires_online INTEGER NOT NULL DEFAULT 0,
    one_time INTEGER NOT NULL DEFAULT 0,
    dice_sides INTEGER NOT NULL DEFAULT 20,
    roll_threshold INTEGER NOT NULL DEFAULT 8,
    daily_limit INTEGER NOT NULL DEFAULT 5,
    accent TEXT NOT NULL DEFAULT 'blue',
    env_prefix TEXT NOT NULL DEFAULT '',
    rank_group TEXT,
    mail_subject TEXT,
    mail_body TEXT,
    item_count INTEGER,
    fail_debuff_spell_id INTEGER,
    fail_debuff_duration_ms INTEGER,
    critfail_debuff_spell_id INTEGER,
    critfail_debuff_duration_ms INTEGER,
    teleport_map_id INTEGER,
    teleport_x REAL,
    teleport_y REAL,
    teleport_z REAL,
    teleport_o REAL,
    sort INTEGER NOT NULL DEFAULT 0,
    modified_by_user INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT,
    FOREIGN KEY (group_id) REFERENCES perk_groups(id)
  );

  CREATE TABLE IF NOT EXISTS shop_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL UNIQUE,
    sort INTEGER NOT NULL DEFAULT 0,
    modified_by_user INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT
  );
`

function createTestDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  db.exec(SCHEMA)
  return db
}

// ─── Recreated CRUD logic (mirrors portal-config-db.ts) ──

function createSettingsCRUD(db: Database.Database) {
  return {
    get() {
      return db.prepare('SELECT * FROM portal_settings WHERE id = 1').get() as any | null
    },
    upsert(data: Record<string, any>) {
      const existing = this.get()
      if (!existing) {
        const fields = Object.keys(data).filter(k => k !== 'id')
        const cols = ['id', ...fields, 'updated_at'].join(', ')
        const placeholders = ['1', ...fields.map(() => '?'), "datetime('now')"].join(', ')
        db.prepare(`INSERT INTO portal_settings (${cols}) VALUES (${placeholders})`).run(
          ...fields.map(k => data[k])
        )
      } else {
        const fields = Object.keys(data).filter(k => k !== 'id')
        if (fields.length === 0) return existing
        const sets = [...fields.map(k => `${k} = ?`), "updated_at = datetime('now')"].join(', ')
        db.prepare(`UPDATE portal_settings SET ${sets} WHERE id = 1`).run(
          ...fields.map(k => data[k])
        )
      }
      return this.get()!
    },
  }
}

function createPerkGroupsCRUD(db: Database.Database) {
  return {
    findAll() {
      return db.prepare('SELECT * FROM perk_groups ORDER BY sort ASC').all() as any[]
    },
    findById(id: string) {
      return db.prepare('SELECT * FROM perk_groups WHERE id = ?').get(id) as any ?? null
    },
    upsert(data: any) {
      db.prepare(`
        INSERT INTO perk_groups (id, label, icon, description, enabled, sort, modified_by_user, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
          label = excluded.label, icon = excluded.icon, description = excluded.description,
          enabled = excluded.enabled, sort = excluded.sort,
          modified_by_user = excluded.modified_by_user, updated_at = datetime('now')
      `).run(data.id, data.label, data.icon, data.description, data.enabled, data.sort, data.modified_by_user)
      return this.findById(data.id)!
    },
    delete(id: string) {
      return db.prepare('DELETE FROM perk_groups WHERE id = ?').run(id).changes > 0
    },
  }
}

function createPerksCRUD(db: Database.Database) {
  return {
    findAll() {
      return db.prepare('SELECT * FROM perks ORDER BY sort ASC').all() as any[]
    },
    findByGroup(groupId: string) {
      return db.prepare('SELECT * FROM perks WHERE group_id = ? ORDER BY sort ASC').all(groupId) as any[]
    },
    findById(id: string) {
      return db.prepare('SELECT * FROM perks WHERE id = ?').get(id) as any ?? null
    },
    upsert(data: any) {
      db.prepare(`
        INSERT INTO perks (
          id, group_id, name, icon, description, success_message, delivery_type,
          game_id, aura_duration_ms, required_level, requires_online, one_time,
          dice_sides, roll_threshold, daily_limit, accent, env_prefix,
          rank_group, mail_subject, mail_body, item_count,
          fail_debuff_spell_id, fail_debuff_duration_ms,
          critfail_debuff_spell_id, critfail_debuff_duration_ms,
          teleport_map_id, teleport_x, teleport_y, teleport_z, teleport_o,
          sort, modified_by_user, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
        )
        ON CONFLICT(id) DO UPDATE SET
          group_id = excluded.group_id, name = excluded.name, icon = excluded.icon,
          description = excluded.description, success_message = excluded.success_message,
          delivery_type = excluded.delivery_type, game_id = excluded.game_id,
          aura_duration_ms = excluded.aura_duration_ms, required_level = excluded.required_level,
          requires_online = excluded.requires_online, one_time = excluded.one_time,
          dice_sides = excluded.dice_sides, roll_threshold = excluded.roll_threshold,
          daily_limit = excluded.daily_limit, accent = excluded.accent, env_prefix = excluded.env_prefix,
          rank_group = excluded.rank_group, mail_subject = excluded.mail_subject,
          mail_body = excluded.mail_body, item_count = excluded.item_count,
          fail_debuff_spell_id = excluded.fail_debuff_spell_id,
          fail_debuff_duration_ms = excluded.fail_debuff_duration_ms,
          critfail_debuff_spell_id = excluded.critfail_debuff_spell_id,
          critfail_debuff_duration_ms = excluded.critfail_debuff_duration_ms,
          teleport_map_id = excluded.teleport_map_id, teleport_x = excluded.teleport_x,
          teleport_y = excluded.teleport_y, teleport_z = excluded.teleport_z,
          teleport_o = excluded.teleport_o, sort = excluded.sort,
          modified_by_user = excluded.modified_by_user, updated_at = datetime('now')
      `).run(
        data.id, data.group_id, data.name, data.icon, data.description, data.success_message,
        data.delivery_type, data.game_id, data.aura_duration_ms, data.required_level,
        data.requires_online, data.one_time, data.dice_sides, data.roll_threshold,
        data.daily_limit, data.accent, data.env_prefix, data.rank_group, data.mail_subject,
        data.mail_body, data.item_count, data.fail_debuff_spell_id, data.fail_debuff_duration_ms,
        data.critfail_debuff_spell_id, data.critfail_debuff_duration_ms,
        data.teleport_map_id, data.teleport_x, data.teleport_y, data.teleport_z, data.teleport_o,
        data.sort, data.modified_by_user,
      )
      return this.findById(data.id)!
    },
    delete(id: string) {
      return db.prepare('DELETE FROM perks WHERE id = ?').run(id).changes > 0
    },
  }
}

function createShopCategoriesCRUD(db: Database.Database) {
  return {
    findAll() {
      return db.prepare('SELECT * FROM shop_categories ORDER BY sort ASC').all() as any[]
    },
    findBySlug(slug: string) {
      return db.prepare('SELECT * FROM shop_categories WHERE slug = ?').get(slug) as any ?? null
    },
    upsert(data: { slug: string; sort: number; modified_by_user: number }) {
      db.prepare(`
        INSERT INTO shop_categories (slug, sort, modified_by_user, updated_at)
        VALUES (?, ?, ?, datetime('now'))
        ON CONFLICT(slug) DO UPDATE SET
          sort = excluded.sort, modified_by_user = excluded.modified_by_user, updated_at = datetime('now')
      `).run(data.slug, data.sort, data.modified_by_user)
      return this.findBySlug(data.slug)!
    },
    delete(slug: string) {
      return db.prepare('DELETE FROM shop_categories WHERE slug = ?').run(slug).changes > 0
    },
  }
}

// ─── Recreated converters (mirrors portal-config-db.ts) ───

function toAppPerkGroupMeta(row: any) {
  return {
    id: row.id,
    label: row.label,
    icon: row.icon,
    description: row.description,
    envKey: `NUXT_PERK_GROUP_${row.id.toUpperCase()}_ENABLED`,
  }
}

function toAppPerkDefinition(row: any) {
  return {
    id: row.id,
    group: row.group_id,
    name: row.name,
    icon: row.icon,
    description: row.description,
    successMessage: row.success_message,
    deliveryType: row.delivery_type,
    gameId: row.game_id,
    auraDurationMs: row.aura_duration_ms ?? undefined,
    requiredLevel: row.required_level,
    requiresOnline: row.requires_online === 1,
    oneTime: row.one_time === 1,
    defaultDiceSides: row.dice_sides,
    defaultRollThreshold: row.roll_threshold,
    defaultDailyLimit: row.daily_limit,
    accent: row.accent,
    envPrefix: row.env_prefix,
    rankGroup: row.rank_group ?? undefined,
    mailSubject: row.mail_subject ?? undefined,
    mailBody: row.mail_body ?? undefined,
    itemCount: row.item_count ?? undefined,
    failDebuffSpellId: row.fail_debuff_spell_id ?? undefined,
    failDebuffDurationMs: row.fail_debuff_duration_ms ?? undefined,
    critFailDebuffSpellId: row.critfail_debuff_spell_id ?? undefined,
    critFailDebuffDurationMs: row.critfail_debuff_duration_ms ?? undefined,
    teleportMapId: row.teleport_map_id ?? undefined,
    teleportX: row.teleport_x ?? undefined,
    teleportY: row.teleport_y ?? undefined,
    teleportZ: row.teleport_z ?? undefined,
    teleportO: row.teleport_o ?? undefined,
  }
}

// ─── Recreated sync/merge logic (mirrors portal-config-db.ts) ─

interface SyncReport {
  collection: string
  added: number
  updated: number
  skipped: number
  details: Array<{ id: string; action: 'added' | 'updated' | 'skipped'; reason?: string }>
}

function syncSettingsFromDefaults(
  settingsCRUD: ReturnType<typeof createSettingsCRUD>,
  defaults: Record<string, any>,
): SyncReport {
  const report: SyncReport = { collection: 'portal_settings', added: 0, updated: 0, skipped: 0, details: [] }
  const existing = settingsCRUD.get()

  if (!existing) {
    settingsCRUD.upsert({ ...defaults, modified_by_user: 0 })
    report.added = 1
    report.details.push({ id: '1', action: 'added' })
  } else if (existing.modified_by_user === 0) {
    settingsCRUD.upsert({ ...defaults, modified_by_user: 0 })
    report.updated = 1
    report.details.push({ id: '1', action: 'updated' })
  } else {
    report.skipped = 1
    report.details.push({ id: '1', action: 'skipped', reason: 'Modified by user' })
  }

  return report
}

function syncPerkGroupsFromDefaults(
  groupsCRUD: ReturnType<typeof createPerkGroupsCRUD>,
  defaults: Array<{ id: string; label: string; icon: string; description: string; enabled: boolean; sort: number }>,
): SyncReport {
  const report: SyncReport = { collection: 'perk_groups', added: 0, updated: 0, skipped: 0, details: [] }

  for (const def of defaults) {
    const existing = groupsCRUD.findById(def.id)
    if (!existing) {
      groupsCRUD.upsert({ id: def.id, label: def.label, icon: def.icon, description: def.description, enabled: def.enabled ? 1 : 0, sort: def.sort, modified_by_user: 0 })
      report.added++
      report.details.push({ id: def.id, action: 'added' })
    } else if (existing.modified_by_user === 0) {
      groupsCRUD.upsert({ id: def.id, label: def.label, icon: def.icon, description: def.description, enabled: def.enabled ? 1 : 0, sort: def.sort, modified_by_user: 0 })
      report.updated++
      report.details.push({ id: def.id, action: 'updated' })
    } else {
      report.skipped++
      report.details.push({ id: def.id, action: 'skipped', reason: 'Modified by user' })
    }
  }

  return report
}

function syncShopCategoriesFromDefaults(
  categoriesCRUD: ReturnType<typeof createShopCategoriesCRUD>,
  defaults: Array<{ slug: string; sort: number }>,
): SyncReport {
  const report: SyncReport = { collection: 'shop_categories', added: 0, updated: 0, skipped: 0, details: [] }

  for (const def of defaults) {
    const existing = categoriesCRUD.findBySlug(def.slug)
    if (!existing) {
      categoriesCRUD.upsert({ slug: def.slug, sort: def.sort, modified_by_user: 0 })
      report.added++
      report.details.push({ id: def.slug, action: 'added' })
    } else if (existing.modified_by_user === 0) {
      categoriesCRUD.upsert({ slug: def.slug, sort: def.sort, modified_by_user: 0 })
      report.updated++
      report.details.push({ id: def.slug, action: 'updated' })
    } else {
      report.skipped++
      report.details.push({ id: def.slug, action: 'skipped', reason: 'Modified by user' })
    }
  }

  return report
}

// ═════════════════════════════════════════════════════════════
// Tests
// ═════════════════════════════════════════════════════════════

describe('Portal Config DB: Schema', () => {
  it('creates all 4 tables', () => {
    const db = createTestDb()
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as Array<{ name: string }>
    const names = tables.map(t => t.name)
    expect(names).toContain('portal_settings')
    expect(names).toContain('perk_groups')
    expect(names).toContain('perks')
    expect(names).toContain('shop_categories')
    db.close()
  })

  it('enforces foreign keys on perks → perk_groups', () => {
    const db = createTestDb()
    const perks = createPerksCRUD(db)

    // Inserting a perk referencing a nonexistent group should fail
    expect(() => {
      perks.upsert({
        id: 'test-perk', group_id: 'nonexistent-group', name: 'Test', icon: '🎲',
        description: '', success_message: '', delivery_type: 'spell', game_id: 1,
        aura_duration_ms: null, required_level: 0, requires_online: 0, one_time: 0,
        dice_sides: 20, roll_threshold: 8, daily_limit: 5, accent: 'blue', env_prefix: 'TEST',
        rank_group: null, mail_subject: null, mail_body: null, item_count: null,
        fail_debuff_spell_id: null, fail_debuff_duration_ms: null,
        critfail_debuff_spell_id: null, critfail_debuff_duration_ms: null,
        teleport_map_id: null, teleport_x: null, teleport_y: null, teleport_z: null, teleport_o: null,
        sort: 1, modified_by_user: 0,
      })
    }).toThrow(/FOREIGN KEY/)
    db.close()
  })

  it('enforces unique slug on shop_categories', () => {
    const db = createTestDb()
    db.prepare("INSERT INTO shop_categories (slug, sort) VALUES ('weapons', 1)").run()
    expect(() => {
      db.prepare("INSERT INTO shop_categories (slug, sort) VALUES ('weapons', 2)").run()
    }).toThrow(/UNIQUE/)
    db.close()
  })
})

// ─── Portal Settings CRUD ─────────────────────────────────

describe('Portal Config DB: Settings CRUD', () => {
  let db: Database.Database
  let settings: ReturnType<typeof createSettingsCRUD>

  beforeEach(() => {
    db = createTestDb()
    settings = createSettingsCRUD(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns null/undefined when no settings exist', () => {
    expect(settings.get()).toBeFalsy()
  })

  it('inserts settings with defaults on first upsert', () => {
    const result = settings.upsert({ shop_enabled: 1, shop_delivery_method: 'bag', modified_by_user: 0 })
    expect(result).toBeDefined()
    expect(result.id).toBe(1)
    expect(result.shop_delivery_method).toBe('bag')
    expect(result.shop_enabled).toBe(1)
    expect(result.updated_at).toBeTruthy()
  })

  it('updates existing settings on second upsert', () => {
    settings.upsert({ shop_enabled: 1, shop_markup_percent: 20, modified_by_user: 0 })
    const updated = settings.upsert({ shop_markup_percent: 50, modified_by_user: 0 })
    expect(updated.shop_markup_percent).toBe(50)
    expect(updated.shop_enabled).toBe(1) // Unchanged field preserved
  })

  it('preserves modified_by_user flag', () => {
    settings.upsert({ shop_enabled: 1, modified_by_user: 1 })
    const result = settings.get()
    expect(result!.modified_by_user).toBe(1)
  })

  it('sets updated_at timestamp', () => {
    settings.upsert({ shop_enabled: 1, modified_by_user: 0 })
    const result = settings.get()
    expect(result!.updated_at).toBeTruthy()
  })
})

// ─── Perk Groups CRUD ─────────────────────────────────────

describe('Portal Config DB: Perk Groups CRUD', () => {
  let db: Database.Database
  let groups: ReturnType<typeof createPerkGroupsCRUD>

  beforeEach(() => {
    db = createTestDb()
    groups = createPerkGroupsCRUD(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns empty array when no groups exist', () => {
    expect(groups.findAll()).toEqual([])
  })

  it('inserts and retrieves a perk group', () => {
    groups.upsert({ id: 'buffs', label: 'Buffs', icon: '✨', description: 'Character buffs', enabled: 1, sort: 1, modified_by_user: 0 })
    const all = groups.findAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('buffs')
    expect(all[0].label).toBe('Buffs')
  })

  it('upserts (updates) an existing group', () => {
    groups.upsert({ id: 'buffs', label: 'Buffs', icon: '✨', description: '', enabled: 1, sort: 1, modified_by_user: 0 })
    groups.upsert({ id: 'buffs', label: 'Power Buffs', icon: '⚡', description: 'Updated', enabled: 0, sort: 2, modified_by_user: 1 })
    const g = groups.findById('buffs')
    expect(g!.label).toBe('Power Buffs')
    expect(g!.icon).toBe('⚡')
    expect(g!.enabled).toBe(0)
    expect(g!.modified_by_user).toBe(1)
  })

  it('deletes a group', () => {
    groups.upsert({ id: 'buffs', label: 'Buffs', icon: '✨', description: '', enabled: 1, sort: 1, modified_by_user: 0 })
    expect(groups.delete('buffs')).toBe(true)
    expect(groups.findById('buffs')).toBeNull()
  })

  it('returns false when deleting nonexistent group', () => {
    expect(groups.delete('nonexistent')).toBe(false)
  })

  it('returns groups ordered by sort', () => {
    groups.upsert({ id: 'scrolls', label: 'Scrolls', icon: '📜', description: '', enabled: 1, sort: 3, modified_by_user: 0 })
    groups.upsert({ id: 'buffs', label: 'Buffs', icon: '✨', description: '', enabled: 1, sort: 1, modified_by_user: 0 })
    groups.upsert({ id: 'mount', label: 'Mount', icon: '🐎', description: '', enabled: 1, sort: 2, modified_by_user: 0 })
    const all = groups.findAll()
    expect(all[0].id).toBe('buffs')
    expect(all[1].id).toBe('mount')
    expect(all[2].id).toBe('scrolls')
  })

  it('findById returns null for nonexistent id', () => {
    expect(groups.findById('nonexistent')).toBeNull()
  })
})

// ─── Perks CRUD ───────────────────────────────────────────

describe('Portal Config DB: Perks CRUD', () => {
  let db: Database.Database
  let groups: ReturnType<typeof createPerkGroupsCRUD>
  let perks: ReturnType<typeof createPerksCRUD>

  const testGroup = { id: 'buffs', label: 'Buffs', icon: '✨', description: '', enabled: 1, sort: 1, modified_by_user: 0 }

  function makePerk(overrides: Partial<any> = {}) {
    return {
      id: 'buff-strength-1', group_id: 'buffs', name: 'Strength I', icon: '💪',
      description: 'A buff', success_message: 'You feel strong!', delivery_type: 'aura',
      game_id: 8118, aura_duration_ms: 1800000, required_level: 10, requires_online: 1, one_time: 0,
      dice_sides: 20, roll_threshold: 8, daily_limit: 5, accent: 'orange', env_prefix: 'BUFF_STR_I',
      rank_group: 'buff-strength', mail_subject: null, mail_body: null, item_count: null,
      fail_debuff_spell_id: null, fail_debuff_duration_ms: 1800000,
      critfail_debuff_spell_id: null, critfail_debuff_duration_ms: null,
      teleport_map_id: null, teleport_x: null, teleport_y: null, teleport_z: null, teleport_o: null,
      sort: 1, modified_by_user: 0,
      ...overrides,
    }
  }

  beforeEach(() => {
    db = createTestDb()
    groups = createPerkGroupsCRUD(db)
    perks = createPerksCRUD(db)
    groups.upsert(testGroup)
  })

  afterEach(() => {
    db.close()
  })

  it('returns empty array when no perks exist', () => {
    expect(perks.findAll()).toEqual([])
  })

  it('inserts and retrieves a perk', () => {
    perks.upsert(makePerk())
    const all = perks.findAll()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe('buff-strength-1')
    expect(all[0].name).toBe('Strength I')
    expect(all[0].group_id).toBe('buffs')
    expect(all[0].aura_duration_ms).toBe(1800000)
  })

  it('finds perks by group', () => {
    groups.upsert({ id: 'mount', label: 'Mount', icon: '🐎', description: '', enabled: 1, sort: 2, modified_by_user: 0 })
    perks.upsert(makePerk({ id: 'buff-str-1', group_id: 'buffs', sort: 1 }))
    perks.upsert(makePerk({ id: 'mount-flying', group_id: 'mount', sort: 1 }))
    perks.upsert(makePerk({ id: 'buff-str-2', group_id: 'buffs', sort: 2 }))

    const buffPerks = perks.findByGroup('buffs')
    expect(buffPerks).toHaveLength(2)
    expect(buffPerks.every((p: any) => p.group_id === 'buffs')).toBe(true)

    const mountPerks = perks.findByGroup('mount')
    expect(mountPerks).toHaveLength(1)
    expect(mountPerks[0].id).toBe('mount-flying')
  })

  it('upserts (updates) an existing perk', () => {
    perks.upsert(makePerk())
    perks.upsert(makePerk({ name: 'Strength II', dice_sides: 10, modified_by_user: 1 }))
    const p = perks.findById('buff-strength-1')
    expect(p!.name).toBe('Strength II')
    expect(p!.dice_sides).toBe(10)
    expect(p!.modified_by_user).toBe(1)
  })

  it('deletes a perk', () => {
    perks.upsert(makePerk())
    expect(perks.delete('buff-strength-1')).toBe(true)
    expect(perks.findById('buff-strength-1')).toBeNull()
  })

  it('stores nullable fields correctly', () => {
    const perk = makePerk({
      teleport_map_id: 0, teleport_x: 10.5, teleport_y: -20.3,
      teleport_z: 100.0, teleport_o: 3.14, mail_subject: 'Test',
    })
    perks.upsert(perk)
    const stored = perks.findById('buff-strength-1')
    expect(stored!.teleport_x).toBeCloseTo(10.5)
    expect(stored!.teleport_y).toBeCloseTo(-20.3)
    expect(stored!.teleport_o).toBeCloseTo(3.14)
    expect(stored!.mail_subject).toBe('Test')
  })
})

// ─── Shop Categories CRUD ─────────────────────────────────

describe('Portal Config DB: Shop Categories CRUD', () => {
  let db: Database.Database
  let categories: ReturnType<typeof createShopCategoriesCRUD>

  beforeEach(() => {
    db = createTestDb()
    categories = createShopCategoriesCRUD(db)
  })

  afterEach(() => {
    db.close()
  })

  it('returns empty when no categories exist', () => {
    expect(categories.findAll()).toEqual([])
  })

  it('inserts and retrieves categories', () => {
    categories.upsert({ slug: 'weapons', sort: 1, modified_by_user: 0 })
    categories.upsert({ slug: 'armor', sort: 2, modified_by_user: 0 })
    const all = categories.findAll()
    expect(all).toHaveLength(2)
    expect(all[0].slug).toBe('weapons')
    expect(all[1].slug).toBe('armor')
  })

  it('upserts (updates) an existing category', () => {
    categories.upsert({ slug: 'weapons', sort: 1, modified_by_user: 0 })
    categories.upsert({ slug: 'weapons', sort: 10, modified_by_user: 1 })
    const cat = categories.findBySlug('weapons')
    expect(cat!.sort).toBe(10)
    expect(cat!.modified_by_user).toBe(1)
  })

  it('deletes a category', () => {
    categories.upsert({ slug: 'weapons', sort: 1, modified_by_user: 0 })
    expect(categories.delete('weapons')).toBe(true)
    expect(categories.findBySlug('weapons')).toBeNull()
  })

  it('returns ordered by sort', () => {
    categories.upsert({ slug: 'gems', sort: 5, modified_by_user: 0 })
    categories.upsert({ slug: 'weapons', sort: 1, modified_by_user: 0 })
    categories.upsert({ slug: 'armor', sort: 3, modified_by_user: 0 })
    const all = categories.findAll()
    expect(all[0].slug).toBe('weapons')
    expect(all[1].slug).toBe('armor')
    expect(all[2].slug).toBe('gems')
  })
})

// ─── Converters ───────────────────────────────────────────

describe('Portal Config DB: Converters', () => {
  it('toAppPerkGroupMeta converts DB row to PerkGroupMeta', () => {
    const row = { id: 'buffs', label: 'Buffs', icon: '✨', description: 'Char buffs', enabled: 1, sort: 1, modified_by_user: 0, updated_at: null }
    const result = toAppPerkGroupMeta(row)
    expect(result.id).toBe('buffs')
    expect(result.label).toBe('Buffs')
    expect(result.icon).toBe('✨')
    expect(result.description).toBe('Char buffs')
    expect(result.envKey).toBe('NUXT_PERK_GROUP_BUFFS_ENABLED')
  })

  it('toAppPerkGroupMeta generates correct envKey for multi-word groups', () => {
    const row = { id: 'teleport', label: 'Teleport', icon: '🌀', description: '', enabled: 1, sort: 1, modified_by_user: 0, updated_at: null }
    expect(toAppPerkGroupMeta(row).envKey).toBe('NUXT_PERK_GROUP_TELEPORT_ENABLED')
  })

  it('toAppPerkDefinition converts DB row to PerkDefinition', () => {
    const row = {
      id: 'buff-str-1', group_id: 'buffs', name: 'Strength I', icon: '💪',
      description: 'A buff', success_message: 'Strong!', delivery_type: 'aura',
      game_id: 8118, aura_duration_ms: 1800000, required_level: 10,
      requires_online: 1, one_time: 0,
      dice_sides: 20, roll_threshold: 8, daily_limit: 5,
      accent: 'orange', env_prefix: 'BUFF_STR_I', rank_group: 'buff-strength',
      mail_subject: null, mail_body: null, item_count: null,
      fail_debuff_spell_id: 11196, fail_debuff_duration_ms: 1800000,
      critfail_debuff_spell_id: null, critfail_debuff_duration_ms: null,
      teleport_map_id: null, teleport_x: null, teleport_y: null, teleport_z: null, teleport_o: null,
      sort: 1, modified_by_user: 0, updated_at: null,
    }

    const result = toAppPerkDefinition(row)
    expect(result.id).toBe('buff-str-1')
    expect(result.group).toBe('buffs')
    expect(result.name).toBe('Strength I')
    expect(result.deliveryType).toBe('aura')
    expect(result.gameId).toBe(8118)
    expect(result.auraDurationMs).toBe(1800000)
    expect(result.requiresOnline).toBe(true)
    expect(result.oneTime).toBe(false)
    expect(result.defaultDiceSides).toBe(20)
    expect(result.defaultRollThreshold).toBe(8)
    expect(result.defaultDailyLimit).toBe(5)
    expect(result.envPrefix).toBe('BUFF_STR_I')
    expect(result.rankGroup).toBe('buff-strength')
    expect(result.failDebuffSpellId).toBe(11196)
    expect(result.failDebuffDurationMs).toBe(1800000)
    // Null fields become undefined
    expect(result.mailSubject).toBeUndefined()
    expect(result.critFailDebuffSpellId).toBeUndefined()
    expect(result.teleportMapId).toBeUndefined()
  })

  it('toAppPerkDefinition handles integer boolean conversion', () => {
    const onlineRow = { requires_online: 1, one_time: 0, id: 'a', group_id: 'b', name: '', icon: '', description: '', success_message: '', delivery_type: 'spell', game_id: 0, aura_duration_ms: null, required_level: 0, dice_sides: 20, roll_threshold: 8, daily_limit: 5, accent: 'blue', env_prefix: '', rank_group: null, mail_subject: null, mail_body: null, item_count: null, fail_debuff_spell_id: null, fail_debuff_duration_ms: null, critfail_debuff_spell_id: null, critfail_debuff_duration_ms: null, teleport_map_id: null, teleport_x: null, teleport_y: null, teleport_z: null, teleport_o: null, sort: 0, modified_by_user: 0, updated_at: null }
    expect(toAppPerkDefinition(onlineRow).requiresOnline).toBe(true)
    expect(toAppPerkDefinition(onlineRow).oneTime).toBe(false)

    const offlineRow = { ...onlineRow, requires_online: 0, one_time: 1 }
    expect(toAppPerkDefinition(offlineRow).requiresOnline).toBe(false)
    expect(toAppPerkDefinition(offlineRow).oneTime).toBe(true)
  })
})

// ─── Merge/Sync Strategy ──────────────────────────────────

describe('Portal Config DB: Settings Sync', () => {
  let db: Database.Database
  let settings: ReturnType<typeof createSettingsCRUD>

  const defaultSettings = {
    shop_enabled: 1,
    shop_delivery_method: 'mail',
    shop_markup_percent: 20,
    shop_mail_subject: 'Your Shop Purchase',
    shop_mail_body: 'Thank you!',
    eluna_enabled: 1,
    eluna_shop_enabled: 1,
    eluna_gm_mail_enabled: 1,
    perk_fail_debuff_spell_id: 11196,
    perk_fail_debuff_duration_ms: 600000,
    perk_critfail_debuff_spell_id: 15007,
    perk_critfail_debuff_duration_ms: 600000,
  }

  beforeEach(() => {
    db = createTestDb()
    settings = createSettingsCRUD(db)
  })

  afterEach(() => {
    db.close()
  })

  it('inserts settings when none exist (added)', () => {
    const report = syncSettingsFromDefaults(settings, defaultSettings)
    expect(report.added).toBe(1)
    expect(report.updated).toBe(0)
    expect(report.skipped).toBe(0)
    expect(report.details[0].action).toBe('added')

    const result = settings.get()
    expect(result!.shop_markup_percent).toBe(20)
    expect(result!.modified_by_user).toBe(0)
  })

  it('updates settings when not modified by user (updated)', () => {
    settings.upsert({ ...defaultSettings, modified_by_user: 0 })

    const updatedDefaults = { ...defaultSettings, shop_markup_percent: 30 }
    const report = syncSettingsFromDefaults(settings, updatedDefaults)
    expect(report.updated).toBe(1)
    expect(report.skipped).toBe(0)

    const result = settings.get()
    expect(result!.shop_markup_percent).toBe(30)
  })

  it('skips settings when modified by user (skipped)', () => {
    settings.upsert({ ...defaultSettings, shop_markup_percent: 99, modified_by_user: 1 })

    const report = syncSettingsFromDefaults(settings, defaultSettings)
    expect(report.skipped).toBe(1)
    expect(report.updated).toBe(0)
    expect(report.details[0].action).toBe('skipped')
    expect(report.details[0].reason).toBe('Modified by user')

    // Original user value preserved
    expect(settings.get()!.shop_markup_percent).toBe(99)
  })
})

describe('Portal Config DB: Perk Groups Sync', () => {
  let db: Database.Database
  let groups: ReturnType<typeof createPerkGroupsCRUD>

  const defaultGroups = [
    { id: 'mount', label: 'Mount', icon: '🐎', description: 'Mount perks', enabled: true, sort: 1 },
    { id: 'buffs', label: 'Buffs', icon: '✨', description: 'Buff perks', enabled: true, sort: 2 },
    { id: 'scrolls', label: 'Scrolls', icon: '📜', description: 'Scroll perks', enabled: true, sort: 3 },
  ]

  beforeEach(() => {
    db = createTestDb()
    groups = createPerkGroupsCRUD(db)
  })

  afterEach(() => {
    db.close()
  })

  it('adds all groups when DB is empty', () => {
    const report = syncPerkGroupsFromDefaults(groups, defaultGroups)
    expect(report.added).toBe(3)
    expect(report.updated).toBe(0)
    expect(report.skipped).toBe(0)
    expect(groups.findAll()).toHaveLength(3)
  })

  it('updates unmodified groups', () => {
    // Seed with defaults
    syncPerkGroupsFromDefaults(groups, defaultGroups)

    // Sync again with updated label
    const updatedGroups = defaultGroups.map(g =>
      g.id === 'buffs' ? { ...g, label: 'Power Buffs' } : g
    )
    const report = syncPerkGroupsFromDefaults(groups, updatedGroups)
    expect(report.updated).toBe(3)
    expect(groups.findById('buffs')!.label).toBe('Power Buffs')
  })

  it('skips user-modified groups', () => {
    syncPerkGroupsFromDefaults(groups, defaultGroups)

    // User modifies buffs group
    groups.upsert({ id: 'buffs', label: 'My Custom Buffs', icon: '🔥', description: 'Custom', enabled: 1, sort: 2, modified_by_user: 1 })

    // Sync again — buffs should be skipped
    const report = syncPerkGroupsFromDefaults(groups, defaultGroups)
    expect(report.skipped).toBe(1)
    expect(report.updated).toBe(2) // mount and scrolls
    expect(groups.findById('buffs')!.label).toBe('My Custom Buffs')
  })

  it('adds new groups, keeping existing user-added groups', () => {
    syncPerkGroupsFromDefaults(groups, defaultGroups)

    // User adds a custom group
    groups.upsert({ id: 'custom', label: 'Custom', icon: '🎯', description: 'User group', enabled: 1, sort: 99, modified_by_user: 1 })

    // Sync with a new group in defaults
    const newDefaults = [...defaultGroups, { id: 'teleport', label: 'Teleport', icon: '🌀', description: 'Teleport perks', enabled: true, sort: 4 }]
    const report = syncPerkGroupsFromDefaults(groups, newDefaults)
    expect(report.added).toBe(1) // teleport
    expect(groups.findAll()).toHaveLength(5) // 3 existing + 1 user + 1 new
    expect(groups.findById('custom')).toBeTruthy() // User group preserved
    expect(groups.findById('teleport')).toBeTruthy() // New default added
  })

  it('mixed sync: add, update, skip', () => {
    // Seed 2 groups
    groups.upsert({ id: 'mount', label: 'Mount', icon: '🐎', description: '', enabled: 1, sort: 1, modified_by_user: 0 })
    groups.upsert({ id: 'buffs', label: 'User Buffs', icon: '🔥', description: 'Custom', enabled: 0, sort: 2, modified_by_user: 1 })

    // Sync with 3 groups (mount exists unmodified, buffs exists modified, scrolls is new)
    const report = syncPerkGroupsFromDefaults(groups, defaultGroups)
    expect(report.added).toBe(1)   // scrolls
    expect(report.updated).toBe(1) // mount
    expect(report.skipped).toBe(1) // buffs
  })
})

describe('Portal Config DB: Shop Categories Sync', () => {
  let db: Database.Database
  let categories: ReturnType<typeof createShopCategoriesCRUD>

  const defaultCategories = [
    { slug: 'weapons', sort: 1 },
    { slug: 'armor', sort: 2 },
    { slug: 'gems', sort: 3 },
  ]

  beforeEach(() => {
    db = createTestDb()
    categories = createShopCategoriesCRUD(db)
  })

  afterEach(() => {
    db.close()
  })

  it('adds all categories when DB is empty', () => {
    const report = syncShopCategoriesFromDefaults(categories, defaultCategories)
    expect(report.added).toBe(3)
    expect(categories.findAll()).toHaveLength(3)
  })

  it('updates unmodified categories', () => {
    syncShopCategoriesFromDefaults(categories, defaultCategories)

    const updatedDefaults = defaultCategories.map(c =>
      c.slug === 'gems' ? { ...c, sort: 10 } : c
    )
    const report = syncShopCategoriesFromDefaults(categories, updatedDefaults)
    expect(report.updated).toBe(3)
    expect(categories.findBySlug('gems')!.sort).toBe(10)
  })

  it('skips user-modified categories', () => {
    syncShopCategoriesFromDefaults(categories, defaultCategories)

    // User modifies weapons sort
    categories.upsert({ slug: 'weapons', sort: 99, modified_by_user: 1 })

    const report = syncShopCategoriesFromDefaults(categories, defaultCategories)
    expect(report.skipped).toBe(1)
    expect(report.updated).toBe(2)
    expect(categories.findBySlug('weapons')!.sort).toBe(99) // Preserved
  })

  it('preserves user-added categories not in defaults', () => {
    syncShopCategoriesFromDefaults(categories, defaultCategories)
    categories.upsert({ slug: 'custom_stuff', sort: 50, modified_by_user: 1 })

    syncShopCategoriesFromDefaults(categories, defaultCategories)
    expect(categories.findBySlug('custom_stuff')).toBeTruthy()
    expect(categories.findAll()).toHaveLength(4)
  })
})

// ─── Config Backend Detection ─────────────────────────────

describe('Portal Config DB: getConfigBackend', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  // Recreate the logic to test it purely
  function getConfigBackend(): 'env' | 'directus' | 'self-managed' {
    const backend = process.env.NUXT_CONFIG_BACKEND || 'env'
    if (backend === 'self-managed') return 'self-managed'
    if (backend === 'directus') return 'directus'
    return 'env'
  }

  function isSelfManagedEnabled(): boolean {
    return getConfigBackend() === 'self-managed'
  }

  it('defaults to env when no NUXT_CONFIG_BACKEND set', () => {
    delete process.env.NUXT_CONFIG_BACKEND
    expect(getConfigBackend()).toBe('env')
  })

  it('returns self-managed when explicitly set', () => {
    process.env.NUXT_CONFIG_BACKEND = 'self-managed'
    expect(getConfigBackend()).toBe('self-managed')
  })

  it('returns directus when explicitly set', () => {
    process.env.NUXT_CONFIG_BACKEND = 'directus'
    expect(getConfigBackend()).toBe('directus')
  })

  it('returns env for any unknown value', () => {
    process.env.NUXT_CONFIG_BACKEND = 'something-else'
    expect(getConfigBackend()).toBe('env')
  })

  it('isSelfManagedEnabled returns true only for self-managed', () => {
    process.env.NUXT_CONFIG_BACKEND = 'self-managed'
    expect(isSelfManagedEnabled()).toBe(true)

    process.env.NUXT_CONFIG_BACKEND = 'directus'
    expect(isSelfManagedEnabled()).toBe(false)

    process.env.NUXT_CONFIG_BACKEND = 'env'
    expect(isSelfManagedEnabled()).toBe(false)

    delete process.env.NUXT_CONFIG_BACKEND
    expect(isSelfManagedEnabled()).toBe(false)
  })
})
