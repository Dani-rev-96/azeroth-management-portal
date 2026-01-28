/**
 * GET /api/admin/items/search
 * Search items by name from world database (GM only)
 */
export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    await getAuthenticatedGM(event)

    const query = getQuery(event)
    const searchTerm = (query.q as string || '').trim()
    const realmId = query.realmId as string
    const limit = Math.min(Math.max(parseInt(query.limit as string) || 50, 1), 200)

    if (!realmId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Realm ID is required',
      })
    }

    if (searchTerm.length < 2) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Search term must be at least 2 characters',
      })
    }

    const { getWorldDbPool } = await import('#server/utils/mysql')
    const worldPool = await getWorldDbPool(realmId)

    // Search items by name, also return quality, class, subclass for filtering
    const [rows] = await worldPool.query(
      `SELECT
        entry as id,
        name,
        displayid as displayId,
        Quality as quality,
        class as itemClass,
        subclass as itemSubclass,
        InventoryType as inventoryType,
        ItemLevel as itemLevel,
        RequiredLevel as requiredLevel,
        stackable,
        MaxDurability as maxDurability
       FROM item_template
       WHERE name LIKE ?
       ORDER BY Quality DESC, ItemLevel DESC, name ASC
       LIMIT ?`,
      [`%${searchTerm}%`, limit]
    )

    return {
      items: rows,
      count: (rows as any[]).length,
      query: searchTerm,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error searching items:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to search items',
      data: {
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
})
