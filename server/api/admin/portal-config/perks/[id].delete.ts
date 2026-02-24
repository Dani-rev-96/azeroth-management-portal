/**
 * DELETE /api/admin/portal-config/perks/[id]
 * Delete a perk from the self-managed database.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Perk ID is required' })
  }

  const { PerksDB } = await import('#server/utils/portal-config-db')

  const deleted = PerksDB.delete(id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: `Perk "${id}" not found` })
  }

  return { message: `Perk "${id}" deleted` }
})
