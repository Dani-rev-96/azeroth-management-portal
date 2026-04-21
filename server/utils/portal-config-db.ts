/**
 * Self-Managed Portal Configuration Database
 *
 * SQLite-based configuration backend that stores portal settings,
 * perk groups, perks, and shop categories locally.
 *
 * This is one of three configuration backends:
 *   1. Environment variables + hardcoded (always available)
 *   2. Directus CMS (optional, remote)
 *   3. Self-managed SQLite (this file — local, editable via admin panel)
 *
 * Enable via: NUXT_CONFIG_BACKEND=self-managed
 *
 * Merge strategy for "update from hardcoded defaults":
 *   - New items (not in DB) → INSERT
 *   - Existing items with modified_by_user=0 → UPDATE (safe, user hasn't touched them)
 *   - Existing items with modified_by_user=1 → SKIP (user has customized)
 *   - Items in DB not in hardcoded → KEEP (user-added)
 *
 * SERVER-SIDE ONLY
 */

import Database from 'better-sqlite3'
import { join, dirname } from 'path'
import { existsSync, mkdirSync, statSync } from 'fs'
import type { PerkDefinition, PerkGroupMeta } from '#shared/utils/perks'

// ─── Types ────────────────────────────────────────────────

export interface PortalSettings {
  id: number
  shop_enabled: number // 0 or 1
  shop_delivery_method: string
  shop_markup_percent: number
  shop_mail_subject: string
  shop_mail_body: string
  eluna_enabled: number
  eluna_shop_enabled: number
  eluna_gm_mail_enabled: number
  perk_fail_debuff_spell_id: number
  perk_fail_debuff_duration_ms: number
  perk_critfail_debuff_spell_id: number
  perk_critfail_debuff_duration_ms: number
  modified_by_user: number
  updated_at: string | null
}

export interface PortalPerkGroup {
  id: string
  label: string
  icon: string
  description: string
  enabled: number // 0 or 1
  sort: number
  modified_by_user: number
  updated_at: string | null
}

export interface PortalPerk {
  id: string
  group_id: string
  name: string
  icon: string
  description: string
  success_message: string
  delivery_type: string
  game_id: number
  aura_duration_ms: number | null
  required_level: number
  requires_online: number
  one_time: number
  dice_sides: number
  roll_threshold: number
  daily_limit: number
  accent: string
  env_prefix: string
  rank_group: string | null
  mail_subject: string | null
  mail_body: string | null
  item_count: number | null
  fail_debuff_spell_id: number | null
  fail_debuff_duration_ms: number | null
  critfail_debuff_spell_id: number | null
  critfail_debuff_duration_ms: number | null
  teleport_map_id: number | null
  teleport_x: number | null
  teleport_y: number | null
  teleport_z: number | null
  teleport_o: number | null
  sort: number
  modified_by_user: number
  updated_at: string | null
}

export interface PortalShopCategory {
  id: number
  slug: string
  sort: number
  modified_by_user: number
  updated_at: string | null
}

export interface SyncReport {
  collection: string
  added: number
  updated: number
  skipped: number
  details: SyncDetail[]
}

export interface SyncDetail {
  id: string
  action: 'added' | 'updated' | 'skipped'
  reason?: string
}

// ─── Database Connection ──────────────────────────────────

const DB_PATH = process.env.PORTAL_CONFIG_DB_PATH || join(process.cwd(), 'data', 'portal-config.db')
const CHECKPOINT_INTERVAL_MS = 5 * 60 * 1000

let db: Database.Database | null = null
let checkpointTimer: ReturnType<typeof setInterval> | null = null
let shutdownHandlersRegistered = false

