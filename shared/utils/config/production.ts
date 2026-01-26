/**
 * Production Configuration
 * Points to production Kubernetes cluster with oauth-proxy
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
    databaseHost: 'wow-acore-blizzlike-db',
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
    databaseHost: 'wow-acore-ip-db',
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
    databaseHost: 'wow-acore-ip-boosted-db',
  },
}

export const authServerConfig = {
  host: 'wow-wotlk-auth',
  port: 3724,
}

/**
 * Production cluster database configuration
 * Separate auth database from world databases for better scalability
 * Credentials and host/port are loaded from .db.production.json via runtimeConfig
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
    host: 'wow-acore-auth-db',
    port: 3306,
    databases: ['acore_auth'],
  },
  'blizzlike-db': {
    host: 'wow-acore-blizzlike-db',
    port: 3306,
    databases: ['acore_world', 'acore_characters'],
  },
  'ip-db': {
    host: 'wow-acore-ip-db',
    port: 3306,
    databases: ['acore_world', 'acore_characters'],
  },
  'ip-boosted-db': {
    host: 'wow-acore-ip-boosted-db',
    port: 3306,
    databases: ['acore_world', 'acore_characters'],
  },
}

/**
 * Realm to database mapping
 * Each realm can use different auth and world databases
 * This allows scaling: shared auth DB with per-realm world DBs
 */
export const realmDatabaseMap: Record<RealmId, { id: number; auth: string; world: string }> = {
  wotlk: {
    id: 1,
    auth: 'auth-db',
    world: 'blizzlike-db',
  },
  'wotlk-ip': {
    id: 2,
    auth: 'auth-db',
    world: 'ip-db',
  },
  'wotlk-ip-boosted': {
    id: 3,
    auth: 'auth-db',
    world: 'ip-boosted-db',
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
