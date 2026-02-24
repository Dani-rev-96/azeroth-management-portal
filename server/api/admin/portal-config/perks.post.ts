/**
 * POST /api/admin/portal-config/perks
 * Create or update a perk in the self-managed database.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const body = await readBody(event)
  if (!body || typeof body !== 'object') {
    throw createError({ statusCode: 400, statusMessage: 'Request body is required' })
  }

  // Validate required fields
  if (!body.id || typeof body.id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Perk ID is required' })
  }
  if (!body.group_id || typeof body.group_id !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Perk group_id is required' })
  }
  if (!body.name || typeof body.name !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Perk name is required' })
  }
  if (!body.delivery_type || typeof body.delivery_type !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'Perk delivery_type is required' })
  }

  const validDeliveryTypes = ['spell', 'item', 'bag-item', 'aura', 'teleport']
  if (!validDeliveryTypes.includes(body.delivery_type)) {
    throw createError({ statusCode: 400, statusMessage: `Invalid delivery_type. Must be one of: ${validDeliveryTypes.join(', ')}` })
  }

  // Verify group exists
  const { PerkGroupsDB, PerksDB } = await import('#server/utils/portal-config-db')
  const group = PerkGroupsDB.findById(body.group_id)
  if (!group) {
    throw createError({ statusCode: 400, statusMessage: `Perk group "${body.group_id}" does not exist` })
  }

  const perk = PerksDB.upsert({
    id: body.id,
    group_id: body.group_id,
    name: body.name,
    icon: body.icon || '📦',
    description: body.description || '',
    success_message: body.success_message || '',
    delivery_type: body.delivery_type,
    game_id: body.game_id ?? 0,
    aura_duration_ms: body.aura_duration_ms ?? null,
    required_level: body.required_level ?? 0,
    requires_online: body.requires_online ? 1 : 0,
    one_time: body.one_time ? 1 : 0,
    dice_sides: body.dice_sides ?? 20,
    roll_threshold: body.roll_threshold ?? 8,
    daily_limit: body.daily_limit ?? 5,
    accent: body.accent || 'blue',
    env_prefix: body.env_prefix || body.id.toUpperCase().replace(/-/g, '_'),
    rank_group: body.rank_group || null,
    mail_subject: body.mail_subject || null,
    mail_body: body.mail_body || null,
    item_count: body.item_count ?? null,
    fail_debuff_spell_id: body.fail_debuff_spell_id ?? null,
    fail_debuff_duration_ms: body.fail_debuff_duration_ms ?? null,
    critfail_debuff_spell_id: body.critfail_debuff_spell_id ?? null,
    critfail_debuff_duration_ms: body.critfail_debuff_duration_ms ?? null,
    teleport_map_id: body.teleport_map_id ?? null,
    teleport_x: body.teleport_x ?? null,
    teleport_y: body.teleport_y ?? null,
    teleport_z: body.teleport_z ?? null,
    teleport_o: body.teleport_o ?? null,
    sort: body.sort ?? 0,
    modified_by_user: 1,
  })

  return { perk, message: `Perk "${perk.name}" saved` }
})
