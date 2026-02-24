/**
 * GET /api/admin/portal-config/backend
 * Returns the current config backend mode and self-managed database status.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const { getConfigBackend, isSelfManagedEnabled, PortalSettingsDB, PerkGroupsDB, PerksDB, ShopCategoriesDB } = await import('#server/utils/portal-config-db')

  const backend = getConfigBackend()
  const selfManaged = isSelfManagedEnabled()

  let dbStatus = null
  if (selfManaged) {
    const settings = PortalSettingsDB.get()
    const groups = PerkGroupsDB.findAll()
    const perks = PerksDB.findAll()
    const categories = ShopCategoriesDB.findAll()

    dbStatus = {
      initialized: settings !== null || groups.length > 0,
      settingsConfigured: settings !== null,
      perkGroupCount: groups.length,
      perkCount: perks.length,
      shopCategoryCount: categories.length,
    }
  }

  return {
    backend,
    selfManaged,
    directusEnabled: process.env.NUXT_DIRECTUS_ENABLED === 'true',
    dbStatus,
  }
})
