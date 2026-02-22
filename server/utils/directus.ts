/**
 * Directus CMS Integration — Server-side client
 *
 * Fetches configuration data from a Directus instance when enabled.
 * Uses plain $fetch (no SDK dependency) against the Directus REST API.
 *
 * Enable by setting:
 *   NUXT_DIRECTUS_ENABLED=true
 *   NUXT_DIRECTUS_URL=http://localhost:8055
 *   NUXT_DIRECTUS_TOKEN=<static-token>
 *
 * When disabled (default), all functions return null and the app
 * falls back to environment variables and hardcoded registry data.
 *
 * SERVER-SIDE ONLY — Contains auth token.
 */

import type { PerkDefinition, PerkGroup, PerkGroupMeta } from '#shared/utils/perks'

// ─── Types for Directus collection items ──────────────────

export interface DirectusPortalSettings {
  id: number
  /** Shop */
  shop_enabled: boolean
  shop_delivery_method: 'mail' | 'bag' | 'both'
  shop_markup_percent: number
  shop_mail_subject: string
  shop_mail_body: string
  /** Eluna */
  eluna_enabled: boolean
  eluna_shop_enabled: boolean
  eluna_gm_mail_enabled: boolean
  /** Perk debuff defaults */
  perk_fail_debuff_spell_id: number
  perk_fail_debuff_duration_ms: number
  perk_critfail_debuff_spell_id: number
  perk_critfail_debuff_duration_ms: number
}

export interface DirectusPerkGroup {
  id: string          // e.g. 'mount'
  label: string
  icon: string
  description: string
  enabled: boolean
  sort: number
}

export interface DirectusPerk {
  id: string          // e.g. 'flying'
  group: string       // FK → perk_groups.id
  name: string
  icon: string
  description: string
  success_message: string
  delivery_type: string
  game_id: number
  aura_duration_ms: number | null
  required_level: number
  requires_online: boolean
  one_time: boolean
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
}

export interface DirectusShopCategory {
  id: number
  slug: string
  sort: number
}

// ─── Configuration ────────────────────────────────────────

function getDirectusConfig() {
  return {
    enabled: process.env.NUXT_DIRECTUS_ENABLED === 'true',
    url: (process.env.NUXT_DIRECTUS_URL || process.env.NUXT_PUBLIC_DIRECTUS_URL || 'http://localhost:8055').replace(/\/$/, ''),
    token: process.env.NUXT_DIRECTUS_TOKEN || '',
  }
}

export function isDirectusEnabled(): boolean {
  const cfg = getDirectusConfig()
  return cfg.enabled && !!cfg.url && !!cfg.token
}

// ─── Internal fetch helper ────────────────────────────────

async function directusFetch<T>(path: string, query?: Record<string, string>): Promise<T | null> {
  const cfg = getDirectusConfig()
  if (!cfg.enabled || !cfg.url || !cfg.token) return null

  try {
    const url = new URL(`/items${path}`, cfg.url)
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        url.searchParams.set(k, v)
      }
    }

    const response = await $fetch<{ data: T }>(url.toString(), {
      headers: { Authorization: `Bearer ${cfg.token}` },
      timeout: 5000,
    })
    return response.data
  }
  catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn(`[Directus] Failed to fetch ${path}: ${message}`)
    return null
  }
}

// ─── Cache ────────────────────────────────────────────────

interface DirectusCache {
  settings: DirectusPortalSettings | null
  perkGroups: DirectusPerkGroup[] | null
  perks: DirectusPerk[] | null
  shopCategories: DirectusShopCategory[] | null
  loadedAt: number
}

const CACHE_TTL_MS = 60_000 // 1 minute
let cache: DirectusCache | null = null

function isCacheValid(): boolean {
  return !!cache && (Date.now() - cache.loadedAt) < CACHE_TTL_MS
}

/** Force-refresh the Directus cache (e.g. from an admin endpoint) */
export function clearDirectusCache(): void {
  cache = null
}