export function getPortalConfigDatabase(): Database.Database {
  if (!db) {
    const dataDir = dirname(DB_PATH)
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true })
    }

    // ─── Pre-open diagnostics ───
    try {
      const exists = existsSync(DB_PATH)
      const size = exists ? statSync(DB_PATH).size : 0
      console.log(
        `[PortalConfigDB] Opening DB path=${DB_PATH} cwd=${process.cwd()} exists=${exists} size=${size} NUXT_CONFIG_BACKEND=${process.env.NUXT_CONFIG_BACKEND || '(unset)'}`
      )
      if (!exists && process.env.NUXT_CONFIG_BACKEND === 'self-managed') {
        console.error(
          `[PortalConfigDB] ⚠️  WARNING: DB file does not exist at ${DB_PATH} but NUXT_CONFIG_BACKEND=self-managed. ` +
          `A NEW empty database will be created here — any existing data will appear to be missing. ` +
          `Check that PORTAL_CONFIG_DB_PATH points into a mounted persistent volume.`
        )
      }
    } catch (err) {
      console.warn('[PortalConfigDB] Pre-open stat failed:', err)
    }

    db = new Database(DB_PATH)

    // ─── Integrity check before any writes ───
    try {
      const integrity = db.pragma('integrity_check') as Array<{ integrity_check: string }>
      const quick = db.pragma('quick_check') as Array<{ quick_check: string }>
      const integrityResult = integrity?.[0]?.integrity_check ?? 'unknown'
      const quickResult = quick?.[0]?.quick_check ?? 'unknown'
      if (integrityResult !== 'ok' || quickResult !== 'ok') {
        console.error(
          `[PortalConfigDB] ERROR integrity_check=${integrityResult} quick_check=${quickResult} — database may be corrupt`
        )
      } else {
        console.log(`[PortalConfigDB] integrity_check=ok quick_check=ok`)
      }
    } catch (err) {
      console.error('[PortalConfigDB] Integrity check threw:', err)
    }

    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')

    // ─── Post-pragma diagnostics ───
    try {
      const journalMode = db.pragma('journal_mode', { simple: true })
      const foreignKeys = db.pragma('foreign_keys', { simple: true })
      const userVersion = db.pragma('user_version', { simple: true })
      console.log(
        `[PortalConfigDB] pragmas journal_mode=${journalMode} foreign_keys=${foreignKeys} user_version=${userVersion}`
      )
    } catch (err) {
      console.warn('[PortalConfigDB] Pragma read failed:', err)
    }

    initPortalConfigSchema()

    // ─── Post-schema diagnostics ───
    try {
      const tables = (db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        .all() as Array<{ name: string }>).map(r => r.name)
      console.log(`[PortalConfigDB] tables=[${tables.join(',')}]`)

      const countOf = (t: string): number | string => {
        try {
          return ((db!.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n)
        } catch (err) {
          return `err(${(err as Error).message})`
        }
      }
      console.log(
        `[PortalConfigDB] rows portal_settings=${countOf('portal_settings')} perk_groups=${countOf('perk_groups')} perks=${countOf('perks')} shop_categories=${countOf('shop_categories')}`
      )
    } catch (err) {
      console.warn('[PortalConfigDB] Row-count diagnostics failed:', err)
    }

    startPeriodicCheckpoint()
    registerShutdownHandlers()
  }
  return db
}

// ─── Schema ───────────────────────────────────────────────

function initPortalConfigSchema() {
  if (!db) return

  db.exec(`
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

    CREATE INDEX IF NOT EXISTS idx_perks_group ON perks(group_id);
    CREATE INDEX IF NOT EXISTS idx_perks_sort ON perks(sort);

    CREATE TABLE IF NOT EXISTS shop_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT NOT NULL UNIQUE,
      sort INTEGER NOT NULL DEFAULT 0,
      modified_by_user INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_shop_categories_sort ON shop_categories(sort);
  `)
}

// ─── Configuration Check ──────────────────────────────────

export type ConfigBackend = 'env' | 'directus' | 'self-managed'

export function getConfigBackend(): ConfigBackend {
  const backend = process.env.NUXT_CONFIG_BACKEND || 'env'
  if (backend === 'self-managed') return 'self-managed'
  if (backend === 'directus') return 'directus'
  return 'env'
}

