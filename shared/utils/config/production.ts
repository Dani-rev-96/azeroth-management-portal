/**
 * Production Configuration
 * Points to production Kubernetes cluster with oauth-proxy
 * PUBLIC - Safe to share with client
 */

import type { RealmConfig, RealmId, ShopConfig } from '~/types'

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
    databaseHost: 'wow-acore-ip-db',
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
    databaseHost: 'wow-acore-ip-boosted-db',
    databaseKey: 'ip-boosted-db',
  },
}

export const authServerConfig = {
  host: 'wow-wotlk-auth',
  port: 3724,
}

// Shop configuration
export const shopConfig: ShopConfig = {
  enabled: true,
  priceMarkupPercent: 20, // 20% markup on vendor prices
  deliveryMethod: 'mail', // 'mail' is safe, 'inventory' requires more work
  mailSubject: 'Shop Purchase',
  mailBody: 'Thank you for your purchase from the Azeroth Shop!',
  categories: ['trade_goods', 'mounts', 'miscellaneous'],
}

