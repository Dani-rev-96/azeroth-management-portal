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
  },
}

export const authServerConfig = {
  host: 'localhost',
  port: 3724,
}

/**
 * Database mappings for local development
 * Each realm can point to different database servers
 * Credentials and host/port are loaded from .db.local.json via runtimeConfig
 * This config is shared with the app/browser, so no sensitive data
 */
export const getDatabaseConfigs = () => {
  const config = useRuntimeConfig()
  
  return {
    'auth-db': {
      host: config.db.authHost,
      port: config.db.authPort,
      databases: ['acore_auth'],
    },
    'blizzlike-db': {
      host: config.db.blizzlikeWorldHost,
      port: config.db.blizzlikeWorldPort,
      databases: ['acore_world', 'acore_characters'],
    },
    'ip-db': {
      host: config.db.ipWorldHost,
      port: config.db.ipWorldPort,
      databases: ['acore_world', 'acore_characters'],
    },
    'ip-boosted-db': {
      host: config.db.ipBoostedWorldHost,
      port: config.db.ipBoostedWorldPort,
      databases: ['acore_world', 'acore_characters'],
    },
  }
}

// Export static config for backward compatibility
// Note: This won't have the actual runtime values until server-side
export const databaseConfigs = {
  'auth-db': {
    host: 'localhost',
    port: 3306,
    databases: ['acore_auth'],
  },
  'blizzlike-db': {
    host: 'localhost',
    port: 3306,
    databases: ['acore_world', 'acore_characters'],
  },
  'ip-db': {
    host: 'localhost',
    port: 3307,
    databases: ['acore_world', 'acore_characters'],
  },
  'ip-boosted-db': {
    host: 'localhost',
    port: 3308,
    databases: ['acore_world', 'acore_characters'],
  },
}

/**
 * Realm to database mapping
 * Each realm specifies which database server hosts its data
 */
export const realmDatabaseMap: Record<RealmId, { id: number; auth: string; world: string }> = {
  wotlk: {
    id: 1,
    auth: 'auth-db',
    world: 'wotlk-db',
  },
  'wotlk-ip': {
    id: 2,
    auth: 'auth-db',
    world: 'wotlk-ip-db',
  },
  'wotlk-ip-boosted': {
    id: 3,
    auth: 'auth-db',
    world: 'wotlk-ip-boosted-db',
  },
}

export const getServerConfig = () => {
  return {
    realms,
    authServer: authServerConfig,
    databaseConfigs: getDatabaseConfigs(),
    realmDatabaseMap,
  }
}
