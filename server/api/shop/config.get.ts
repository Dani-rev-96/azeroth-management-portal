/**
 * GET /api/shop/config
 * Get shop configuration (public, no auth required)
 *
 * For per-realm SOAP availability, the purchase endpoint validates at purchase time.
 * The shop config returns the configured delivery method and the frontend shows
 * the appropriate UI. If a specific realm doesn't have SOAP configured, the purchase
 * will fall back to mail delivery.
 */

import { getShopConfig, hasAnySoapEnabled } from '#server/utils/config'

export default defineEventHandler(async () => {
  const shopConfig = getShopConfig()

  // If delivery method requires SOAP but no realm has it enabled,
  // fall back to mail-only in the exposed config
  let effectiveDeliveryMethod = shopConfig.deliveryMethod
  if (shopConfig.deliveryMethod !== 'mail' && !hasAnySoapEnabled()) {
    effectiveDeliveryMethod = 'mail'
    console.warn('[Shop] No realms have SOAP enabled, falling back to mail-only delivery')
  }

  return {
    enabled: shopConfig.enabled,
    priceMarkupPercent: shopConfig.priceMarkupPercent,
    deliveryMethod: effectiveDeliveryMethod,
    categories: shopConfig.categories,
  }
})
