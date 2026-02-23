/**
 * POST /api/admin/dressingroom/add-item
 * Add items to a character via mail or Eluna bag queue
 * GM only
 *
 * Body: { guid: number, realmId: string, items: Array<{ itemId: number, count: number }> }
 */
import { getAuthenticatedGM } from '#server/utils/auth'
import { getCharactersDbPool, getWorldDbPool } from '#server/utils/mysql'
import { getElunaConfig } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  try {
    const { username } = await getAuthenticatedGM(event)

    const body = await readBody(event)
    const { guid, realmId, items } = body as {
      guid: number
      realmId: string
      items: Array<{ itemId: number; count: number }>
    }

    if (!guid || typeof guid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Valid character GUID is required' })
    }
    if (!realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'At least one item is required' })
    }
    if (items.length > 50) {
      throw createError({ statusCode: 400, statusMessage: 'Maximum 50 items per request' })
    }

    const charPool = await getCharactersDbPool(realmId)
    const worldPool = await getWorldDbPool(realmId)

    // Verify character exists
    const [chars] = await charPool.query(
      'SELECT guid, name, online FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )
    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    const charName = (chars as any[])[0].name

    // Validate all item IDs exist
    const itemIds = items.map(i => i.itemId)
    const placeholders = itemIds.map(() => '?').join(',')
    const [validItems] = await worldPool.query(
      `SELECT entry, name FROM item_template WHERE entry IN (${placeholders})`,
      itemIds
    )
    const validItemMap = new Map((validItems as any[]).map(i => [i.entry, i.name]))

    const invalidIds = itemIds.filter(id => !validItemMap.has(id))
    if (invalidIds.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid item IDs: ${invalidIds.join(', ')}`,
      })
    }

    // Use Eluna bag delivery if available, otherwise mail
    const elunaConfig = getElunaConfig()
    const deliveryResults: string[] = []

    if (elunaConfig.enabled) {
      // Queue via web_bag_requests for direct bag delivery
      for (const item of items) {
        const itemName = validItemMap.get(item.itemId) || `Item #${item.itemId}`
        await charPool.query(
          `INSERT INTO web_bag_requests (character_guid, item_entry, item_count, reason, status)
           VALUES (?, ?, ?, ?, 'pending')`,
          [guid, item.itemId, item.count, `GM DressingRoom: ${username} added ${item.count}x ${itemName}`]
        )
        deliveryResults.push(`${item.count}x ${itemName}`)
      }
    } else {
      // Queue via web_item_requests (mail-based)
      for (const item of items) {
        const itemName = validItemMap.get(item.itemId) || `Item #${item.itemId}`
        await charPool.query(
          `INSERT INTO web_item_requests
           (character_guid, item_entry, item_count, mail_subject, mail_body, reason, status)
           VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
          [
            guid,
            item.itemId,
            item.count,
            'GM Delivery',
            `Items from GM ${username}`,
            `GM DressingRoom: ${username} added ${item.count}x ${itemName}`,
          ]
        )
        deliveryResults.push(`${item.count}x ${itemName}`)
      }
    }

    console.log(`[DressingRoom] GM ${username} added items to ${charName} (${guid}): ${deliveryResults.join(', ')}`)

    return {
      success: true,
      message: `Added ${deliveryResults.join(', ')} to ${charName}`,
      deliveryMethod: elunaConfig.enabled ? 'bag' : 'mail',
      items: deliveryResults,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[DressingRoom] Error adding items:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to add items' })
  }
})
