/**
 * GET /api/admin/items/search
 * Search items by name (English + German locale) or by item ID from world database (GM only)
 */
export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

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

    if (searchTerm.length < 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Search term must be at least 1 character',
      })
    }

    const { getWorldDbPool } = await import('#server/utils/mysql')
    const worldPool = await getWorldDbPool(realmId)

    const isNumericSearch = /^\d+$/.test(searchTerm)

    let rows: any[]

    if (isNumericSearch) {
      // Search by exact item ID
      const [result] = await worldPool.query(
        `SELECT
          it.entry as id,
          it.name,
          itl.Name as localeName,
          it.displayid as displayId,
          it.Quality as quality,
          it.class as itemClass,
          it.subclass as itemSubclass,
          it.InventoryType as inventoryType,
          it.ItemLevel as itemLevel,
          it.RequiredLevel as requiredLevel,
          it.stackable,
          it.MaxDurability as maxDurability
         FROM item_template it
         LEFT JOIN item_template_locale itl ON it.entry = itl.ID AND itl.locale = 'deDE'
         WHERE it.entry = ?
         LIMIT 1`,
        [parseInt(searchTerm)]
      )
      rows = result as any[]
    } else {
      if (searchTerm.length < 2) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Search term must be at least 2 characters',
        })
      }

      // Search by English name OR German locale name
      const [result] = await worldPool.query(
        `SELECT
          it.entry as id,
          it.name,
          itl.Name as localeName,
          it.displayid as displayId,
          it.Quality as quality,
          it.class as itemClass,
          it.subclass as itemSubclass,
          it.InventoryType as inventoryType,
          it.ItemLevel as itemLevel,
          it.RequiredLevel as requiredLevel,
          it.stackable,
          it.MaxDurability as maxDurability
         FROM item_template it
         LEFT JOIN item_template_locale itl ON it.entry = itl.ID AND itl.locale = 'deDE'
         WHERE it.name LIKE ? OR itl.Name LIKE ?
         ORDER BY it.Quality DESC, it.ItemLevel DESC, it.name ASC
         LIMIT ?`,
        [`%${searchTerm}%`, `%${searchTerm}%`, limit]
      )
      rows = result as any[]
    }

    return {
      items: rows,
      count: rows.length,
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
