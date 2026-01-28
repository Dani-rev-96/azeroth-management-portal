/**
 * Environment-aware configuration loader
 * Realms are loaded from NUXT_DB_REALM_* environment variables at runtime
 * PUBLIC - Safe to share with client (only realm metadata, no credentials)
 *
 * Client-side (Components):
 *   const { realms } = await useServerConfig()
 *
 * Server-side (API routes - for database credentials):
 *   import { useServerDatabaseConfig, getRealms } from '#server/utils/config'
 */

import type { RealmConfig, RealmId, ShopConfig } from '~/types'

// Public realm info (without credentials) for client-side use
export type PublicRealmConfig = {
  id: RealmId
  name: string
  description: string
}

/**
 * Composable for client-side config loading
 * Only returns realm metadata (no sensitive data)
 * Note: In production, realms are fetched from /api/realms endpoint
 */
export const useServerConfig = async () => {
  const env = process.env.NODE_ENV || 'development'

  try {
    let config
    if (env === 'production') {
      config = await import('./production')
    } else {
      config = await import('./local')
    }

    return {
      realms: config.realms,
      shopConfig: config.shopConfig,
    }
  } catch (error) {
    console.error(`Failed to load config for environment: ${env}`, error)
    // Fallback to local
    const config = await import('./local')
    return {
      realms: config.realms,
      shopConfig: config.shopConfig,
    }
  }
}

// Export type helpers
export type { RealmConfig, RealmId, ShopConfig }

// Direct conditional exports for server-side imports
export * from './local'