async function ensureCache(): Promise<DirectusCache | null> {
  if (!isDirectusEnabled()) return null
  if (isCacheValid()) return cache

  // Fetch all collections in parallel
  const [settings, perkGroups, perks, shopCategories] = await Promise.all([
    directusFetch<DirectusPortalSettings[]>('/portal_settings', { limit: '1' }),
    directusFetch<DirectusPerkGroup[]>('/perk_groups', { sort: 'sort', limit: '-1' }),
    directusFetch<DirectusPerk[]>('/perks', { sort: 'sort', limit: '-1' }),
    directusFetch<DirectusShopCategory[]>('/shop_categories', { sort: 'sort', limit: '-1' }),
  ])

  cache = {
    settings: Array.isArray(settings) && settings.length > 0 ? settings[0]! : null,
    perkGroups: perkGroups,
    perks: perks,
    shopCategories: shopCategories,
    loadedAt: Date.now(),
  }

  return cache
}

// ─── Public API ───────────────────────────────────────────

/**
 * Fetch portal settings from Directus.
 * Returns null if Directus is disabled or unreachable.
 */
export async function getDirectusSettings(): Promise<DirectusPortalSettings | null> {
  const c = await ensureCache()
  return c?.settings ?? null
}

/**
 * Fetch perk groups from Directus.
 * Returns null if Directus is disabled or unreachable.
 */
export async function getDirectusPerkGroups(): Promise<DirectusPerkGroup[] | null> {
  const c = await ensureCache()
  return c?.perkGroups ?? null
}

/**
 * Fetch all perks from Directus.
 * Returns null if Directus is disabled or unreachable.
 */
export async function getDirectusPerks(): Promise<DirectusPerk[] | null> {
  const c = await ensureCache()
  return c?.perks ?? null
}

/**
 * Fetch shop categories from Directus.
 * Returns null if Directus is disabled or unreachable.
 */
export async function getDirectusShopCategories(): Promise<DirectusShopCategory[] | null> {
  const c = await ensureCache()
  return c?.shopCategories ?? null
}

// ─── Converters: Directus → App types ─────────────────────

/**
 * Convert a Directus perk group to the app's PerkGroupMeta type.
 */
export function toAppPerkGroupMeta(dg: DirectusPerkGroup): PerkGroupMeta {
  return {
    id: dg.id as PerkGroup,
    label: dg.label,
    icon: dg.icon,
    description: dg.description,
    envKey: `NUXT_PERK_GROUP_${dg.id.toUpperCase()}_ENABLED`,
  }
}

/**
 * Convert a Directus perk to the app's PerkDefinition type.
 */
export function toAppPerkDefinition(dp: DirectusPerk): PerkDefinition {
  return {
    id: dp.id,
    group: dp.group as PerkGroup,
    name: dp.name,
    icon: dp.icon,
    description: dp.description,
    successMessage: dp.success_message,
    deliveryType: dp.delivery_type as PerkDefinition['deliveryType'],
    gameId: dp.game_id,
    auraDurationMs: dp.aura_duration_ms ?? undefined,
    requiredLevel: dp.required_level,
    requiresOnline: dp.requires_online,
    oneTime: dp.one_time,
    defaultDiceSides: dp.dice_sides,
    defaultRollThreshold: dp.roll_threshold,
    defaultDailyLimit: dp.daily_limit,
    accent: dp.accent,
    envPrefix: dp.env_prefix,
    rankGroup: dp.rank_group ?? undefined,
    mailSubject: dp.mail_subject ?? undefined,
    mailBody: dp.mail_body ?? undefined,
    itemCount: dp.item_count ?? undefined,
    failDebuffSpellId: dp.fail_debuff_spell_id ?? undefined,
    failDebuffDurationMs: dp.fail_debuff_duration_ms ?? undefined,
    critFailDebuffSpellId: dp.critfail_debuff_spell_id ?? undefined,
    critFailDebuffDurationMs: dp.critfail_debuff_duration_ms ?? undefined,
    teleportMapId: dp.teleport_map_id ?? undefined,
    teleportX: dp.teleport_x ?? undefined,
    teleportY: dp.teleport_y ?? undefined,
    teleportZ: dp.teleport_z ?? undefined,
    teleportO: dp.teleport_o ?? undefined,
  }
}
