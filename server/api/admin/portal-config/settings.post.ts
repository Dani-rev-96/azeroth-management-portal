/**
 * POST /api/admin/portal-config/settings
 * Create or update portal settings in the self-managed database.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  }

  const { PortalSettingsDB } = await import('#server/utils/portal-config-db')

  // Validate delivery_method if provided
  if (body.shop_delivery_method && !['mail', 'bag', 'both'].includes(body.shop_delivery_method)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid shop_delivery_method. Must be mail, bag, or both.' })
  }

  // Build update data — only include fields that are present in the body
  const allowedFields = [
    'shop_enabled', 'shop_delivery_method', 'shop_markup_percent',
    'shop_mail_subject', 'shop_mail_body',
    'eluna_enabled', 'eluna_shop_enabled', 'eluna_gm_mail_enabled',
    'perk_fail_debuff_spell_id', 'perk_fail_debuff_duration_ms',
    'perk_critfail_debuff_spell_id', 'perk_critfail_debuff_duration_ms',
  ]

  const updateData: Record<string, any> = {}
  for (const field of allowedFields) {
    if (body[field] !== undefined) {
      // Convert booleans to integers for SQLite
      if (typeof body[field] === 'boolean') {
        updateData[field] = body[field] ? 1 : 0
      } else {
        updateData[field] = body[field]
      }
    }
  }

  // Mark as user-modified
  updateData.modified_by_user = 1

  const settings = PortalSettingsDB.upsert(updateData)

  return { settings, message: 'Portal settings updated' }
})
