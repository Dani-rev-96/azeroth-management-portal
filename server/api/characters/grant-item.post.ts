/**
 * POST /api/characters/grant-item
 * Attempt to obtain a perk item for a character via a dice roll.
 *
 * Gambling mechanic:
 * - A dice is rolled (configurable sides per perk)
 * - If the roll meets/exceeds the threshold → SUCCESS: item is mailed
 * - If the roll is below the threshold (but not 1) → FAIL: debuff applied
 * - If the roll is exactly 1 → CRITICAL FAIL: worse debuff applied
 *
 * Currently supports:
 * - Drakefire Amulet (16309) — Onyxia's Lair attunement item
 *
 * Uses web_item_requests (mail) for item delivery and web_aura_requests for debuffs.
 * Both work for online characters; debuffs queue as 'waiting' if offline.
 *
 * Requirements:
 * - User must own the character (or be a GM)
 * - Eluna must be enabled
 * - Item must be in the allowed items list
 * - Character must be online (for debuff risk to be meaningful)
 */

import type { RowDataPacket } from 'mysql2/promise'

/**
 * Allowed perk items — only items in this map can be granted.
 * Each item references a perkKey used to look up its roll config.
 */
const ALLOWED_ITEMS: Record<number, { name: string; perkKey: string; mailSubject: string; mailBody: string }> = {
  16309: {
    name: 'Drakefire Amulet',
    perkKey: 'drakefire',
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
  roll?: number
  diceSides?: number
  threshold?: number
  outcome?: 'success' | 'fail' | 'critfail'
  alreadyPending?: boolean
}

export default defineEventHandler(async (event): Promise<GrantItemResponse> => {
  try {
    // Check if Eluna is enabled
    const { getElunaConfig, getPerkConfig } = await import('#server/utils/config')
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
      throw createError({ statusCode: 400, statusMessage: 'Character GUID is required' })
    }
    if (!realmId || typeof realmId !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }
    if (!itemId || typeof itemId !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Item ID is required' })
    }

    // Verify item is in the allowed list
    const allowedItem = ALLOWED_ITEMS[itemId]
    if (!allowedItem) {
      throw createError({ statusCode: 400, statusMessage: 'This item cannot be granted as a perk.' })
    }

    const { getCharactersDbPool } = await import('#server/utils/mysql')
    const charPool = await getCharactersDbPool(realmId)

    // Get character and verify
    const [charRows] = await charPool.query<RowDataPacket[]>(
      'SELECT guid, name, account, online FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [characterGuid]
    )

    if (charRows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    const character = charRows[0]!

    // GM check + ownership
    const { getAuthenticatedGM, isDirectAuthMode, getDirectAuthSession } = await import('#server/utils/auth')
    let isGM = false
    try {
      await getAuthenticatedGM(event)
      isGM = true
    } catch {
      // Not a GM
    }

    if (!isGM) {
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
        throw createError({ statusCode: 403, statusMessage: 'You do not own this character' })
      }
    }

    // Character must be online (debuffs require an online player)
    if (character.online !== 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Character must be online to attempt this perk. The dice gods demand your presence!',
      })
    }

    // Check for already-pending item requests
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

    // ─── DICE ROLL ───────────────────────────────────────
    const perkConfig = getPerkConfig()

    // Get perk-specific roll config
    let diceSides: number
    let threshold: number

    switch (allowedItem.perkKey) {
      case 'drakefire':
        diceSides = perkConfig.drakefireDiceSides
        threshold = perkConfig.drakefireRollThreshold
        break
      default:
        diceSides = 20
        threshold = 10
    }

    // Roll the dice (1 to diceSides inclusive)
    const roll = Math.floor(Math.random() * diceSides) + 1

    console.log(`[Perk] ${user.username}${isGM ? ' (GM)' : ''} rolled ${roll}/${diceSides} (need ≥${threshold}) for ${allowedItem.name} on ${character.name} (guid: ${characterGuid}, realm: ${realmId})`)

    // ─── CRITICAL FAIL (rolled 1) ────────────────────────
    if (roll === 1) {
      await charPool.query(
        `INSERT INTO web_aura_requests (character_guid, spell_id, duration_ms, stacks, reason, status)
         VALUES (?, ?, ?, 1, ?, 'pending')`,
        [
          characterGuid,
          perkConfig.critFailDebuffSpellId,
          perkConfig.critFailDebuffDurationMs,
          `Critical fail! You rolled a 1 on d${diceSides} while reaching for the ${allowedItem.name}. The dark forces punish your hubris.`,
        ]
      )

      return {
        success: false,
        message: `💀 Critical Fail! You rolled a 1 on d${diceSides}. The dark forces punish your hubris — Resurrection Sickness has been applied!`,
        roll,
        diceSides,
        threshold,
        outcome: 'critfail',
      }
    }

    // ─── NORMAL FAIL (below threshold) ───────────────────
    if (roll < threshold) {
      await charPool.query(
        `INSERT INTO web_aura_requests (character_guid, spell_id, duration_ms, stacks, reason, status)
         VALUES (?, ?, ?, 1, ?, 'pending')`,
        [
          characterGuid,
          perkConfig.failDebuffSpellId,
          perkConfig.failDebuffDurationMs,
          `You rolled ${roll} on d${diceSides} (needed ${threshold}+) for ${allowedItem.name}. Better luck next time.`,
        ]
      )

      return {
        success: false,
        message: `🎲 You rolled ${roll} on d${diceSides} — needed ${threshold} or higher. A debuff has been applied as consolation. Try again later!`,
        roll,
        diceSides,
        threshold,
        outcome: 'fail',
      }
    }

    // ─── SUCCESS (met or exceeded threshold) ─────────────
    await charPool.query(
      `INSERT INTO web_item_requests (character_guid, item_entry, item_count, mail_subject, mail_body, status)
       VALUES (?, ?, 1, ?, ?, 'pending')`,
      [characterGuid, itemId, allowedItem.mailSubject, allowedItem.mailBody]
    )

    return {
      success: true,
      message: `🎉 You rolled ${roll} on d${diceSides} — success! ${allowedItem.name} has been sent to ${character.name}! Check your in-game mailbox.`,
      roll,
      diceSides,
      threshold,
      outcome: 'success',
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
