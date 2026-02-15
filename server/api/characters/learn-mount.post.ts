/**
 * POST /api/characters/learn-mount
 * Attempt to teach a character the Old World Flying mount spell (ID 31700) via dice roll.
 *
 * Gambling mechanic:
 * - A dice is rolled (configurable sides)
 * - If the roll meets/exceeds the threshold → SUCCESS: spell is queued
 * - If the roll is below the threshold (but not 1) → FAIL: debuff applied
 * - If the roll is exactly 1 → CRITICAL FAIL: worse debuff applied
 *
 * Requirements:
 * - Character must be level 60+ (configurable via NUXT_PERK_FLYING_REQUIRED_LEVEL)
 * - Character must be online
 * - User must own the character (or be a GM)
 * - Eluna must be enabled
 */

import type { RowDataPacket } from 'mysql2/promise'

const OLD_WORLD_FLYING_SPELL_ID = 31700

interface LearnMountRequest {
  characterGuid: number
  realmId: string
}

interface LearnMountResponse {
  success: boolean
  message: string
  roll?: number
  diceSides?: number
  threshold?: number
  outcome?: 'success' | 'fail' | 'critfail'
  alreadyKnown?: boolean
}

export default defineEventHandler(async (event): Promise<LearnMountResponse> => {
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

    const perkConfig = getPerkConfig()

    // Authenticate user
    const { getAuthenticatedUser } = await import('#server/utils/auth')
    const user = await getAuthenticatedUser(event)

    const body = await readBody<LearnMountRequest>(event)
    const { characterGuid, realmId } = body

    // Validation
    if (!characterGuid || typeof characterGuid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Character GUID is required' })
    }
    if (!realmId || typeof realmId !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }

    const { getCharactersDbPool } = await import('#server/utils/mysql')
    const charPool = await getCharactersDbPool(realmId)

    // Get character
    const [charRows] = await charPool.query<RowDataPacket[]>(
      'SELECT guid, name, account, level, online FROM characters WHERE guid = ? AND deleteDate IS NULL',
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

    // Server-side level check (configurable)
    if (character.level < perkConfig.flyingRequiredLevel) {
      throw createError({
        statusCode: 400,
        statusMessage: `Character must be level ${perkConfig.flyingRequiredLevel} or higher. Current level: ${character.level}.`,
      })
    }

    // Must be online
    if (character.online !== 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Character must be online to attempt this perk. The dice gods demand your presence!',
      })
    }

    // Check for existing pending/waiting spell request
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

    // ─── DICE ROLL ───────────────────────────────────────
    const diceSides = perkConfig.flyingDiceSides
    const threshold = perkConfig.flyingRollThreshold
    const roll = Math.floor(Math.random() * diceSides) + 1

    console.log(`[Mount] ${user.username}${isGM ? ' (GM)' : ''} rolled ${roll}/${diceSides} (need ≥${threshold}) for Old World Flying on ${character.name} (guid: ${characterGuid}, realm: ${realmId})`)

    // ─── CRITICAL FAIL (rolled 1) ────────────────────────
    if (roll === 1) {
      await charPool.query(
        `INSERT INTO web_aura_requests (character_guid, spell_id, duration_ms, stacks, reason, status)
         VALUES (?, ?, ?, 1, ?, 'pending')`,
        [
          characterGuid,
          perkConfig.critFailDebuffSpellId,
          perkConfig.critFailDebuffDurationMs,
          `Critical fail! You rolled a 1 on d${diceSides} while reaching for Old World Flying. The wind spirits are displeased.`,
        ]
      )

      return {
        success: false,
        message: `💀 Critical Fail! You rolled a 1 on d${diceSides}. The wind spirits are furious — Resurrection Sickness has been applied!`,
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
          `You rolled ${roll} on d${diceSides} (needed ${threshold}+) for Old World Flying. The wind spirits ignore your plea.`,
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

    // ─── SUCCESS ─────────────────────────────────────────
    const reason = 'Old World Flying mount learned from the character panel'
    await charPool.query(
      `INSERT INTO web_spell_requests (character_guid, spell_id, reason, status)
       VALUES (?, ?, ?, 'pending')`,
      [characterGuid, OLD_WORLD_FLYING_SPELL_ID, reason]
    )

    return {
      success: true,
      message: `🎉 You rolled ${roll} on d${diceSides} — success! Old World Flying has been taught to ${character.name}!`,
      roll,
      diceSides,
      threshold,
      outcome: 'success',
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
