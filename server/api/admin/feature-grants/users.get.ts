/**
 * GET /api/admin/feature-grants/users
 * Search known users (from account_mappings) for feature grant autocomplete.
 * Returns distinct users with their external_id and display_name.
 * Requires GM or admin.feature-grants feature access.
 */
export default defineEventHandler(async (event) => {
  try {
    await getAuthenticatedFeatureUser(event, 'admin.feature-grants')

    const query = getQuery(event)
    const search = String(query.q || '').trim().toLowerCase()

    const { AccountMappingDB } = await import('#server/utils/db')
    const allMappings = AccountMappingDB.findAll()

    // Deduplicate by external_id, keeping the most recent display_name
    const userMap = new Map<string, { userId: string; username: string }>()
    for (const m of allMappings) {
      if (!userMap.has(m.external_id)) {
        userMap.set(m.external_id, {
          userId: m.external_id,
          username: m.display_name,
        })
      }
    }

    let users = Array.from(userMap.values())

    // Filter by search query if provided
    if (search) {
      users = users.filter(
        u =>
          u.username.toLowerCase().includes(search) ||
          u.userId.toLowerCase().includes(search)
      )
    }

    // Limit results
    return { users: users.slice(0, 20) }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error searching users for feature grants:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to search users',
    })
  }
})
