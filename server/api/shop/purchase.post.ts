/**
 * POST /api/shop/purchase
 * Purchase an item from the shop
 * Requires authentication
 *
 * Supports delivery methods:
 * - mail: Send items via in-game mail (works offline)
 * - bag: Add items directly to inventory via SOAP (requires online)
 * - both: User chooses, with automatic fallback
 */

import { getShopConfig, getRealmSoapConfig, validateRealmSoapConfig, type RealmSoapConfig } from '#server/utils/config'
import type { ShopPurchaseRequest, ShopPurchaseResponse } from '~/types'

export default defineEventHandler(async (event): Promise<ShopPurchaseResponse> => {
  try {
    const shopConfig = getShopConfig()

    if (!shopConfig.enabled) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Shop is currently disabled',
      })
    }

    // Authenticate user
    const { getAuthenticatedUser } = await import('#server/utils/auth')
    const user = await getAuthenticatedUser(event)

    const body = await readBody<ShopPurchaseRequest>(event)
    const { itemId, quantity = 1, characterGuid, realmId, deliveryMethod: requestedDelivery } = body

    // Validation
    if (!itemId || typeof itemId !== 'number' || itemId <= 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid item ID',
      })
    }

    if (!quantity || typeof quantity !== 'number' || quantity < 1 || quantity > 200) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Quantity must be between 1 and 200',
      })
    }

    if (!characterGuid || typeof characterGuid !== 'number') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Character GUID is required',
      })
    }

    if (!realmId || typeof realmId !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Realm ID is required',
      })
    }

    // Get realm-specific SOAP config
    const realmSoapConfig = getRealmSoapConfig(realmId)

    // Validate SOAP config if needed for this realm
    const soapValidation = validateRealmSoapConfig(realmId)
    if (!soapValidation.valid) {
      console.error(`[Shop] SOAP configuration error for realm ${realmId}:`, soapValidation.error)
      // Fall back to mail-only if SOAP is misconfigured
      if (shopConfig.deliveryMethod !== 'mail') {
        console.warn(`[Shop] Falling back to mail delivery for realm ${realmId} due to SOAP config issues`)
      }
    }

    const { getCharactersDbPool, getWorldDbPool } = await import('#server/utils/mysql')
    const charPool = await getCharactersDbPool(realmId)
    const worldPool = await getWorldDbPool(realmId)

    // Get character and verify ownership
    const [charRows] = await charPool.query(
      'SELECT guid, name, account, money, online FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [characterGuid]
    )

    if ((charRows as any[]).length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Character not found',
      })
    }

    const character = (charRows as any[])[0]
    const isOnline = character.online === 1

    // Verify the user owns this character's account
    const { isDirectAuthMode, getDirectAuthSession } = await import('#server/utils/auth')

    let linkedAccountIds: number[]

    if (isDirectAuthMode()) {
      // In direct auth mode, get account ID directly from session
      const session = await getDirectAuthSession(event)
      if (!session) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Not authenticated',
        })
      }
      linkedAccountIds = [session.accountId]
    } else {
      // In external auth mode, use local SQLite database for mapping
      const { getDatabase } = await import('#server/utils/db')
      const db = getDatabase()

      // Get user's linked WoW accounts from local mapping (use user.id as the key)
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

    // Get item details from world database
    const [itemRows] = await worldPool.query(
      `SELECT entry, name, BuyPrice as buyPrice, MaxDurability, stackable, class, subclass
       FROM item_template WHERE entry = ?`,
      [itemId]
    )

    if ((itemRows as any[]).length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Item not found',
      })
    }

    const item = (itemRows as any[])[0]

    // Verify item is in an allowed category
    const allowedCategories = [
      { class: 7 },                          // Trade Goods
      { class: 15, subclasses: [0, 1, 2, 3, 4, 5] }, // Miscellaneous including mounts
    ]

    let isAllowed = false
    for (const cat of allowedCategories) {
      if (item.class === cat.class) {
        if (!cat.subclasses || cat.subclasses.includes(item.subclass)) {
          isAllowed = true
          break
        }
      }
    }

    if (!isAllowed) {
      throw createError({
        statusCode: 400,
        statusMessage: 'This item is not available in the shop',
      })
    }

    // Calculate total cost with markup
    const markupMultiplier = 1 + (shopConfig.priceMarkupPercent / 100)
    const shopPrice = Math.ceil(item.buyPrice * markupMultiplier)
    const totalCost = shopPrice * quantity

    // Check if character has enough money
    if (character.money < totalCost) {
      const needed = totalCost - character.money
      throw createError({
        statusCode: 400,
        statusMessage: `Not enough gold. You need ${formatMoney(needed)} more.`,
      })
    }

    // Determine actual delivery method
    let actualDelivery: 'mail' | 'bag' = 'mail'

    if (shopConfig.deliveryMethod === 'bag') {
      // Bag only - require online
      if (!isOnline) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Character must be online for direct bag delivery. Please log in first.',
        })
      }
      actualDelivery = 'bag'
    } else if (shopConfig.deliveryMethod === 'both') {
      // User's choice with fallback
      if (requestedDelivery === 'bag') {
        if (!isOnline) {
          throw createError({
            statusCode: 400,
            statusMessage: 'Character must be online for direct bag delivery. Please use mail delivery or log in first.',
          })
        }
        actualDelivery = 'bag'
      } else {
        actualDelivery = 'mail'
      }
    }
    // else: mail only (default)

    // Check SOAP availability for bag delivery
    if (actualDelivery === 'bag' && (!realmSoapConfig?.enabled || !soapValidation.valid)) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Direct bag delivery is currently unavailable for this realm. Please use mail delivery.',
      })
    }

    // Execute the purchase based on delivery method
    if (actualDelivery === 'bag') {
      return await deliverViaBag(
        charPool,
        character,
        item,
        quantity,
        totalCost,
        user.username,
        shopConfig,
        realmSoapConfig!
      )
    } else {
      return await deliverViaMail(
        charPool,
        character,
        item,
        itemId,
        quantity,
        totalCost,
        user.username,
        shopConfig
      )
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error processing shop purchase:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process purchase',
      data: {
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
})

