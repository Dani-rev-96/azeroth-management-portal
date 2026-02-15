/**
 * Server-side Database Configuration
 * Reads realm configuration directly from environment variables at RUNTIME
 * This is critical for Kubernetes deployments where env vars are injected at runtime
 *
 * SERVER-SIDE ONLY - Contains sensitive credentials
 *
 * Usage in API routes:
 *   import { getRealms, getRealmConfig, getAuthDbConfig } from '#server/utils/config'
 */

import type { RealmConfig } from '~/types'

export interface RealmSoapConfig {
  enabled: boolean
  host: string
  port: number
  username: string
  password: string
}

interface RealmConfigWithSoap extends RealmConfig {
  soap?: RealmSoapConfig
}

// Cache for loaded realms (avoid re-parsing env vars on every call)
let cachedRealms: Record<string, RealmConfigWithSoap> | null = null
let startupLogged = false

/**
 * Get auth database configuration directly from environment variables
 */
export const getAuthDbConfig = () => {
  return {
    host: process.env.NUXT_DB_AUTH_HOST || 'localhost',
    port: parseInt(process.env.NUXT_DB_AUTH_PORT || '3306', 10),
    user: process.env.NUXT_DB_AUTH_USER || 'acore',
    password: process.env.NUXT_DB_AUTH_PASSWORD || 'acore',
    database: 'acore_auth',
  }
}

/**
 * Get all configured realms directly from environment variables
 * Reads NUXT_DB_REALM_0_*, NUXT_DB_REALM_1_*, etc. up to 10 realms
 * Also reads per-realm SOAP config: NUXT_DB_REALM_0_SOAP_HOST, etc.
 */
export const getRealms = (): Record<string, RealmConfigWithSoap> => {
  // Return cached realms if already loaded
  if (cachedRealms) {
    return cachedRealms
  }

  const realms: Record<string, RealmConfigWithSoap> = {}

  for (let i = 0; i < 10; i++) {
    const prefix = `NUXT_DB_REALM_${i}_`
    const id = process.env[`${prefix}ID`]
    const name = process.env[`${prefix}NAME`]

    // Skip if realm is not defined
    if (!id || !name) continue

    // Parse per-realm SOAP configuration
    const soapEnabled = process.env[`${prefix}SOAP_ENABLED`] === 'true'
    const soapHost = process.env[`${prefix}SOAP_HOST`]
    const soapUsername = process.env[`${prefix}SOAP_USERNAME`]
    const soapPassword = process.env[`${prefix}SOAP_PASSWORD`]

    const soapConfig: RealmSoapConfig | undefined = soapEnabled ? {
      enabled: true,
      host: soapHost || '127.0.0.1',
      port: parseInt(process.env[`${prefix}SOAP_PORT`] || '7878', 10),
      username: soapUsername || '',
      password: soapPassword || '',
    } : undefined

    realms[id] = {
      id,
      name,
      description: process.env[`${prefix}DESCRIPTION`] || '',
      dbHost: process.env[`${prefix}HOST`] || 'localhost',
      dbPort: parseInt(process.env[`${prefix}PORT`] || '3306', 10),
      dbUser: process.env[`${prefix}USER`] || 'acore',
      dbPassword: process.env[`${prefix}PASSWORD`] || 'acore',
      soap: soapConfig,
    }
  }

  // Log on first load
  if (!startupLogged) {
    startupLogged = true
    const realmCount = Object.keys(realms).length
    console.log(`[Config] Loaded ${realmCount} realm(s) from environment variables`)
    Object.values(realms).forEach((realm, i) => {
      console.log(`  [${i}] ${realm.id}: "${realm.name}" @ ${realm.dbHost}:${realm.dbPort}`)
    })
    if (realmCount === 0) {
      console.warn('[Config] WARNING: No realms configured! Check NUXT_DB_REALM_* environment variables.')
    }
  }

  cachedRealms = realms
  return realms
}

/**
 * Get a specific realm configuration
 */
export const getRealmConfig = (realmId: string): RealmConfigWithSoap | undefined => {
  const realms = getRealms()
  return realms[realmId]
}

/**
 * Get SOAP configuration for a specific realm
 * @param realmId The realm ID
 * @returns SOAP config or undefined if not configured
 */
export const getRealmSoapConfig = (realmId: string): RealmSoapConfig | undefined => {
  const realm = getRealmConfig(realmId)
  return realm?.soap
}

