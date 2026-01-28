/**
 * POST /api/shop/purchase
 * Purchase an item from the shop
 * Requires authentication
 */

import { getShopConfig } from '#server/utils/config'
import type { ShopPurchaseRequest, ShopPurchaseResponse } from '~/types'

export default defineEventHandler(async (event): Promise<ShopPurchaseResponse> => {
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

    const body = await readBody<ShopPurchaseRequest>(event)
    const { itemId, quantity = 1, characterGuid, realmId } = body

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
      'SELECT guid, name, account, money FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [characterGuid]
    )

    if ((charRows as any[]).length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Character not found',
      })
    }

    const character = (charRows as any[])[0]

    // Verify the user owns this character's account using local SQLite database
    const { getDatabase } = await import('#server/utils/db')
    const db = getDatabase()

    // Get user's linked WoW accounts from local mapping
    const stmt = db.prepare('SELECT wow_account_id FROM account_mappings WHERE keycloak_id = ?')
    const mappings = stmt.all(user.username) as { wow_account_id: number }[]
    const linkedAccountIds = mappings.map(m => m.wow_account_id)

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

    // Deduct money from character
    await charPool.query(
      'UPDATE characters SET money = money - ? WHERE guid = ?',
      [totalCost, characterGuid]
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
        [nextItemGuid, itemId, characterGuid, itemsPerStack, durability]
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
        [nextItemGuid, itemId, characterGuid, remainder, durability]
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
        characterGuid,
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
        [mailId, createdItem.guid, characterGuid]
      )
    }

    // Get new balance
    const [newBalanceRows] = await charPool.query(
      'SELECT money FROM characters WHERE guid = ?',
      [characterGuid]
    )
    const newBalance = (newBalanceRows as any[])[0].money

    console.log(`[Shop] ${user.username} purchased ${quantity}x ${item.name} for ${character.name} - Cost: ${formatMoney(totalCost)}`)

    return {
      success: true,
      message: `Successfully purchased ${quantity}x ${item.name}. Check your mailbox!`,
      mailId,
      itemName: item.name,
      totalCost,
      newBalance,
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