export function isSelfManagedEnabled(): boolean {
  return getConfigBackend() === 'self-managed'
}

// ─── Portal Settings CRUD ─────────────────────────────────

export const PortalSettingsDB = {
  get(): PortalSettings | null {
    const db = getPortalConfigDatabase()
    return db.prepare('SELECT * FROM portal_settings WHERE id = 1').get() as PortalSettings | null
  },

  upsert(data: Partial<Omit<PortalSettings, 'id' | 'updated_at'>>): PortalSettings {
    const db = getPortalConfigDatabase()
    const existing = this.get()

    if (!existing) {
      // Insert with defaults + overrides
      const fields = Object.keys(data).filter(k => k !== 'id')
      const cols = ['id', ...fields, 'updated_at'].join(', ')
      const placeholders = ['1', ...fields.map(() => '?'), "datetime('now')"].join(', ')
      db.prepare(`INSERT INTO portal_settings (${cols}) VALUES (${placeholders})`).run(
        ...fields.map(k => (data as any)[k])
      )
    } else {
      const fields = Object.keys(data).filter(k => k !== 'id')
      if (fields.length === 0) return existing
      const sets = [...fields.map(k => `${k} = ?`), "updated_at = datetime('now')"].join(', ')
      db.prepare(`UPDATE portal_settings SET ${sets} WHERE id = 1`).run(
        ...fields.map(k => (data as any)[k])
      )
    }

    return this.get()!
  },

  /** Mark as user-modified */
  markUserModified(): void {
    const db = getPortalConfigDatabase()
    db.prepare("UPDATE portal_settings SET modified_by_user = 1, updated_at = datetime('now') WHERE id = 1").run()
  },
}

// ─── Perk Groups CRUD ─────────────────────────────────────

export const PerkGroupsDB = {
  findAll(): PortalPerkGroup[] {
    const db = getPortalConfigDatabase()
    return db.prepare('SELECT * FROM perk_groups ORDER BY sort ASC').all() as PortalPerkGroup[]
  },

  findById(id: string): PortalPerkGroup | null {
    const db = getPortalConfigDatabase()
    return (db.prepare('SELECT * FROM perk_groups WHERE id = ?').get(id) as PortalPerkGroup) ?? null
  },

  upsert(data: Omit<PortalPerkGroup, 'updated_at'>): PortalPerkGroup {
    const db = getPortalConfigDatabase()
    db.prepare(`
      INSERT INTO perk_groups (id, label, icon, description, enabled, sort, modified_by_user, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(id) DO UPDATE SET
        label = excluded.label,
        icon = excluded.icon,
        description = excluded.description,
        enabled = excluded.enabled,
        sort = excluded.sort,
        modified_by_user = excluded.modified_by_user,
        updated_at = datetime('now')
    `).run(data.id, data.label, data.icon, data.description, data.enabled, data.sort, data.modified_by_user)
    return this.findById(data.id)!
  },

  delete(id: string): boolean {
    const db = getPortalConfigDatabase()
    const result = db.prepare('DELETE FROM perk_groups WHERE id = ?').run(id)
    return result.changes > 0
  },
}

// ─── Perks CRUD ───────────────────────────────────────────