/**
 * Clear the realm cache (useful for testing)
 */
export const clearRealmCache = () => {
  cachedRealms = null
  startupLogged = false
}

/**
 * Get database configurations (server-side only)
 * Returns realms and auth db config
 */
export const useServerDatabaseConfig = async () => {
  return {
    realms: getRealms(),
    authDb: getAuthDbConfig(),
    getRealmConfig,
  }
}

/**
 * Get shop configuration from environment or defaults
 * Uses NUXT_PUBLIC_* variables which are set in nuxt.config.ts and overridable via env
 */
export const getShopConfig = () => {
  const deliveryMethod = (process.env.NUXT_PUBLIC_SHOP_DELIVERY_METHOD || 'mail') as 'mail' | 'bag' | 'both'
  const markupPercent = parseInt(process.env.NUXT_PUBLIC_SHOP_MARKUP_PERCENT || '20', 10)

  return {
    enabled: process.env.NUXT_SHOP_ENABLED !== 'false',
    priceMarkupPercent: markupPercent,
    deliveryMethod,
    mailSubject: process.env.NUXT_SHOP_MAIL_SUBJECT || 'Your Shop Purchase',
    mailBody: process.env.NUXT_SHOP_MAIL_BODY || 'Thank you for your purchase! Your items are attached.',
    categories: ['trade_goods', 'mounts', 'miscellaneous'] as const,
  }
}

/**
 * Validate SOAP config for a specific realm
 * @param realmId The realm ID
 * @returns Validation result with any errors
 */
export const validateRealmSoapConfig = (realmId: string): { valid: boolean; error?: string } => {
  const shopConfig = getShopConfig()

  // SOAP is only required for 'bag' or 'both' delivery methods
  if (shopConfig.deliveryMethod === 'mail') {
    return { valid: true }
  }

  const soapConfig = getRealmSoapConfig(realmId)

  if (!soapConfig?.enabled) {
    return {
      valid: false,
      error: `Shop delivery method '${shopConfig.deliveryMethod}' requires SOAP to be enabled for realm '${realmId}'`,
    }
  }

  if (!soapConfig.username || !soapConfig.password) {
    return {
      valid: false,
      error: `SOAP credentials are required for realm '${realmId}'`,
    }
  }

  return { valid: true }
}

/**
 * Check if any realm has SOAP enabled
 * Used to determine if bag delivery should be available at all
 */
export const hasAnySoapEnabled = (): boolean => {
  const realms = getRealms()
  return Object.values(realms).some(r => r.soap?.enabled)
}

/**
 * Get Eluna features configuration
 * Controls whether features that require Eluna scripts are enabled
 *
 * IMPORTANT: These features require the Eluna Lua engine to be installed on the
 * game server, along with the unified worker script:
 * - web_worker.lua - Processes money, mail items, and bag items
 *
 * When disabled, the shop and GM mail features will return 503 errors.
 */
export const getElunaConfig = () => {
  return {
    // Master switch for all Eluna-dependent features
    enabled: process.env.NUXT_ELUNA_ENABLED !== 'false',
    // Individual feature toggles (only apply if enabled=true)
    shopEnabled: process.env.NUXT_ELUNA_SHOP_ENABLED !== 'false',
    gmMailEnabled: process.env.NUXT_ELUNA_GM_MAIL_ENABLED !== 'false',
  }
}

/**
 * Check if Eluna shop features are available
 * Shop requires both Eluna and shop to be enabled
 */
export const isElunaShopEnabled = (): boolean => {
  const config = getElunaConfig()
  return config.enabled && config.shopEnabled
}

/**
 * Check if Eluna GM mail features are available
 * GM mail requires both Eluna and gmMail to be enabled
 */
export const isElunaGmMailEnabled = (): boolean => {
  const config = getElunaConfig()
  return config.enabled && config.gmMailEnabled
}

