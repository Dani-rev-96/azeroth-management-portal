/**
 * POST /api/admin/portal-config/shop-categories
 * Create or update a shop category in the self-managed database.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  }

  if (!body.slug || typeof body.slug !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Category slug is required' })
  }

  const { ShopCategoriesDB } = await import('#server/utils/portal-config-db')

  const category = ShopCategoriesDB.upsert({
    slug: body.slug,
    sort: body.sort ?? 0,
    modified_by_user: 1,
  })

  return { category, message: `Shop category "${category.slug}" saved` }
})
