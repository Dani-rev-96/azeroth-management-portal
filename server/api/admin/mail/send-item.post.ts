/**
 * POST /api/admin/mail/send-item
 * Send items and/or money to a character via in-game mail (GM only)
 * Uses web_item_requests queue - Eluna script processes and creates items
 * using the server's proper item GUID allocation.
 */

import { isElunaGmMailEnabled } from '#server/utils/config'

interface MailItem {
  itemId: number
  itemCount: number
}

export default defineEventHandler(async (event) => {
  try {
    // Check if Eluna GM mail features are enabled
    if (!isElunaGmMailEnabled()) {
      throw createError({
        statusCode: 503,
        statusMessage: 'GM Mail requires Eluna features to be enabled. Please configure NUXT_ELUNA_ENABLED and NUXT_ELUNA_GM_MAIL_ENABLED.',
      })
    }

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

    // Get item templates for validation
    const itemTemplates: Map<number, { entry: number, name: string }> = new Map()
    if (itemsToSend.length > 0) {
      const itemIds = [...new Set(itemsToSend.map(i => i.itemId))]
      const placeholders = itemIds.map(() => '?').join(',')
      const [templateRows] = await worldPool.query(
        `SELECT entry, name FROM item_template WHERE entry IN (${placeholders})`,
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

    // Queue items via web_item_requests table
    // The Eluna script (web_worker.lua) will process this and use SendMail
    // to properly allocate item GUIDs through the server's internal systems
    //
    // We now use items_json to batch ALL items (up to 12) into a single mail request.
    // This reduces mail spam and ensures money + all items arrive in one mail.
    const queuedItems: { itemId: number, itemCount: number, name: string }[] = []

    if (itemsToSend.length > 0) {
      // Build items array with names for logging
      for (const item of itemsToSend) {
        const template = itemTemplates.get(item.itemId)!
        queuedItems.push({
          itemId: item.itemId,
          itemCount: item.itemCount,
          name: template.name
        })
      }

      // Build items_json array: [[entry, count], [entry, count], ...]
      const itemsJsonArray = itemsToSend.map(item => [item.itemId, item.itemCount])
      const itemsJson = JSON.stringify(itemsJsonArray)

      // Build human-readable reason
      const itemsList = queuedItems.map(i => `${i.itemCount}x ${i.name}`).join(', ')
      const reason = `GM Mail from ${username}: ${itemsList}`

      // Single INSERT with all items as JSON, plus money
      await pool.query(
        `INSERT INTO web_item_requests
         (character_guid, item_entry, item_count, items_json, mail_subject, mail_body, money, reason, status)
         VALUES (?, 0, 0, ?, ?, ?, ?, ?, 'pending')`,
        [
          receiverGuid,
          itemsJson,
          subject.substring(0, 128),
          mailBody.substring(0, 8000),
          moneyToSend,
          reason,
        ]
      )
    } else if (moneyToSend > 0) {
      // Money-only mail - create a request with no items
      await pool.query(
        `INSERT INTO web_item_requests
         (character_guid, item_entry, item_count, mail_subject, mail_body, money, reason, status)
         VALUES (?, 0, 0, ?, ?, ?, ?, 'pending')`,
        [
          receiverGuid,
          subject.substring(0, 128),
          mailBody.substring(0, 8000),
          moneyToSend,
          `GM Mail money from ${username}`,
        ]
      )
    }

    // Build log message
    const itemsLog = queuedItems.map(i => `${i.name} (ID: ${i.itemId}, x${i.itemCount})`).join(', ')
    const moneyLog = moneyToSend > 0 ? `${Math.floor(moneyToSend / 10000)}g ${Math.floor((moneyToSend % 10000) / 100)}s ${moneyToSend % 100}c` : ''
    console.log(`[✓] Queued mail to ${characterName}: ${itemsLog}${itemsLog && moneyLog ? ', ' : ''}${moneyLog}`)

    return {
      success: true,
      message: `Successfully queued mail to ${characterName}. Items will be delivered shortly.`,
      items: queuedItems.map(i => ({
        itemId: i.itemId,
        itemCount: i.itemCount,
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