/**
 * Perk system configuration
 *
 * Controls the dice roll / gacha mechanics for character perks.
 * All perks are defined in the shared registry (shared/utils/perks.ts).
 * This config layer reads environment variable overrides per-perk and per-group.
 *
 * ── Group enable/disable ──
 *   NUXT_PERK_GROUP_MOUNT_ENABLED    (default: true)
 *   NUXT_PERK_GROUP_QUEST_ENABLED    (default: true)
 *   NUXT_PERK_GROUP_BUFFS_ENABLED    (default: true)
 *   NUXT_PERK_GROUP_SCROLLS_ENABLED  (default: true)
 *
 * ── Per-perk overrides (use the perk's envPrefix, e.g. FLYING) ──
 *   NUXT_PERK_<PREFIX>_DICE_SIDES         — Override dice size
 *   NUXT_PERK_<PREFIX>_ROLL_THRESHOLD     — Override threshold
 *   NUXT_PERK_<PREFIX>_DAILY_LIMIT        — Override daily activations (0 = unlimited)
 *   NUXT_PERK_<PREFIX>_REQUIRED_LEVEL     — Override level requirement
 *
 * ── Debuff configuration (shared by all perks) ──
 *   NUXT_PERK_FAIL_DEBUFF_SPELL_ID        (default: 11196 = Recently Bandaged)
 *   NUXT_PERK_FAIL_DEBUFF_DURATION_MS     (default: 600000 = 10 min)
 *   NUXT_PERK_CRITFAIL_DEBUFF_SPELL_ID    (default: 15007 = Resurrection Sickness)
 *   NUXT_PERK_CRITFAIL_DEBUFF_DURATION_MS (default: 600000 = 10 min)
 */
import { PERK_REGISTRY, PERK_GROUPS, type PerkGroup, type PerkDefinition } from '~~/shared/utils/perks'

export interface PerkGroupConfig {
  enabled: boolean
}

export interface ResolvedPerkConfig {
  diceSides: number
  rollThreshold: number
  dailyLimit: number
  requiredLevel: number
}

export interface PerkSystemConfig {
  /** Per-group enable/disable */
  groups: Record<PerkGroup, PerkGroupConfig>
  /** Per-perk resolved config (after env overrides) */
  perks: Record<string, ResolvedPerkConfig>
  /** Shared debuff settings */
  failDebuffSpellId: number
  failDebuffDurationMs: number
  critFailDebuffSpellId: number
  critFailDebuffDurationMs: number
}

/** Check if a perk group is enabled via environment */
function isGroupEnabled(group: PerkGroup): boolean {
  const meta = PERK_GROUPS.find(g => g.id === group)
  if (!meta) return false
  const envVal = process.env[meta.envKey]
  // Default to enabled (true) — set to 'false' to disable
  return envVal !== 'false'
}

/** Resolve a single perk's config, applying env overrides over defaults */
function resolvePerkConfig(perk: PerkDefinition): ResolvedPerkConfig {
  const prefix = `NUXT_PERK_${perk.envPrefix}_`
  return {
    diceSides: parseInt(process.env[`${prefix}DICE_SIDES`] || String(perk.defaultDiceSides), 10),
    rollThreshold: parseInt(process.env[`${prefix}ROLL_THRESHOLD`] || String(perk.defaultRollThreshold), 10),
    dailyLimit: parseInt(process.env[`${prefix}DAILY_LIMIT`] || String(perk.defaultDailyLimit), 10),
    requiredLevel: parseInt(process.env[`${prefix}REQUIRED_LEVEL`] || String(perk.requiredLevel), 10),
  }
}

/** Get the full perk system config (groups, per-perk overrides, debuffs) */
export const getPerkConfig = (): PerkSystemConfig => {
  const groups = {} as Record<PerkGroup, PerkGroupConfig>
  for (const g of PERK_GROUPS) {
    groups[g.id] = { enabled: isGroupEnabled(g.id) }
  }

  const perks = {} as Record<string, ResolvedPerkConfig>
  for (const perk of PERK_REGISTRY) {
    perks[perk.id] = resolvePerkConfig(perk)
  }

  return {
    groups,
    perks,
    failDebuffSpellId: parseInt(process.env.NUXT_PERK_FAIL_DEBUFF_SPELL_ID || '11196', 10),
    failDebuffDurationMs: parseInt(process.env.NUXT_PERK_FAIL_DEBUFF_DURATION_MS || '600000', 10),
    critFailDebuffSpellId: parseInt(process.env.NUXT_PERK_CRITFAIL_DEBUFF_SPELL_ID || '15007', 10),
    critFailDebuffDurationMs: parseInt(process.env.NUXT_PERK_CRITFAIL_DEBUFF_DURATION_MS || '600000', 10),
  }
}

