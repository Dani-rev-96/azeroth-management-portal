/**
 * GET /api/shop/items
 * Get shop items by category
 * Query params:
 *   - category: 'trade_goods' | 'mounts' | 'miscellaneous'
 *   - realmId: realm to query (e.g., '1')
 *   - page: page number (default 1)
 *   - limit: items per page (default 50, max 100)
 *   - search: optional search term
 */

import { getShopConfig } from '#server/utils/config'
import type { ShopItem, ShopCategory } from '~/types'

// Item class/subclass mappings for WoW 3.3.5
// Class 7 = Trade Goods (various crafting subclasses)
// Class 15 = Miscellaneous (subclass 0 = Junk, 5 = Mount)
const CATEGORY_FILTERS: Record<ShopCategory, { class: number; subclasses?: number[] }[]> = {
  trade_goods: [
    { class: 7 }, // All Trade Goods subclasses
  ],
  mounts: [
    { class: 15, subclasses: [5] }, // Miscellaneous -> Mount
  ],
  miscellaneous: [
    { class: 15, subclasses: [0, 1, 2, 3, 4] }, // Miscellaneous excluding mounts
  ],
}

export default defineEventHandler(async (event) => {
  try {
    const shopConfig = await getShopConfig()

    if (!shopConfig.enabled) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Shop is currently disabled',
      })
    }

    const query = getQuery(event)
    const category = query.category as ShopCategory
    const realmId = query.realmId as string || 'wotlk'
    const page = Math.max(1, parseInt(query.page as string) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 50))
    const search = (query.search as string || '').trim()
    const offset = (page - 1) * limit

    // Validate category
    if (!category || !shopConfig.categories.includes(category)) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid category. Must be one of: ${shopConfig.categories.join(', ')}`,
      })
    }

    const filters = CATEGORY_FILTERS[category]
    if (!filters || filters.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Unknown category: ${category}`,
      })
    }

    const { getWorldDbPool } = await import('#server/utils/mysql')
    const pool = await getWorldDbPool(realmId)

    // Build WHERE clause for category filters
    const whereConditions: string[] = []
    const params: any[] = []

    // Category filter
    const categoryConditions: string[] = []
    for (const filter of filters) {
      if (filter.subclasses && filter.subclasses.length > 0) {
        const subclassPlaceholders = filter.subclasses.map(() => '?').join(',')
        categoryConditions.push(`(class = ? AND subclass IN (${subclassPlaceholders}))`)
        params.push(filter.class, ...filter.subclasses)
      } else {
        categoryConditions.push(`class = ?`)
        params.push(filter.class)
      }
    }
    whereConditions.push(`(${categoryConditions.join(' OR ')})`)

    // Only items that can be purchased (have a buy price)
    whereConditions.push('BuyPrice > 0')

    // Only items that exist in vendor lists (optional - to ensure they're actually sold)
    // For now, we'll include all items with buy prices in these categories

    // Search filter
    if (search) {
      whereConditions.push('name LIKE ?')
      params.push(`%${search}%`)
    }

    const whereClause = whereConditions.join(' AND ')

    // Count total items
    const [countRows] = await pool.query(
      `SELECT COUNT(*) as total FROM item_template WHERE ${whereClause}`,
      params
    )
    const total = (countRows as any[])[0].total

    // Fetch items
    const [itemRows] = await pool.query(
      `SELECT
        entry,
        name,
        description,
        class,
        subclass,
        Quality as quality,
        BuyPrice as buyPrice,
        SellPrice as sellPrice,
        displayid,
        InventoryType as inventoryType,
        ItemLevel as itemLevel,
        RequiredLevel as requiredLevel,
        stackable as maxStackSize
      FROM item_template
      WHERE ${whereClause}
      ORDER BY ItemLevel DESC, name ASC
      LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    )

    const items = itemRows as any[]

    // Get icons for items
    const { getItemDisplayInfoBatch } = await import('#server/utils/dbc-db')
    const displayIds = [...new Set(items.map(i => i.displayid).filter(id => id > 0))]
    const displayInfos = displayIds.length > 0 ? await getItemDisplayInfoBatch(displayIds) : []
    const displayInfoMap = new Map(displayInfos.map(d => [d.id, d]))

    // Calculate markup price
    const markupMultiplier = 1 + (shopConfig.priceMarkupPercent / 100)

    const shopItems: ShopItem[] = items.map(item => {
      const displayInfo = displayInfoMap.get(item.displayid)
      let iconName = displayInfo?.inventory_icon_1 || ''
      // Extract just the icon name from the path
      if (iconName.includes('\\')) {
        iconName = iconName.split('\\').pop() || ''
      }

      return {
        entry: item.entry,
        name: item.name,
        description: item.description || '',
        class: item.class,
        subclass: item.subclass,
        quality: item.quality,
        buyPrice: item.buyPrice,
        sellPrice: item.sellPrice,
        shopPrice: Math.ceil(item.buyPrice * markupMultiplier),
        icon: iconName.toLowerCase(),
        inventoryType: item.inventoryType,
        itemLevel: item.itemLevel,
        requiredLevel: item.requiredLevel,
        maxStackSize: item.maxStackSize || 1,
      }
    })

    return {
      items: shopItems,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      category,
      markupPercent: shopConfig.priceMarkupPercent,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error fetching shop items:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch shop items',
      data: {
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
})
