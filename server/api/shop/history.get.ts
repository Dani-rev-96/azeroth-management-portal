/**
 * GET /api/shop/history
 * Get purchase history for a character from queue tables
 * Requires authentication + character ownership verification
 *
 * Query params:
 *   - characterGuid: character GUID
 *   - realmId: realm to query
 *   - page: page number (default 1)
 *   - limit: items per page (default 20, max 50)
 */

import { getShopConfig } from '#server/utils/config'
import type { ShopPurchaseHistoryEntry } from '~/types'

export default defineEventHandler(async (event) => {
  try {
    const shopConfig = await getShopConfig()

    if (!shopConfig.enabled) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Shop is currently disabled',
      })
    }

    // Authenticate user
    const { getAuthenticatedUser } = await import('#server/utils/auth')
    const user = await getAuthenticatedUser(event)

    const query = getQuery(event)
    const characterGuid = parseInt(query.characterGuid as string)
    const realmId = (query.realmId as string) || 'wotlk'
    const page = Math.max(1, parseInt(query.page as string) || 1)
    const limit = Math.min(50, Math.max(1, parseInt(query.limit as string) || 20))
    const offset = (page - 1) * limit

    if (!characterGuid || isNaN(characterGuid)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Character GUID is required',
      })
    }

    const { getCharactersDbPool, getWorldDbPool } = await import('#server/utils/mysql')
    const charPool = await getCharactersDbPool(realmId)
    const worldPool = await getWorldDbPool(realmId)

    // Verify character ownership
    const [charRows] = await charPool.query(
      'SELECT guid, account FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [characterGuid]
    )

    if ((charRows as any[]).length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Character not found',
      })
    }

    const character = (charRows as any[])[0]

    // Verify user owns this character
    const { isDirectAuthMode, getDirectAuthSession } = await import('#server/utils/auth')
    let linkedAccountIds: number[]

    if (isDirectAuthMode()) {
      const session = await getDirectAuthSession(event)
      if (!session) {
        throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
      }
      linkedAccountIds = [session.accountId]
    } else {
      const { getDatabase } = await import('#server/utils/db')
      const db = getDatabase()
      const stmt = db.prepare('SELECT wow_account_id FROM account_mappings WHERE external_id = ?')
      const mappings = stmt.all(user.id) as { wow_account_id: number }[]
      linkedAccountIds = mappings.map(m => m.wow_account_id)
    }

    if (!linkedAccountIds.includes(character.account)) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not own this character',
      })
    }

    // Query mail-based purchases from web_item_requests
    const [mailRows] = await charPool.query(
      `SELECT
        id,
        item_entry,
        item_count,
        reason,
        status,
        created_at,
        processed_at
      FROM web_item_requests
      WHERE character_guid = ?
        AND reason LIKE 'Shop purchase:%'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
      [characterGuid, limit, offset]
    )

    // Query bag-based purchases from web_bag_requests
    const [bagRows] = await charPool.query(
      `SELECT
        id,
        item_entry,
        item_count,
        reason,
        status,
        created_at,
        processed_at
      FROM web_bag_requests
      WHERE character_guid = ?
        AND reason LIKE 'Shop purchase:%'
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`,
      [characterGuid, limit, offset]
    )

    // Count totals
    const [mailCountRows] = await charPool.query(
      `SELECT COUNT(*) as total FROM web_item_requests
       WHERE character_guid = ? AND reason LIKE 'Shop purchase:%'`,
      [characterGuid]
    )
    const [bagCountRows] = await charPool.query(
      `SELECT COUNT(*) as total FROM web_bag_requests
       WHERE character_guid = ? AND reason LIKE 'Shop purchase:%'`,
      [characterGuid]
    )

    const mailTotal = (mailCountRows as any[])[0].total
    const bagTotal = (bagCountRows as any[])[0].total
    const totalPurchases = mailTotal + bagTotal

    // Merge and tag delivery method
    type RawEntry = {
      id: number
      item_entry: number
      item_count: number
      reason: string
      status: string
      created_at: string | null
      processed_at: string | null
    }

    const mailEntries = (mailRows as RawEntry[]).map(r => ({ ...r, deliveryMethod: 'mail' as const }))
    const bagEntries = (bagRows as RawEntry[]).map(r => ({ ...r, deliveryMethod: 'bag' as const }))

    // Combine, sort by created_at descending, take limit
    const allEntries = [...mailEntries, ...bagEntries]
      .sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0
        return dateB - dateA
      })
      .slice(0, limit)

    // Get item details from world database
    const itemEntries = [...new Set(allEntries.map(e => e.item_entry).filter(Boolean))]
    let itemInfoMap = new Map<number, { name: string; quality: number; displayid: number }>()

    if (itemEntries.length > 0) {
      const placeholders = itemEntries.map(() => '?').join(',')
      const [itemRows] = await worldPool.query(
        `SELECT entry, name, Quality as quality, displayid
         FROM item_template
         WHERE entry IN (${placeholders})`,
        itemEntries
      )
      for (const item of itemRows as any[]) {
        itemInfoMap.set(item.entry, {
          name: item.name,
          quality: item.quality,
          displayid: item.displayid,
        })
      }
    }

    // Get icons
    const { getItemDisplayInfoBatch } = await import('#server/utils/dbc-db')
    const displayIds = [...new Set(
      [...itemInfoMap.values()].map(i => i.displayid).filter(id => id > 0)
    )]
    const displayInfos = displayIds.length > 0 ? await getItemDisplayInfoBatch(displayIds) : []
    const iconMap = new Map<number, string>()
    for (const d of displayInfos) {
      let iconName = d.inventory_icon_1 || ''
      if (iconName.includes('\\')) {
        iconName = iconName.split('\\').pop() || ''
      }
      iconMap.set(d.id, iconName.toLowerCase())
    }

    // Get money deductions to associate costs
    // Match by character_guid + reason pattern
    const [moneyRows] = await charPool.query(
      `SELECT reason, delta_copper, created_at
       FROM web_money_requests
       WHERE character_guid = ?
         AND reason LIKE 'Shop purchase:%'
       ORDER BY created_at DESC`,
      [characterGuid]
    )
    // Build a lookup: reason -> cost (delta_copper is negative)
    const costByReason = new Map<string, number>()
    for (const m of moneyRows as any[]) {
      if (!costByReason.has(m.reason)) {
        costByReason.set(m.reason, Math.abs(m.delta_copper))
      }
    }

    // Build response entries
    const history: ShopPurchaseHistoryEntry[] = allEntries.map(entry => {
      const info = itemInfoMap.get(entry.item_entry)
      const icon = info ? (iconMap.get(info.displayid) || '') : ''

      return {
        id: entry.id,
        itemEntry: entry.item_entry,
        itemName: info?.name || `Item #${entry.item_entry}`,
        itemQuality: info?.quality ?? 1,
        itemIcon: icon,
        quantity: entry.item_count,
        totalCost: costByReason.get(entry.reason) || 0,
        deliveryMethod: entry.deliveryMethod,
        status: entry.status as ShopPurchaseHistoryEntry['status'],
        createdAt: entry.created_at || '',
        processedAt: entry.processed_at || null,
      }
    })

    return {
      history,
      pagination: {
        page,
        limit,
        total: totalPurchases,
        totalPages: Math.ceil(totalPurchases / limit),
      },
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error fetching purchase history:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch purchase history',
      data: {
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
})
