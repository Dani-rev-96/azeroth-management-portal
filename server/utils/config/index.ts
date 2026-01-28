/**
 * Server-side Database Configuration
 * Automatically loads realms from NUXT_DB_REALM_* environment variables
 *
 * SERVER-SIDE ONLY - Contains sensitive credentials
 *
 * Usage in API routes:
 *   const { realms, getRealmConfig } = await useServerDatabaseConfig()
 */

import type { RealmConfig } from '~/types'

/**
 * Get auth database configuration
 */
export const getAuthDbConfig = () => {
  const config = useRuntimeConfig()

  return {
    host: config.db.authHost as string,
    port: config.db.authPort as number,
    user: config.db.authUser as string,
    password: config.db.authPassword as string,
    database: 'acore_auth',
  }
}

/**
 * Get all configured realms from runtime config
 * Reads NUXT_DB_REALM_0_*, NUXT_DB_REALM_1_*, etc.
 */
export const getRealms = (): Record<string, RealmConfig> => {
  const config = useRuntimeConfig()
  const realms: Record<string, RealmConfig> = {}

  for (let i = 0; i < 10; i++) {
    const id = config.db[`realm${i}Id` as keyof typeof config.db] as string
    const name = config.db[`realm${i}Name` as keyof typeof config.db] as string

    // Skip if realm is not defined
    if (!id || !name) continue

    realms[id] = {
      id,
      name,
      description: config.db[`realm${i}Description` as keyof typeof config.db] as string || '',
      dbHost: config.db[`realm${i}Host` as keyof typeof config.db] as string || 'localhost',
      dbPort: config.db[`realm${i}Port` as keyof typeof config.db] as number || 3306,
      dbUser: config.db[`realm${i}User` as keyof typeof config.db] as string || 'acore',
      dbPassword: config.db[`realm${i}Password` as keyof typeof config.db] as string || 'acore',
    }
  }

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
 * Get shop configuration
 * Loads from shared config based on environment
 */
export const getShopConfig = async () => {
  const env = process.env.NODE_ENV || 'development'

  try {
    let config
    if (env === 'production') {
      config = await import('../../../shared/utils/config/production')
    } else {
      config = await import('../../../shared/utils/config/local')
    }
    return config.shopConfig
  } catch (error) {
    console.error(`Failed to load shop config for environment: ${env}`, error)
    // Fallback to local
    const config = await import('../../../shared/utils/config/local')
    return config.shopConfig
  }
}
