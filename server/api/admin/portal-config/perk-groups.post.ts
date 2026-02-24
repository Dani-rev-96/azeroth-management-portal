/**
 * POST /api/admin/portal-config/perk-groups
 * Create or update a perk group in the self-managed database.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  }

  if (!body.id || typeof body.id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Perk group ID is required' })
  }
  if (!body.label || typeof body.label !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Perk group label is required' })
  }

  const { PerkGroupsDB } = await import('#server/utils/portal-config-db')

  const group = PerkGroupsDB.upsert({
    id: body.id,
    label: body.label,
    icon: body.icon || '📦',
    description: body.description || '',
    enabled: body.enabled !== undefined ? (body.enabled ? 1 : 0) : 1,
    sort: body.sort ?? 0,
    modified_by_user: 1,
  })

  return { group, message: `Perk group "${group.label}" saved` }
})
