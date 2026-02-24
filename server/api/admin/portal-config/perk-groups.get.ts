/**
 * GET /api/admin/portal-config/perk-groups
 * Returns all perk groups from the self-managed database.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const { PerkGroupsDB } = await import('#server/utils/portal-config-db')

  const groups = PerkGroupsDB.findAll()
  return { groups }
})
