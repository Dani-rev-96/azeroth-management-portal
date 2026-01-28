/**
 * Production Configuration
 * Realms are loaded from NUXT_DB_REALM_* environment variables at runtime
 * This file only contains non-sensitive fallback values
 *
 * PUBLIC - Safe to share with client (no credentials here)
 */

import type { ShopConfig } from '~/types'

// Public realm info for client-side (used as fallback)
// In production, this is loaded from runtime config via /api/realms
export const realms: Record<string, { id: string; name: string; description: string }> = {
  // Realms are loaded dynamically from environment variables
  // These are just fallback values for edge cases
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

