/**
 * DELETE /api/admin/portal-config/perk-groups/[id]
 * Delete a perk group from the self-managed database.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const id = getRouterParam(event, 'id')
  if (!id) {
    throw createError({ statusCode: 400, statusMessage: 'Perk group ID is required' })
  }

  const { PerkGroupsDB, PerksDB } = await import('#server/utils/portal-config-db')

  // Check if any perks reference this group
  const perks = PerksDB.findByGroup(id)
  if (perks.length > 0) {
    throw createError({
      statusCode: 409,
      statusMessage: `Cannot delete group "${id}" — ${perks.length} perk(s) still reference it. Delete or reassign them first.`,
    })
  }

  const deleted = PerkGroupsDB.delete(id)
  if (!deleted) {
    throw createError({ statusCode: 404, statusMessage: `Perk group "${id}" not found` })
  }

  return { message: `Perk group "${id}" deleted` }
})
