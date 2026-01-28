/**
 * POST /api/admin/mail/send-item
 * Send an item to a character via in-game mail (GM only)
 */
export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    const { username } = await getAuthenticatedGM(event)

    const body = await readBody(event)
    const {
      characterName,
      itemId,
      itemCount = 1,
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

    if (!itemId || typeof itemId !== 'number') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Valid item ID is required',
      })
    }

    if (!realmId || typeof realmId !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Realm ID is required',
      })
    }

    if (itemCount < 1 || itemCount > 1000) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Item count must be between 1 and 1000',
      })
    }

    const { getCharactersDbPool } = await import('#server/utils/mysql')
    const pool = await getCharactersDbPool(realmId)

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

    // Generate unique mail ID
    // AzerothCore mail IDs don't use autoincrement, so we need to find the next available ID
    const [maxIdRows] = await pool.query(
      'SELECT COALESCE(MAX(id), 0) + 1 as nextId FROM mail'
    )
    const mailId = (maxIdRows as any[])[0].nextId

    // Generate unique item GUID
    const [maxItemGuidRows] = await pool.query(
      'SELECT COALESCE(MAX(guid), 0) + 1 as nextGuid FROM item_instance'
    )
    const itemGuid = (maxItemGuidRows as any[])[0].nextGuid

    // Current timestamp
    const currentTime = Math.floor(Date.now() / 1000)
    const expireTime = currentTime + (30 * 24 * 3600) // 30 days expiration
    const deliverTime = currentTime

    // Create item instance
    // enchantments format: "enchantId duration charges" for each enchantment slot (space-separated)
    // Empty string for no enchantments
    await pool.query(
      `INSERT INTO item_instance
       (guid, itemEntry, owner_guid, creatorGuid, giftCreatorGuid, count, duration, charges, flags, enchantments, randomPropertyId, durability, playedTime, text)
       VALUES (?, ?, ?, 0, 0, ?, 0, '0 0 0 0 0', 0, '', 0, 0, 0, NULL)`,
      [itemGuid, itemId, receiverGuid, itemCount]
    )

    // Create mail entry
    await pool.query(
      `INSERT INTO mail
       (id, messageType, stationery, mailTemplateId, sender, receiver, subject, body, has_items, expire_time, deliver_time, money, cod, checked)
       VALUES (?, 0, 61, 0, 0, ?, ?, ?, 1, ?, ?, 0, 0, 0)`,
      [
        mailId,
        receiverGuid,
        subject.substring(0, 128), // Limit subject length
        mailBody.substring(0, 8000), // Limit body length
        expireTime,
        deliverTime,
      ]
    )

    // Link item to mail
    await pool.query(
      'INSERT INTO mail_items (mail_id, item_guid, receiver) VALUES (?, ?, ?)',
      [mailId, itemGuid, receiverGuid]
    )

    console.log(`[✓] Sent item ${itemId} (x${itemCount}) to character ${characterName} (GUID: ${receiverGuid}) via mail`)

    return {
      success: true,
      message: `Successfully sent item to ${characterName}`,
      mailId,
      itemId,
      itemCount,
      characterName,
      characterGuid: receiverGuid,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error sending item via mail:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to send item via mail',
      data: {
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
})
