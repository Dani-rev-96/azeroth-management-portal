/**
 * POST /api/characters/learn-mount
 * Teach a character the Old World Flying mount spell (ID 31700)
 *
 * This spell grants a GM flying mount that allows flying in old world zones
 * (Kalimdor/Eastern Kingdoms) by giving the player the fly aura.
 *
 * Requirements:
 * - Character must be level 60+
 * - Character must be online (spell learning requires a live player)
 * - User must own the character
 * - Eluna must be enabled (uses web_spell_requests queue)
 *
 * Delivery is handled by the Eluna web_worker.lua script which uses
 * Player:LearnSpell() when the player is online, or queues for next login.
 */

import type { RowDataPacket } from 'mysql2/promise'

const OLD_WORLD_FLYING_SPELL_ID = 31700
const REQUIRED_LEVEL = 60

interface LearnMountRequest {
  characterGuid: number
  realmId: string
}

interface LearnMountResponse {
  success: boolean
  message: string
  alreadyKnown?: boolean
}

export default defineEventHandler(async (event): Promise<LearnMountResponse> => {
  try {
    // Check if Eluna is enabled (required for spell queue processing)
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

    const body = await readBody<LearnMountRequest>(event)
    const { characterGuid, realmId } = body

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

    const { getCharactersDbPool } = await import('#server/utils/mysql')
    const charPool = await getCharactersDbPool(realmId)

    // Get character and verify ownership + level + online status
    const [charRows] = await charPool.query<RowDataPacket[]>(
      'SELECT guid, name, account, level, online FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [characterGuid]
    )

    if (charRows.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Character not found',
      })
    }

    const character = charRows[0]!

    // Check if user is a GM (GMs can teach the spell to any character)
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

    // Server-side level check
    if (character.level < REQUIRED_LEVEL) {
      throw createError({
        statusCode: 400,
        statusMessage: `Character must be level ${REQUIRED_LEVEL} or higher. Current level: ${character.level}.`,
      })
    }

    // Check if character is online
    const isOnline = character.online === 1

    if (!isOnline) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Character must be online to learn this spell. Please log in to the game first.',
      })
    }

    // Check if there's already a pending/waiting spell request for this character + spell
    const [existingRequests] = await charPool.query<RowDataPacket[]>(
      `SELECT id FROM web_spell_requests
       WHERE character_guid = ? AND spell_id = ? AND status IN ('pending', 'waiting')
       LIMIT 1`,
      [characterGuid, OLD_WORLD_FLYING_SPELL_ID]
    )

    if ((existingRequests as any[]).length > 0) {
      return {
        success: true,
        message: 'Old World Flying is already being processed. It will be available shortly!',
        alreadyKnown: false,
      }
    }

    // Queue the spell learning via web_spell_requests table
    const reason = 'Old World Flying mount learned from the character panel'
    await charPool.query(
      `INSERT INTO web_spell_requests (character_guid, spell_id, reason, status)
       VALUES (?, ?, ?, 'pending')`,
      [characterGuid, OLD_WORLD_FLYING_SPELL_ID, reason]
    )

    console.log(`[Mount] ${user.username}${isGM ? ' (GM)' : ''} learned Old World Flying for ${character.name} (guid: ${characterGuid}, realm: ${realmId})`)

    return {
      success: true,
      message: `Old World Flying has been taught to ${character.name}! The spell will appear in your spellbook shortly.`,
      alreadyKnown: false,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error processing learn-mount request:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process the request',
      data: {
        detail: error instanceof Error ? error.message : 'Unknown error',
      },
    })
  }
})
