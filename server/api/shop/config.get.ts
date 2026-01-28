/**
 * GET /api/shop/config
 * Get shop configuration (public, no auth required)
 */

import { getShopConfig } from '#server/utils/config'

export default defineEventHandler(async () => {
  const shopConfig = await getShopConfig()

  return {
    enabled: shopConfig.enabled,
    priceMarkupPercent: shopConfig.priceMarkupPercent,
    deliveryMethod: shopConfig.deliveryMethod,
    categories: shopConfig.categories,
  }
})
