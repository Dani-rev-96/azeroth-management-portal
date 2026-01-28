/**
 * Server-side Database Configuration
 * Automatically loads the correct database config based on NODE_ENV
 *
 * SERVER-SIDE ONLY - Contains sensitive credentials
 *
 * Usage in API routes:
 *   const { databaseConfigs } = await useServerDatabaseConfig()
 */

/**
 * Database configurations
 * Credentials are loaded from .db.[env].json via runtimeConfig
 */
export const getDatabaseConfigs = () => {
  const config = useRuntimeConfig()

  return {
    'auth-db': {
      host: config.db.authHost,
      port: config.db.authPort,
      user: config.db.authUser,
      password: config.db.authPassword,
      databases: ['acore_auth'],
    },
    'blizzlike-db': {
      host: config.db.blizzlikeWorldHost,
      port: config.db.blizzlikeWorldPort,
      user: config.db.blizzlikeWorldUser,
      password: config.db.blizzlikeWorldPassword,
      databases: ['acore_world', 'acore_characters'],
    },
    'ip-db': {
      host: config.db.ipWorldHost,
      port: config.db.ipWorldPort,
      user: config.db.ipWorldUser,
      password: config.db.ipWorldPassword,
      databases: ['acore_world', 'acore_characters'],
    },
    'ip-boosted-db': {
      host: config.db.ipBoostedWorldHost,
      port: config.db.ipBoostedWorldPort,
      user: config.db.ipBoostedWorldUser,
      password: config.db.ipBoostedWorldPassword,
      databases: ['acore_world', 'acore_characters'],
    },
  }
}

/**
 * Get database configurations (server-side only)
 */
export const useServerDatabaseConfig = async () => {
  return {
    databaseConfigs: getDatabaseConfigs(),
  }
}