export const PerksDB = {
  findAll(): PortalPerk[] {
    const db = getPortalConfigDatabase()
    return db.prepare('SELECT * FROM perks ORDER BY sort ASC').all() as PortalPerk[]
  },

  findByGroup(groupId: string): PortalPerk[] {
    const db = getPortalConfigDatabase()
    return db.prepare('SELECT * FROM perks WHERE group_id = ? ORDER BY sort ASC').all(groupId) as PortalPerk[]
  },

  findById(id: string): PortalPerk | null {
    const db = getPortalConfigDatabase()
    return (db.prepare('SELECT * FROM perks WHERE id = ?').get(id) as PortalPerk) ?? null
  },

  upsert(data: Omit<PortalPerk, 'updated_at'>): PortalPerk {
    const db = getPortalConfigDatabase()
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
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?,
        ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, datetime('now')
      )
      ON CONFLICT(id) DO UPDATE SET
        group_id = excluded.group_id,
        name = excluded.name,
        icon = excluded.icon,
        description = excluded.description,
        success_message = excluded.success_message,
        delivery_type = excluded.delivery_type,
        game_id = excluded.game_id,
        aura_duration_ms = excluded.aura_duration_ms,
        required_level = excluded.required_level,
        requires_online = excluded.requires_online,
        one_time = excluded.one_time,
        dice_sides = excluded.dice_sides,
        roll_threshold = excluded.roll_threshold,
        daily_limit = excluded.daily_limit,
        accent = excluded.accent,
        env_prefix = excluded.env_prefix,
        rank_group = excluded.rank_group,
        mail_subject = excluded.mail_subject,
        mail_body = excluded.mail_body,
        item_count = excluded.item_count,
        fail_debuff_spell_id = excluded.fail_debuff_spell_id,
        fail_debuff_duration_ms = excluded.fail_debuff_duration_ms,
        critfail_debuff_spell_id = excluded.critfail_debuff_spell_id,
        critfail_debuff_duration_ms = excluded.critfail_debuff_duration_ms,
        teleport_map_id = excluded.teleport_map_id,
        teleport_x = excluded.teleport_x,
        teleport_y = excluded.teleport_y,
        teleport_z = excluded.teleport_z,
        teleport_o = excluded.teleport_o,
        sort = excluded.sort,
        modified_by_user = excluded.modified_by_user,
        updated_at = datetime('now')
    `).run(
      data.id, data.group_id, data.name, data.icon, data.description, data.success_message, data.delivery_type,
      data.game_id, data.aura_duration_ms, data.required_level, data.requires_online, data.one_time,
      data.dice_sides, data.roll_threshold, data.daily_limit, data.accent, data.env_prefix,
      data.rank_group, data.mail_subject, data.mail_body, data.item_count,
      data.fail_debuff_spell_id, data.fail_debuff_duration_ms,
      data.critfail_debuff_spell_id, data.critfail_debuff_duration_ms,
      data.teleport_map_id, data.teleport_x, data.teleport_y, data.teleport_z, data.teleport_o,
      data.sort, data.modified_by_user
    )
    return this.findById(data.id)!
  },

  delete(id: string): boolean {
    const db = getPortalConfigDatabase()
    const result = db.prepare('DELETE FROM perks WHERE id = ?').run(id)
    return result.changes > 0
  },
}

// ─── Shop Categories CRUD ─────────────────────────────────

export const ShopCategoriesDB = {
  findAll(): PortalShopCategory[] {
    const db = getPortalConfigDatabase()
    return db.prepare('SELECT * FROM shop_categories ORDER BY sort ASC').all() as PortalShopCategory[]
  },

  findBySlug(slug: string): PortalShopCategory | null {
    const db = getPortalConfigDatabase()
    return (db.prepare('SELECT * FROM shop_categories WHERE slug = ?').get(slug) as PortalShopCategory) ?? null
  },

  upsert(data: { slug: string; sort: number; modified_by_user: number }): PortalShopCategory {
    const db = getPortalConfigDatabase()
    db.prepare(`
      INSERT INTO shop_categories (slug, sort, modified_by_user, updated_at)
      VALUES (?, ?, ?, datetime('now'))
      ON CONFLICT(slug) DO UPDATE SET
        sort = excluded.sort,
        modified_by_user = excluded.modified_by_user,
        updated_at = datetime('now')
    `).run(data.slug, data.sort, data.modified_by_user)
    return this.findBySlug(data.slug)!
  },

  delete(slug: string): boolean {
    const db = getPortalConfigDatabase()
    const result = db.prepare('DELETE FROM shop_categories WHERE slug = ?').run(slug)
    return result.changes > 0
  },
}

// ─── Converters: DB → App Types ───────────────────────────

export function toAppPerkGroupMeta(row: PortalPerkGroup): PerkGroupMeta {
  return {
    id: row.id as PerkGroupMeta['id'],
    label: row.label,
    icon: row.icon,
    description: row.description,
    envKey: `NUXT_PERK_GROUP_${row.id.toUpperCase()}_ENABLED`,
  }
}

export function toAppPerkDefinition(row: PortalPerk): PerkDefinition {
  return {
    id: row.id,
    group: row.group_id as PerkDefinition['group'],
    name: row.name,
    icon: row.icon,
    description: row.description,
    successMessage: row.success_message,
    deliveryType: row.delivery_type as PerkDefinition['deliveryType'],
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

// ─── Merge / Sync from Hardcoded Defaults ─────────────────

/**
 * Sync portal settings from hardcoded defaults.
 * Only updates if not modified by user.
 */
export function syncSettingsFromDefaults(defaults: Omit<PortalSettings, 'id' | 'modified_by_user' | 'updated_at'>): SyncReport {
  const report: SyncReport = { collection: 'portal_settings', added: 0, updated: 0, skipped: 0, details: [] }
  const existing = PortalSettingsDB.get()

  if (!existing) {
    PortalSettingsDB.upsert({ ...defaults, modified_by_user: 0 })
    report.added = 1
    report.details.push({ id: '1', action: 'added' })
  } else if (existing.modified_by_user === 0) {
    PortalSettingsDB.upsert({ ...defaults, modified_by_user: 0 })
    report.updated = 1
    report.details.push({ id: '1', action: 'updated' })
  } else {
    report.skipped = 1
    report.details.push({ id: '1', action: 'skipped', reason: 'Modified by user' })
  }

  return report
}

/**
 * Sync perk groups from hardcoded defaults.
 * Respects modified_by_user flag per group.
 */
export function syncPerkGroupsFromDefaults(defaults: Array<{ id: string; label: string; icon: string; description: string; enabled: boolean; sort: number }>): SyncReport {
  const report: SyncReport = { collection: 'perk_groups', added: 0, updated: 0, skipped: 0, details: [] }

  for (const def of defaults) {
    const existing = PerkGroupsDB.findById(def.id)

    if (!existing) {
      PerkGroupsDB.upsert({
        id: def.id, label: def.label, icon: def.icon, description: def.description,
        enabled: def.enabled ? 1 : 0, sort: def.sort, modified_by_user: 0,
      })
      report.added++
      report.details.push({ id: def.id, action: 'added' })
    } else if (existing.modified_by_user === 0) {
      PerkGroupsDB.upsert({
        id: def.id, label: def.label, icon: def.icon, description: def.description,
        enabled: def.enabled ? 1 : 0, sort: def.sort, modified_by_user: 0,
      })
      report.updated++
      report.details.push({ id: def.id, action: 'updated' })
    } else {
      report.skipped++
      report.details.push({ id: def.id, action: 'skipped', reason: 'Modified by user' })
    }
  }

  return report
}

/**
 * Sync perks from hardcoded defaults.
 * Respects modified_by_user flag per perk.
 */
export function syncPerksFromDefaults(defaults: Array<{
  id: string; group: string; name: string; icon: string; description: string;
  success_message: string; delivery_type: string; game_id: number;
  aura_duration_ms: number | null; required_level: number; requires_online: boolean;
  one_time: boolean; dice_sides: number; roll_threshold: number; daily_limit: number;
  accent: string; env_prefix: string; rank_group: string | null;
  mail_subject: string | null; mail_body: string | null; item_count: number | null;
  fail_debuff_spell_id: number | null; fail_debuff_duration_ms: number | null;
  critfail_debuff_spell_id: number | null; critfail_debuff_duration_ms: number | null;
  teleport_map_id: number | null; teleport_x: number | null; teleport_y: number | null;
  teleport_z: number | null; teleport_o: number | null; sort: number;
}>): SyncReport {
  const report: SyncReport = { collection: 'perks', added: 0, updated: 0, skipped: 0, details: [] }

  for (const def of defaults) {
    const existing = PerksDB.findById(def.id)

    if (!existing) {
      PerksDB.upsert({
        id: def.id, group_id: def.group, name: def.name, icon: def.icon, description: def.description,
        success_message: def.success_message, delivery_type: def.delivery_type, game_id: def.game_id,
        aura_duration_ms: def.aura_duration_ms, required_level: def.required_level,
        requires_online: def.requires_online ? 1 : 0, one_time: def.one_time ? 1 : 0,
        dice_sides: def.dice_sides, roll_threshold: def.roll_threshold, daily_limit: def.daily_limit,
        accent: def.accent, env_prefix: def.env_prefix, rank_group: def.rank_group,
        mail_subject: def.mail_subject, mail_body: def.mail_body, item_count: def.item_count,
        fail_debuff_spell_id: def.fail_debuff_spell_id, fail_debuff_duration_ms: def.fail_debuff_duration_ms,
        critfail_debuff_spell_id: def.critfail_debuff_spell_id, critfail_debuff_duration_ms: def.critfail_debuff_duration_ms,
        teleport_map_id: def.teleport_map_id, teleport_x: def.teleport_x, teleport_y: def.teleport_y,
        teleport_z: def.teleport_z, teleport_o: def.teleport_o, sort: def.sort, modified_by_user: 0,
      })
      report.added++
      report.details.push({ id: def.id, action: 'added' })
    } else if (existing.modified_by_user === 0) {
      PerksDB.upsert({
        id: def.id, group_id: def.group, name: def.name, icon: def.icon, description: def.description,
        success_message: def.success_message, delivery_type: def.delivery_type, game_id: def.game_id,
        aura_duration_ms: def.aura_duration_ms, required_level: def.required_level,
        requires_online: def.requires_online ? 1 : 0, one_time: def.one_time ? 1 : 0,
        dice_sides: def.dice_sides, roll_threshold: def.roll_threshold, daily_limit: def.daily_limit,
        accent: def.accent, env_prefix: def.env_prefix, rank_group: def.rank_group,
        mail_subject: def.mail_subject, mail_body: def.mail_body, item_count: def.item_count,
        fail_debuff_spell_id: def.fail_debuff_spell_id, fail_debuff_duration_ms: def.fail_debuff_duration_ms,
        critfail_debuff_spell_id: def.critfail_debuff_spell_id, critfail_debuff_duration_ms: def.critfail_debuff_duration_ms,
        teleport_map_id: def.teleport_map_id, teleport_x: def.teleport_x, teleport_y: def.teleport_y,
        teleport_z: def.teleport_z, teleport_o: def.teleport_o, sort: def.sort, modified_by_user: 0,
      })
      report.updated++
      report.details.push({ id: def.id, action: 'updated' })
    } else {
      report.skipped++
      report.details.push({ id: def.id, action: 'skipped', reason: 'Modified by user' })
    }
  }

  return report
}

/**
 * Sync shop categories from hardcoded defaults.
 * Respects modified_by_user flag per category.
 */
export function syncShopCategoriesFromDefaults(defaults: Array<{ slug: string; sort: number }>): SyncReport {
  const report: SyncReport = { collection: 'shop_categories', added: 0, updated: 0, skipped: 0, details: [] }

  for (const def of defaults) {
    const existing = ShopCategoriesDB.findBySlug(def.slug)

    if (!existing) {
      ShopCategoriesDB.upsert({ slug: def.slug, sort: def.sort, modified_by_user: 0 })
      report.added++
      report.details.push({ id: def.slug, action: 'added' })
    } else if (existing.modified_by_user === 0) {
      ShopCategoriesDB.upsert({ slug: def.slug, sort: def.sort, modified_by_user: 0 })
      report.updated++
      report.details.push({ id: def.slug, action: 'updated' })
    } else {
      report.skipped++
      report.details.push({ id: def.slug, action: 'skipped', reason: 'Modified by user' })
    }
  }

  return report
}

/**
 * Full sync: Update all collections from hardcoded app defaults.
 * Called from the sync API route which provides the hardcoded data.
 * (Individual sync*FromDefaults functions are exported for use by the route.)
 */

// ─── Public API for Config Resolution ─────────────────────

/**
 * Get portal settings from the self-managed database.
 * Returns null if self-managed is not enabled or DB is empty.
 */
export function getSelfManagedSettings(): PortalSettings | null {
  if (!isSelfManagedEnabled()) {
    console.log('[PortalConfigDB] getSelfManagedSettings backend=off (NUXT_CONFIG_BACKEND!=self-managed) → null')
    return null
  }
  const row = PortalSettingsDB.get()
  console.log(`[PortalConfigDB] getSelfManagedSettings backend=self-managed found=${!!row}`)
  return row
}

/**
 * Get perk groups from the self-managed database.
 * Returns null if self-managed is not enabled or DB is empty.
 */
export function getSelfManagedPerkGroups(): PortalPerkGroup[] | null {
  if (!isSelfManagedEnabled()) {
    console.log('[PortalConfigDB] getSelfManagedPerkGroups backend=off → null')
    return null
  }
  const groups = PerkGroupsDB.findAll()
  console.log(`[PortalConfigDB] getSelfManagedPerkGroups backend=self-managed rows=${groups.length}${groups.length === 0 ? ' (empty → null)' : ''}`)
  return groups.length > 0 ? groups : null
}

/**
 * Get perks from the self-managed database.
 * Returns null if self-managed is not enabled or DB is empty.
 */
export function getSelfManagedPerks(): PortalPerk[] | null {
  if (!isSelfManagedEnabled()) {
    console.log('[PortalConfigDB] getSelfManagedPerks backend=off → null')
    return null
  }
  const perks = PerksDB.findAll()
  console.log(`[PortalConfigDB] getSelfManagedPerks backend=self-managed rows=${perks.length}${perks.length === 0 ? ' (empty → null)' : ''}`)
  return perks.length > 0 ? perks : null
}

/**
 * Get shop categories from the self-managed database.
 * Returns null if self-managed is not enabled or DB is empty.
 */
export function getSelfManagedShopCategories(): PortalShopCategory[] | null {
  if (!isSelfManagedEnabled()) {
    console.log('[PortalConfigDB] getSelfManagedShopCategories backend=off → null')
    return null
  }
  const categories = ShopCategoriesDB.findAll()
  console.log(`[PortalConfigDB] getSelfManagedShopCategories backend=self-managed rows=${categories.length}${categories.length === 0 ? ' (empty → null)' : ''}`)
  return categories.length > 0 ? categories : null
}

// ─── Lifecycle ────────────────────────────────────────────

function startPeriodicCheckpoint() {
  if (checkpointTimer) return

  checkpointTimer = setInterval(() => {
    if (!db) return
    try {
      const result = db.pragma('wal_checkpoint(PASSIVE)') as Array<{ busy: number; log: number; checkpointed: number }>
      const first = result[0]
      if (first && first.log > 0) {
        console.log(`[PortalConfig] Checkpoint: ${first.checkpointed}/${first.log} pages`)
      }
    } catch (error) {
      console.error('[PortalConfig] Checkpoint failed:', error)
    }
  }, CHECKPOINT_INTERVAL_MS)

  checkpointTimer.unref()
}

function registerShutdownHandlers() {
  if (shutdownHandlersRegistered) return
  shutdownHandlersRegistered = true

  const shutdown = () => {
    closePortalConfigDatabase()
  }

  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
  process.on('beforeExit', shutdown)
}

export function closePortalConfigDatabase() {
  if (checkpointTimer) {
    clearInterval(checkpointTimer)
    checkpointTimer = null
  }

  if (db) {
    try {
      db.pragma('wal_checkpoint(TRUNCATE)')
      console.log('[PortalConfig] Final checkpoint completed')
    } catch (error) {
      console.error('[PortalConfig] Final checkpoint failed:', error)
    }

    db.close()
    db = null
    console.log('[PortalConfig] Database connection closed')
  }
}
