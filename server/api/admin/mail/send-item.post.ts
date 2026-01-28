/**
 * POST /api/admin/mail/send-item
 * Send items and/or money to a character via in-game mail (GM only)
 */

interface MailItem {
  itemId: number
  itemCount: number
}

export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    const { username } = await getAuthenticatedGM(event)

    const body = await readBody(event)
    const {
      characterName,
      // Legacy single item support (backward compatible)
      itemId,
      itemCount = 1,
      // New multiple items support
      items = [] as MailItem[],
      // Money in copper (100 copper = 1 silver, 10000 copper = 1 gold)
      money = 0,
      subject = 'GM Mail',
      body: mailBody = '',
      realmId
    } = body

    // Validation
    if (!characterName || typeof characterName !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Character name is required',
      })
    }

    if (!realmId || typeof realmId !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Realm ID is required',
      })
    }

    // Build normalized items list from legacy or new format
    let itemsToSend: MailItem[] = []

    if (items && Array.isArray(items) && items.length > 0) {
      // New format: array of items
      itemsToSend = items.filter((item: any) =>
        item && typeof item.itemId === 'number' && item.itemId > 0
      ).map((item: any) => ({
        itemId: item.itemId,
        itemCount: Math.min(Math.max(item.itemCount || 1, 1), 1000)
      }))
    } else if (itemId && typeof itemId === 'number') {
      // Legacy format: single item
      itemsToSend = [{ itemId, itemCount: Math.min(Math.max(itemCount, 1), 1000) }]
    }

    // Validate money
    const moneyToSend = typeof money === 'number' ? Math.max(0, Math.floor(money)) : 0

    // Max items per mail in WoW is 12 (MAIL_MAX_ITEM_SLOT)
    if (itemsToSend.length > 12) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Maximum 12 items per mail',
      })
    }

    // Must send at least items or money
    if (itemsToSend.length === 0 && moneyToSend === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Must include at least one item or money',
      })
    }

    const { getCharactersDbPool, getWorldDbPool } = await import('#server/utils/mysql')
    const pool = await getCharactersDbPool(realmId)
    const worldPool = await getWorldDbPool(realmId)

    // Get character by name
    const [charRows] = await pool.query(
      'SELECT guid, name FROM characters WHERE name = ? AND deleteDate IS NULL',
      [characterName]
    )

    if ((charRows as any[]).length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: `Character '${characterName}' not found on this realm`,
      })
    }

    const character = (charRows as any[])[0]
    const receiverGuid = character.guid

    // Get item templates for durability and validation
    const itemTemplates: Map<number, { entry: number, MaxDurability: number, stackable: number, name: string }> = new Map()
    if (itemsToSend.length > 0) {
      const itemIds = [...new Set(itemsToSend.map(i => i.itemId))]
      const placeholders = itemIds.map(() => '?').join(',')
      const [templateRows] = await worldPool.query(
        `SELECT entry, MaxDurability, stackable, name FROM item_template WHERE entry IN (${placeholders})`,
        itemIds
      )
      for (const row of templateRows as any[]) {
        itemTemplates.set(row.entry, row)
      }

      // Validate all items exist
      for (const item of itemsToSend) {
        if (!itemTemplates.has(item.itemId)) {
          throw createError({
            statusCode: 404,
            statusMessage: `Item with ID ${item.itemId} not found in item_template`,
          })
        }
      }
    }

    // Generate unique mail ID
    // AzerothCore mail IDs don't use autoincrement, so we need to find the next available ID
    const [maxIdRows] = await pool.query(
      'SELECT COALESCE(MAX(id), 0) + 1 as nextId FROM mail'
    )
    const mailId = (maxIdRows as any[])[0].nextId

    // Current timestamp
    const currentTime = Math.floor(Date.now() / 1000)
    const expireTime = currentTime + (30 * 24 * 3600) // 30 days expiration
    const deliverTime = currentTime

    // Create item instances and collect their GUIDs
    const createdItems: { guid: number, itemId: number, count: number, name: string }[] = []

    if (itemsToSend.length > 0) {
      // Get starting GUID for items
      const [maxItemGuidRows] = await pool.query(
        'SELECT COALESCE(MAX(guid), 0) as maxGuid FROM item_instance'
      )
      let nextItemGuid = (maxItemGuidRows as any[])[0].maxGuid + 1

      for (const item of itemsToSend) {
        const template = itemTemplates.get(item.itemId)!
        const durability = template.MaxDurability || 0

        // Create item instance with proper durability
        await pool.query(
          `INSERT INTO item_instance
           (guid, itemEntry, owner_guid, creatorGuid, giftCreatorGuid, count, duration, charges, flags, enchantments, randomPropertyId, durability, playedTime, text)
           VALUES (?, ?, ?, 0, 0, ?, 0, '0 0 0 0 0', 0, '', 0, ?, 0, NULL)`,
          [nextItemGuid, item.itemId, receiverGuid, item.itemCount, durability]
        )

        createdItems.push({
          guid: nextItemGuid,
          itemId: item.itemId,
          count: item.itemCount,
          name: template.name
        })

        nextItemGuid++
      }
    }

    // Create mail entry
    const hasItems = createdItems.length > 0 ? 1 : 0
    await pool.query(
      `INSERT INTO mail
       (id, messageType, stationery, mailTemplateId, sender, receiver, subject, body, has_items, expire_time, deliver_time, money, cod, checked)
       VALUES (?, 0, 61, 0, 0, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      [
        mailId,
        receiverGuid,
        subject.substring(0, 128), // Limit subject length
        mailBody.substring(0, 8000), // Limit body length
        hasItems,
        expireTime,
        deliverTime,
        moneyToSend,
      ]
    )

    // Link items to mail
    for (const item of createdItems) {
      await pool.query(
        'INSERT INTO mail_items (mail_id, item_guid, receiver) VALUES (?, ?, ?)',
        [mailId, item.guid, receiverGuid]
      )
    }

    // Build log message
    const itemsLog = createdItems.map(i => `${i.name} (ID: ${i.itemId}, x${i.count})`).join(', ')
    const moneyLog = moneyToSend > 0 ? `${Math.floor(moneyToSend / 10000)}g ${Math.floor((moneyToSend % 10000) / 100)}s ${moneyToSend % 100}c` : ''
    console.log(`[✓] Sent mail to ${characterName}: ${itemsLog}${itemsLog && moneyLog ? ', ' : ''}${moneyLog}`)

    return {
      success: true,
      message: `Successfully sent mail to ${characterName}`,
      mailId,
      items: createdItems.map(i => ({
        itemId: i.itemId,
        itemCount: i.count,
        itemGuid: i.guid,
        name: i.name
      })),
      money: moneyToSend,
      characterName,
      characterGuid: receiverGuid,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error sending mail:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to send mail',
      data: {
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
})
