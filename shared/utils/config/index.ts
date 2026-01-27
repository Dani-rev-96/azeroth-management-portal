/**
 * Environment-aware configuration loader
 * Automatically loads the correct config based on NODE_ENV
 *
 * Server-side (API routes - SSR):
 *   import { realms, databaseConfigs } from '~/shared/utils/config'
 *
 * Client-side (Components):
 *   const { realms, databaseConfigs } = await useServerConfig()
 */

import type { RealmConfig, RealmId } from '~/types'

/**
 * Composable for client-side config loading
 * Uses async/await with ES module dynamic imports (works in browser)
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
      databaseConfigs: config.getDatabaseConfigs(),
      getServerConfig: config.getServerConfig,
    }
  } catch (error) {
    console.error(`Failed to load config for environment: ${env}`, error)
    // Fallback to local
    const config = await import('./local')
    return {
      realms: config.realms,
      authServerConfig: config.authServerConfig,
      databaseConfigs: config.getDatabaseConfigs(),
      getServerConfig: config.getServerConfig,
    }
  }
}

// Export type helpers
export type { RealmConfig, RealmId }

// Direct conditional exports for server-side imports (API routes)
// The bundler will tree-shake unused imports based on NODE_ENV at build time
export * from './local'
