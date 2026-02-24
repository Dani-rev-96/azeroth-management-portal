/**
 * DELETE /api/admin/portal-config/shop-categories/[slug]
 * Delete a shop category from the self-managed database.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const slug = getRouterParam(event, 'slug')
  if (!slug) {
    throw createError({ statusCode: 400, statusMessage: 'Category slug is required' })
  }

  const { ShopCategoriesDB } = await import('#server/utils/portal-config-db')

  const deleted = ShopCategoriesDB.delete(slug)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: `Shop category "${slug}" not found` })
  }

  return { message: `Shop category "${slug}" deleted` }
})
