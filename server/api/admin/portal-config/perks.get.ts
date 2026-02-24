/**
 * GET /api/admin/portal-config/perks
 * Returns all perks from the self-managed database.
 * Optionally filter by group via ?group=... query param.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const { PerksDB } = await import('#server/utils/portal-config-db')

  const query = getQuery(event)
  const groupFilter = query.group as string | undefined

  const perks = groupFilter ? PerksDB.findByGroup(groupFilter) : PerksDB.findAll()
  return { perks }
})
