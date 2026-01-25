/**
 * Realm configurations for multi-realm AzerothCore setup
 * Maps to different WoW servers and their respective databases
 */

import type { RealmConfig, RealmId } from '~/types'

export const realms: Record<RealmId, RealmConfig> = {
  wotlk: {
    id: 'wotlk',
    name: 'Azeroth WoTLK',
    description: 'Classical WOTLK with PlayerBots',
    version: 'WOTLK',
    worldPort: 8085,
    soapPort: 7878,
    database: 'acore_world',
    databaseHost: 'wow-acore-db',
  },
  'wotlk-ip': {
    id: 'wotlk-ip',
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

export const databaseConfigs = {
  'wow-acore-auth-db': {
    host: 'wow-acore-auth-db',
    port: 3306,
    databases: ['acore_world', 'acore_characters'],
  },
  'wow-acore-blizzlike-db': {
    host: 'wow-acore-blizzlike-db',
    port: 3306,
    databases: ['acore_world', 'acore_characters'],
  },
  'wow-acore-ip-db': {
    host: 'wow-acore-ip-db',
    port: 3306,
    databases: ['acore_world', 'acore_characters'],
  },
  'wow-acore-ip-boosted-db': {
    host: 'wow-acore-ip-boosted-db',
    port: 3306,
    databases: ['acore_world', 'acore_characters'],
  },
}

// Runtime configuration - populated from environment
export const getServerConfig = () => {
  return {
    realms,
    authServer: authServerConfig,
    databases: databaseConfigs,
    // Keycloak and Directus config should be passed via Nuxt config
    // or environment variables
  }
}