/**
 * Deliver items directly to bag via SOAP
 * Transaction: Deduct money -> Add item -> Refund on failure
 * Requires character to be online.
 */
async function deliverViaBag(
  charPool: any,
  character: any,
  item: any,
  quantity: number,
  totalCost: number,
  username: string,
  shopConfig: ReturnType<typeof getShopConfig>,
  soapConfig: RealmSoapConfig
): Promise<ShopPurchaseResponse> {
  const { addItemToCharacter } = await import('#server/services/soap')

  // Step 1: Queue money deduction via web_money_requests table
  // The Eluna script will process this for both online and offline characters
  const reason = `Shop purchase: ${quantity}x ${item.name}`
  await charPool.query(
    `INSERT INTO web_money_requests (character_guid, delta_copper, reason, status)
     VALUES (?, ?, ?, 'pending')`,
    [character.guid, -totalCost, reason]
  )

  try {
    // Step 2: Add items directly to bags via SOAP .additem command
    const result = await addItemToCharacter(
      soapConfig,
      character.name,
      item.entry,
      quantity
    )

    if (!result.success) {
      // Step 3: Queue refund on failure via web_money_requests
      console.error(`[Shop] SOAP bag delivery failed for ${character.name}:`, result.error)
      await charPool.query(
        `INSERT INTO web_money_requests (character_guid, delta_copper, reason, status)
         VALUES (?, ?, ?, 'pending')`,
        [character.guid, totalCost, `Refund: Failed to deliver ${quantity}x ${item.name}`]
      )
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to deliver items: ${result.error || 'Unknown error'}. Your gold has been refunded.`,
      })
    }

    // Calculate new balance (the actual deduction happens async via Eluna script)
    const newBalance = character.money - totalCost

    console.log(`[Shop] ${username} purchased ${quantity}x ${item.name} for ${character.name} via bag - Cost: ${formatMoney(totalCost)}`)

    return {
      success: true,
      message: `Successfully purchased ${quantity}x ${item.name}. Items delivered to your bags!`,
      itemName: item.name,
      totalCost,
      newBalance,
      deliveryMethod: 'bag',
    }
  } catch (error) {
    // Ensure refund on any unexpected error via web_money_requests
    if (!(error && typeof error === 'object' && 'statusCode' in error)) {
      console.error('[Shop] Unexpected error during bag delivery, queueing refund:', error)
      await charPool.query(
        `INSERT INTO web_money_requests (character_guid, delta_copper, reason, status)
         VALUES (?, ?, ?, 'pending')`,
        [character.guid, totalCost, `Refund: Unexpected error during delivery`]
      )
    }
    throw error
  }
}

/**
 * Deliver items via in-game mail
 * Original implementation - works for both online and offline characters
 */
async function deliverViaMail(
  charPool: any,
  character: any,
  item: any,
  itemId: number,
  quantity: number,
  totalCost: number,
  username: string,
  shopConfig: ReturnType<typeof getShopConfig>
): Promise<ShopPurchaseResponse> {
  // Queue money deduction via web_money_requests table
  // The Eluna script will process this for both online and offline characters
  const reason = `Shop purchase: ${quantity}x ${item.name}`
  await charPool.query(
    `INSERT INTO web_money_requests (character_guid, delta_copper, reason, status)
     VALUES (?, ?, ?, 'pending')`,
    [character.guid, -totalCost, reason]
  )

  // Send item via mail
  // Generate unique mail ID
  const [maxIdRows] = await charPool.query(
    'SELECT COALESCE(MAX(id), 0) + 1 as nextId FROM mail'
  )
  const mailId = (maxIdRows as any[])[0].nextId

  const currentTime = Math.floor(Date.now() / 1000)
  const expireTime = currentTime + (30 * 24 * 3600) // 30 days

  // Create item instance(s)
  const [maxItemGuidRows] = await charPool.query(
    'SELECT COALESCE(MAX(guid), 0) as maxGuid FROM item_instance'
  )
  let nextItemGuid = (maxItemGuidRows as any[])[0].maxGuid + 1

  const durability = item.MaxDurability || 0
  const stackable = item.stackable || 1

  // Calculate how many stacks we need
  const itemsPerStack = Math.min(stackable, 200)
  const fullStacks = Math.floor(quantity / itemsPerStack)
  const remainder = quantity % itemsPerStack

  const createdItems: { guid: number; count: number }[] = []

  // Create full stacks
  for (let i = 0; i < fullStacks; i++) {
    await charPool.query(
      `INSERT INTO item_instance
       (guid, itemEntry, owner_guid, creatorGuid, giftCreatorGuid, count, duration, charges, flags, enchantments, randomPropertyId, durability, playedTime, text)
       VALUES (?, ?, ?, 0, 0, ?, 0, '0 0 0 0 0', 0, '', 0, ?, 0, NULL)`,
      [nextItemGuid, itemId, character.guid, itemsPerStack, durability]
    )
    createdItems.push({ guid: nextItemGuid, count: itemsPerStack })
    nextItemGuid++
  }

  // Create remainder stack if needed
  if (remainder > 0) {
    await charPool.query(
      `INSERT INTO item_instance
       (guid, itemEntry, owner_guid, creatorGuid, giftCreatorGuid, count, duration, charges, flags, enchantments, randomPropertyId, durability, playedTime, text)
       VALUES (?, ?, ?, 0, 0, ?, 0, '0 0 0 0 0', 0, '', 0, ?, 0, NULL)`,
      [nextItemGuid, itemId, character.guid, remainder, durability]
    )
    createdItems.push({ guid: nextItemGuid, count: remainder })
    nextItemGuid++
  }

  // Create mail entry
  const hasItems = createdItems.length > 0 ? 1 : 0
  await charPool.query(
    `INSERT INTO mail
     (id, messageType, stationery, mailTemplateId, sender, receiver, subject, body, has_items, expire_time, deliver_time, money, cod, checked)
     VALUES (?, 0, 61, 0, 0, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
    [
      mailId,
      character.guid,
      shopConfig.mailSubject.substring(0, 128),
      shopConfig.mailBody.substring(0, 8000),
      hasItems,
      expireTime,
      currentTime,
    ]
  )

  // Link items to mail
  for (const createdItem of createdItems) {
    await charPool.query(
      'INSERT INTO mail_items (mail_id, item_guid, receiver) VALUES (?, ?, ?)',
      [mailId, createdItem.guid, character.guid]
    )
  }

  // Calculate new balance (the actual deduction happens async via Eluna script)
  const newBalance = character.money - totalCost

  console.log(`[Shop] ${username} purchased ${quantity}x ${item.name} for ${character.name} via mail - Cost: ${formatMoney(totalCost)}`)

  return {
    success: true,
    message: `Successfully purchased ${quantity}x ${item.name}. Check your mailbox!`,
    mailId,
    itemName: item.name,
    totalCost,
    newBalance,
    deliveryMethod: 'mail',
  }
}

// Helper to format money as gold/silver/copper
function formatMoney(copper: number): string {
  const gold = Math.floor(copper / 10000)
  const silver = Math.floor((copper % 10000) / 100)
  const copperRemainder = copper % 100

  const parts: string[] = []
  if (gold > 0) parts.push(`${gold}g`)
  if (silver > 0) parts.push(`${silver}s`)
  if (copperRemainder > 0 || parts.length === 0) parts.push(`${copperRemainder}c`)

  return parts.join(' ')
}
