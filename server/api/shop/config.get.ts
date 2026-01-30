/**
 * GET /api/shop/config
 * Get shop configuration (public, no auth required)
 *
 * All delivery methods (mail and bag) use Eluna scripts for proper item GUID allocation.
 * Bag delivery is queued and processed when the player is online.
 */

import { getShopConfig, isElunaShopEnabled } from '#server/utils/config'

export default defineEventHandler(async () => {
  const shopConfig = getShopConfig()
  const elunaEnabled = isElunaShopEnabled()

  // Shop is disabled if Eluna features are not enabled
  const effectiveEnabled = shopConfig.enabled && elunaEnabled

  if (!elunaEnabled && shopConfig.enabled) {
    console.warn('[Shop] Shop is enabled but Eluna features are disabled. Shop will be unavailable.')
  }

  return {
    enabled: effectiveEnabled,
    priceMarkupPercent: shopConfig.priceMarkupPercent,
    deliveryMethod: shopConfig.deliveryMethod,
    categories: shopConfig.categories,
    elunaRequired: true,
    elunaEnabled: elunaEnabled,
  }
})
