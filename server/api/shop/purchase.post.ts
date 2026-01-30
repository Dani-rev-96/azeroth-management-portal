/**
 * POST /api/shop/purchase
 * Purchase an item from the shop
 * Requires authentication
 *
 * Supports delivery methods:
 * - mail: Send items via in-game mail (works offline)
 * - bag: Add items directly to inventory via Eluna (works online, queued if offline)
 * - both: User chooses
 *
 * All delivery is handled by the Eluna web_worker.lua script which properly
 * allocates item GUIDs through the server's native APIs.
 */

import { getShopConfig, isElunaShopEnabled } from '#server/utils/config'
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

    // Check if Eluna features are enabled (required for item/money queue processing)
    if (!isElunaShopEnabled()) {
      throw createError({
        statusCode: 503,
        statusMessage: 'Shop requires Eluna features to be enabled. Please configure NUXT_ELUNA_ENABLED and NUXT_ELUNA_SHOP_ENABLED.',
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
    // With Eluna, bag delivery is queued and processed when player is online
    // If offline, the request waits until login
    let actualDelivery: 'mail' | 'bag' = 'mail'

    if (shopConfig.deliveryMethod === 'bag') {
      actualDelivery = 'bag'
    } else if (shopConfig.deliveryMethod === 'both') {
      // User's choice
      actualDelivery = requestedDelivery === 'bag' ? 'bag' : 'mail'
    }
    // else: mail only (default)

    // Execute the purchase based on delivery method
    if (actualDelivery === 'bag') {
      return await deliverViaBag(
        charPool,
        character,
        item,
        quantity,
        totalCost,
        user.username,
        isOnline
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
 * Deliver items directly to bag via Eluna web_bag_requests queue
 * The Eluna script (web_worker.lua) will process this using Player:AddItem()
 * which properly allocates item GUIDs.
 *
 * If the player is offline, the request is queued with 'waiting' status
 * and processed automatically when they log in.
 */
async function deliverViaBag(
  charPool: any,
  character: any,
  item: any,
  quantity: number,
  totalCost: number,
  username: string,
  isOnline: boolean
): Promise<ShopPurchaseResponse> {
  const reason = `Shop purchase: ${quantity}x ${item.name}`

  // Queue money deduction via web_money_requests table
  await charPool.query(
    `INSERT INTO web_money_requests (character_guid, delta_copper, reason, status)
     VALUES (?, ?, ?, 'pending')`,
    [character.guid, -totalCost, reason]
  )

  // Queue bag delivery via web_bag_requests table
  // The Eluna script will add items using Player:AddItem() when player is online
  await charPool.query(
    `INSERT INTO web_bag_requests (character_guid, item_entry, item_count, reason, status)
     VALUES (?, ?, ?, ?, 'pending')`,
    [character.guid, item.entry, quantity, reason]
  )

  // Calculate new balance (the actual deduction happens async via Eluna script)
  const newBalance = character.money - totalCost

  const deliveryNote = isOnline
    ? 'Items will appear in your bags shortly!'
    : 'Items will be delivered when you log in.'

  console.log(`[Shop] ${username} purchased ${quantity}x ${item.name} for ${character.name} via bag (queued) - Cost: ${formatMoney(totalCost)}`)

  return {
    success: true,
    message: `Successfully purchased ${quantity}x ${item.name}. ${deliveryNote}`,
    itemName: item.name,
    totalCost,
    newBalance,
    deliveryMethod: 'bag',
  }
}

/**
 * Deliver items via in-game mail using web_item_requests queue
 * The Eluna script (web_worker.lua) will process this and create items
 * using the server's proper item GUID allocation.
 * Works for both online and offline characters.
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

  // Queue item delivery via web_item_requests table
  // The Eluna script (web_worker.lua) will process this and use SendMail
  // to properly allocate item GUIDs through the server's internal systems
  await charPool.query(
    `INSERT INTO web_item_requests
     (character_guid, item_entry, item_count, mail_subject, mail_body, reason, status)
     VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
    [
      character.guid,
      itemId,
      quantity,
      shopConfig.mailSubject.substring(0, 128),
      shopConfig.mailBody.substring(0, 8000),
      reason,
    ]
  )

  // Calculate new balance (the actual deduction happens async via Eluna script)
  const newBalance = character.money - totalCost

  console.log(`[Shop] ${username} purchased ${quantity}x ${item.name} for ${character.name} via mail (queued) - Cost: ${formatMoney(totalCost)}`)

  return {
    success: true,
    message: `Successfully purchased ${quantity}x ${item.name}. Check your mailbox!`,
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
