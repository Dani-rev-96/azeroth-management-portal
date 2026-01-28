/**
 * Environment-aware configuration loader
 * Automatically loads the correct config based on NODE_ENV
 * PUBLIC - Safe to share with client (only realm metadata, no credentials)
 *
 * Client-side (Components):
 *   const { realms } = await useServerConfig()
 *
 * Server-side (API routes - for database credentials):
 *   import { useServerDatabaseConfig } from '#server/utils/config'
 */

import type { RealmConfig, RealmId, ShopConfig } from '~/types'

/**
 * Composable for client-side config loading
 * Only returns realm metadata (no sensitive data)
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
      authServerConfig: config.authServerConfig,
      shopConfig: config.shopConfig,
    }
  } catch (error) {
    console.error(`Failed to load config for environment: ${env}`, error)
    // Fallback to local
    const config = await import('./local')
    return {
      realms: config.realms,
      authServerConfig: config.authServerConfig,
      shopConfig: config.shopConfig,
    }
  }
}

// Export type helpers
export type { RealmConfig, RealmId, ShopConfig }

// Direct conditional exports for server-side imports
export * from './local'
