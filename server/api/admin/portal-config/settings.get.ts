/**
 * GET /api/admin/portal-config/settings
 * Returns the portal settings from the self-managed database.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const { PortalSettingsDB } = await import('#server/utils/portal-config-db')

  const settings = PortalSettingsDB.get()
  return { settings }
})
