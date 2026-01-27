/**
 * Local Development Database Configuration
 * SERVER-SIDE ONLY - Contains sensitive credentials
 */

/**
 * Database configurations for local development
 * Credentials are loaded from .db.local.json via runtimeConfig
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
