/**
 * GET /api/admin/portal-config/shop-categories
 * Returns all shop categories from the self-managed database.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const { ShopCategoriesDB } = await import('#server/utils/portal-config-db')

  const categories = ShopCategoriesDB.findAll()
  return { categories }
})
