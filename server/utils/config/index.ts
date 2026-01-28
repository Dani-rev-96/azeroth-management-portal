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

// Cache for loaded realms (avoid re-parsing env vars on every call)
let cachedRealms: Record<string, RealmConfig> | null = null
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
 */
export const getRealms = (): Record<string, RealmConfig> => {
  // Return cached realms if already loaded
  if (cachedRealms) {
    return cachedRealms
  }

  const realms: Record<string, RealmConfig> = {}

  for (let i = 0; i < 10; i++) {
    const prefix = `NUXT_DB_REALM_${i}_`
    const id = process.env[`${prefix}ID`]
    const name = process.env[`${prefix}NAME`]

    // Skip if realm is not defined
    if (!id || !name) continue

    realms[id] = {
      id,
      name,
      description: process.env[`${prefix}DESCRIPTION`] || '',
      dbHost: process.env[`${prefix}HOST`] || 'localhost',
      dbPort: parseInt(process.env[`${prefix}PORT`] || '3306', 10),
      dbUser: process.env[`${prefix}USER`] || 'acore',
      dbPassword: process.env[`${prefix}PASSWORD`] || 'acore',
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
export const getRealmConfig = (realmId: string): RealmConfig | undefined => {
  const realms = getRealms()
  return realms[realmId]
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
 */
export const getShopConfig = () => {
  return {
    enabled: process.env.NUXT_SHOP_ENABLED !== 'false',
    priceMarkupPercent: parseInt(process.env.NUXT_SHOP_MARKUP_PERCENT || '20', 10),
    deliveryMethod: (process.env.NUXT_SHOP_DELIVERY_METHOD as 'mail' | 'bag') || 'mail',
    mailSubject: process.env.NUXT_SHOP_MAIL_SUBJECT || 'Your Shop Purchase',
    mailBody: process.env.NUXT_SHOP_MAIL_BODY || 'Thank you for your purchase! Your items are attached.',
    categories: ['trade_goods', 'mounts', 'miscellaneous'],
  }
}
