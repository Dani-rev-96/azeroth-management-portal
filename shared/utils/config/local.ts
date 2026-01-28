/**
 * Local Development Configuration
 * These are fallback values used when environment variables are not set
 * In production, realms should be configured via NUXT_DB_REALM_* environment variables
 *
 * PUBLIC - Safe to share with client (no credentials here)
 */

import type { ShopConfig } from '~/types'

// Public realm info for client-side (used as fallback)
// In production, this is loaded from runtime config via /api/realms
export const realms: Record<string, { id: string; name: string; description: string }> = {
  wotlk: {
    id: 'wotlk',
    name: 'Azeroth WoTLK',
    description: 'Classical WOTLK with PlayerBots',
  },
  'wotlk-ip': {
    id: 'wotlk-ip',
    name: 'Azeroth IP',
    description: 'Individual Progression Mode',
  },
  'wotlk-ip-boosted': {
    id: 'wotlk-ip-boosted',
    name: 'Azeroth IP Boosted',
    description: 'Individual Progression Mode with increased XP and drop rates',
  },
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

