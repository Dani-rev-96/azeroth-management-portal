/**
 * POST /api/characters/grant-item
 * Grant a specific perk item to a character via in-game mail
 *
 * Currently supports:
 * - Drakefire Amulet (16309) — Onyxia's Lair attunement item
 *
 * Uses the web_item_requests queue (mail delivery), which works for both
 * online and offline characters — Eluna processes the queue and sends mail.
 *
 * Requirements:
 * - User must own the character (or be a GM)
 * - Eluna must be enabled
 * - Item must be in the allowed items list
 */

import type { RowDataPacket } from 'mysql2/promise'

/**
 * Allowed perk items — only items in this map can be granted.
 * Add new grantable items here.
 */
const ALLOWED_ITEMS: Record<number, { name: string; mailSubject: string; mailBody: string }> = {
  16309: {
    name: 'Drakefire Amulet',
    mailSubject: 'Drakefire Amulet',
    mailBody: 'The power of the Drakefire Amulet has been bestowed upon you. Use it wisely, hero.',
  },
}

interface GrantItemRequest {
  characterGuid: number
  realmId: string
  itemId: number
}

interface GrantItemResponse {
  success: boolean
  message: string
  alreadyPending?: boolean
}

export default defineEventHandler(async (event): Promise<GrantItemResponse> => {
  try {
    // Check if Eluna is enabled (required for item queue processing)
    const { getElunaConfig } = await import('#server/utils/config')
    const elunaConfig = getElunaConfig()

    if (!elunaConfig.enabled) {
      throw createError({
        statusCode: 503,
        statusMessage: 'This feature requires Eluna to be enabled on the server.',
      })
    }

    // Authenticate user
    const { getAuthenticatedUser } = await import('#server/utils/auth')
    const user = await getAuthenticatedUser(event)

    const body = await readBody<GrantItemRequest>(event)
    const { characterGuid, realmId, itemId } = body

    // Validation
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

    if (!itemId || typeof itemId !== 'number') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Item ID is required',
      })
    }

    // Verify item is in the allowed list
    const allowedItem = ALLOWED_ITEMS[itemId]
    if (!allowedItem) {
      throw createError({
        statusCode: 400,
        statusMessage: 'This item cannot be granted as a perk.',
      })
    }

    const { getCharactersDbPool } = await import('#server/utils/mysql')
    const charPool = await getCharactersDbPool(realmId)

    // Get character and verify ownership
    const [charRows] = await charPool.query<RowDataPacket[]>(
      'SELECT guid, name, account FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [characterGuid]
    )

    if (charRows.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Character not found',
      })
    }

    const character = charRows[0]!

    // Check if user is a GM (GMs can grant items to any character)
    const { getAuthenticatedGM, isDirectAuthMode, getDirectAuthSession } = await import('#server/utils/auth')
    let isGM = false
    try {
      await getAuthenticatedGM(event)
      isGM = true
    } catch {
      // Not a GM, continue with ownership check
    }

    // Verify the user owns this character's account (skip for GMs)
    if (!isGM) {
      let linkedAccountIds: number[]

      if (isDirectAuthMode()) {
        const session = await getDirectAuthSession(event)
        if (!session) {
          throw createError({
            statusCode: 401,
            statusMessage: 'Not authenticated',
          })
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
    }

    // Check if there's already a pending item request for this character + item
    const [existingRequests] = await charPool.query<RowDataPacket[]>(
      `SELECT id FROM web_item_requests
       WHERE character_guid = ? AND item_entry = ? AND status = 'pending'
       LIMIT 1`,
      [characterGuid, itemId]
    )

    if ((existingRequests as any[]).length > 0) {
      return {
        success: true,
        message: `${allowedItem.name} is already being delivered. Check your in-game mailbox!`,
        alreadyPending: true,
      }
    }

    // Queue the item delivery via web_item_requests table (mail delivery)
    await charPool.query(
      `INSERT INTO web_item_requests (character_guid, item_entry, item_count, mail_subject, mail_body, status)
       VALUES (?, ?, 1, ?, ?, 'pending')`,
      [characterGuid, itemId, allowedItem.mailSubject, allowedItem.mailBody]
    )

    console.log(`[Perk] ${user.username}${isGM ? ' (GM)' : ''} granted ${allowedItem.name} to ${character.name} (guid: ${characterGuid}, realm: ${realmId})`)

    return {
      success: true,
      message: `${allowedItem.name} has been sent to ${character.name}! Check your in-game mailbox.`,
      alreadyPending: false,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error processing grant-item request:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process the request',
      data: {
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
})
