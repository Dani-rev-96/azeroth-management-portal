/**
 * Local Development Configuration
 * Use localhost or Docker container names for databases
 */

import type { RealmConfig, RealmId } from '~/types'

export const realms: Record<RealmId, RealmConfig> = {
  wotlk: {
    id: 'wotlk',
    realmId: 1,
    name: 'Azeroth WoTLK',
    description: 'Classical WOTLK with PlayerBots',
    version: 'WOTLK',
    worldPort: 8085,
    soapPort: 7878,
    database: 'acore_world',
    databaseHost: 'localhost',
    databaseKey: 'blizzlike-db', // References the database config below
  },
  'wotlk-ip': {
    id: 'wotlk-ip',
    realmId: 2,
    name: 'Azeroth IP',
    description: 'Individual Progression Mode',
    version: 'WOTLK',
    worldPort: 8086,
    soapPort: 7879,
    database: 'acore_world',
    databaseHost: 'localhost',
    databaseKey: 'ip-db',
  },
  'wotlk-ip-boosted': {
    id: 'wotlk-ip-boosted',
    realmId: 3,
    name: 'Azeroth IP Boosted',
    description: 'Individual Progression Mode with increased XP and drop rates',
    version: 'WOTLK',
    worldPort: 8087,
    soapPort: 7880,
    database: 'acore_world',
    databaseHost: 'localhost',
    databaseKey: 'ip-boosted-db',
  },
}

export const authServerConfig = {
  host: 'localhost',
  port: 3724,
}

/**
 * Database configurations for local development
 * Credentials are loaded from .db.local.json via runtimeConfig
 * Host/port can be overridden per environment
 * This config is shared with the app/browser, so no sensitive data
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

export const getServerConfig = () => {
  return {
    realms,
    authServer: authServerConfig,
    databaseConfigs: getDatabaseConfigs(),
  }
}
