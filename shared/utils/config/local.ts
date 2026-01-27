/**
 * Local Development Configuration
 * Use localhost or Docker container names for databases
 * PUBLIC - Safe to share with client
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

