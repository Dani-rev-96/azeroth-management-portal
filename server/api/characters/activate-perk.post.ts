/**
 * POST /api/characters/activate-perk
 *
 * Unified perk activation endpoint. Replaces the old learn-mount and grant-item endpoints.
 * Handles all perk types (spell, item, aura) through the shared perk registry.
 *
 * Flow:
 * 1. Validate the perk ID exists and its group is enabled
 * 2. Authenticate + check ownership (or GM bypass)
 * 3. Check level requirement + online status
 * 4. Check daily usage limit
 * 5. Roll the dice
 * 6. On success: insert the appropriate web_*_requests row
 * 7. On fail/critfail: insert a web_aura_requests row (debuff)
 * 8. Record the usage attempt
 * 9. Return roll result to the frontend
 */

import type { RowDataPacket } from 'mysql2/promise'
import { getPerkById, type PerkDefinition } from '~~/shared/utils/perks'

interface ActivatePerkRequest {
  perkId: string
  characterGuid: number
  realmId: string
}

interface ActivatePerkResponse {
  success: boolean
  message: string
  roll?: number
  diceSides?: number
  threshold?: number
  outcome?: 'success' | 'fail' | 'critfail'
  usesToday?: number
  dailyLimit?: number
}

/** SQL to create the daily usage tracking table (idempotent) */
const CREATE_USAGE_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS web_perk_usage (
    id INTEGER PRIMARY KEY AUTO_INCREMENT,
    character_guid INT NOT NULL,
    perk_id VARCHAR(64) NOT NULL,
    used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    outcome VARCHAR(16) NOT NULL DEFAULT 'success',
    roll INT NOT NULL DEFAULT 0,
    INDEX idx_perk_usage_lookup (character_guid, perk_id, used_at)
  )
`

/** Count how many times a character has used a perk today (UTC day boundary) */
async function getUsesToday(charPool: any, characterGuid: number, perkId: string): Promise<number> {
  const [rows] = await charPool.query(
    `SELECT COUNT(*) AS cnt FROM web_perk_usage
     WHERE character_guid = ? AND perk_id = ? AND DATE(used_at) = CURDATE() AND outcome = 'success'`,
    [characterGuid, perkId],
  )
  return (rows as any[])?.[0]?.cnt ?? 0
}

/** Record a usage attempt */
async function recordUsage(charPool: any, characterGuid: number, perkId: string, outcome: string, roll: number): Promise<void> {
  await charPool.query(
    `INSERT INTO web_perk_usage (character_guid, perk_id, outcome, roll) VALUES (?, ?, ?, ?)`,
    [characterGuid, perkId, outcome, roll],
  )
}

/** Insert the correct delivery row based on perk type */
async function deliverPerk(charPool: any, characterGuid: number, perk: PerkDefinition): Promise<void> {
  switch (perk.deliveryType) {
    case 'spell':
      await charPool.query(
        `INSERT INTO web_spell_requests (character_guid, spell_id, reason, status)
         VALUES (?, ?, ?, 'pending')`,
        [characterGuid, perk.gameId, `Perk: ${perk.name}`],
      )
      break

    case 'item':
      await charPool.query(
        `INSERT INTO web_item_requests (character_guid, item_entry, item_count, mail_subject, mail_body, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [
          characterGuid,
          perk.gameId,
          perk.itemCount ?? 1,
          perk.mailSubject ?? perk.name,
          perk.mailBody ?? `You have received: ${perk.name}`,
        ],
      )
      break

    case 'bag-item':
      await charPool.query(
        `INSERT INTO web_bag_requests (character_guid, item_entry, item_count, reason, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [
          characterGuid,
          perk.gameId,
          perk.itemCount ?? 1,
          `Perk: ${perk.name}`,
        ],
      )
      break

    case 'aura':
      await charPool.query(
        `INSERT INTO web_aura_requests (character_guid, spell_id, duration_ms, stacks, reason, status)
         VALUES (?, ?, ?, 1, ?, 'pending')`,
        [characterGuid, perk.gameId, perk.auraDurationMs ?? 0, `Perk: ${perk.name}`],
      )
      break

    case 'teleport':
      await charPool.query(
        `INSERT INTO web_teleport_requests (character_guid, map_id, x, y, z, o, reason, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          characterGuid,
          perk.teleportMapId ?? 0,
          perk.teleportX ?? 0,
          perk.teleportY ?? 0,
          perk.teleportZ ?? 0,
          perk.teleportO ?? 0,
          `Perk: ${perk.name}`,
        ],
      )
      break
  }
}

/** Apply a debuff (fail or crit-fail) */
async function applyDebuff(charPool: any, characterGuid: number, spellId: number, durationMs: number, reason: string): Promise<void> {
  await charPool.query(
    `INSERT INTO web_aura_requests (character_guid, spell_id, duration_ms, stacks, reason, status)
     VALUES (?, ?, ?, 1, ?, 'pending')`,
    [characterGuid, spellId, durationMs, reason],
  )
}

export default defineEventHandler(async (event): Promise<ActivatePerkResponse> => {
  try {
    // ── Eluna check ──
    const { getElunaConfigAsync, getPerkConfigAsync, getPerkRegistryAsync } = await import('#server/utils/config')
    const elunaConfig = await getElunaConfigAsync()
    if (!elunaConfig.enabled) {
      throw createError({ statusCode: 503, statusMessage: 'This feature requires Eluna to be enabled on the server.' })
    }

    // ── Parse & validate request ──
    const body = await readBody<ActivatePerkRequest>(event)
    const { perkId, characterGuid, realmId } = body

    if (!perkId || typeof perkId !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Perk ID is required.' })
    }
    if (!characterGuid || typeof characterGuid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Character GUID is required.' })
    }
    if (!realmId || typeof realmId !== 'string') {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required.' })
    }

    // ── Look up perk from registry ──
    const perkRegistry = await getPerkRegistryAsync()
    const perk = perkRegistry.find(p => p.id === perkId)
    if (!perk) {
      throw createError({ statusCode: 400, statusMessage: `Unknown perk: ${perkId}` })
    }

    // ── Check perk group is enabled ──
    const perkConfig = await getPerkConfigAsync()
    if (!perkConfig.groups[perk.group]?.enabled) {
      throw createError({ statusCode: 403, statusMessage: `The ${perk.group} perk group is currently disabled.` })
    }

    // ── Resolve per-perk config (env overrides over registry defaults) ──
    const resolved = perkConfig.perks[perk.id]
    if (!resolved) {
      throw createError({ statusCode: 500, statusMessage: 'Failed to resolve perk configuration.' })
    }

    // ── Authenticate ──
    const { getAuthenticatedUser } = await import('#server/utils/auth')
    const user = await getAuthenticatedUser(event)

    // ── Get character ──
    const { getCharactersDbPool } = await import('#server/utils/mysql')
    const charPool = await getCharactersDbPool(realmId)

    const [charRows] = await charPool.query<RowDataPacket[]>(
      'SELECT guid, name, account, level, online FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [characterGuid],
    )
    if (charRows.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found.' })
    }
    const character = charRows[0]!

    // ── GM check + ownership ──
    const { getAuthenticatedGM, isDirectAuthMode, getDirectAuthSession } = await import('#server/utils/auth')
    let isGM = false
    try {
      await getAuthenticatedGM(event)
      isGM = true
    } catch { /* not a GM */ }

    if (!isGM) {
      let linkedAccountIds: number[]
      if (isDirectAuthMode()) {
        const session = await getDirectAuthSession(event)
        if (!session) {
          throw createError({ statusCode: 401, statusMessage: 'Not authenticated.' })
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
        throw createError({ statusCode: 403, statusMessage: 'You do not own this character.' })
      }
    }

    // ── Level check ──
    if (resolved.requiredLevel > 0 && character.level < resolved.requiredLevel) {
      throw createError({
        statusCode: 400,
        statusMessage: `Character must be level ${resolved.requiredLevel} or higher. Current level: ${character.level}.`,
      })
    }

    // ── Online check ──
    if (perk.requiresOnline && character.online !== 1) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Character must be online to attempt this perk. The dice gods demand your presence!',
      })
    }

    // ── Ensure usage tracking table exists ──
    await charPool.query(CREATE_USAGE_TABLE_SQL)

    // ── Daily limit check ──
    const usesToday = await getUsesToday(charPool, characterGuid, perkId)
    if (resolved.dailyLimit > 0 && usesToday >= resolved.dailyLimit) {
      throw createError({
        statusCode: 429,
        statusMessage: `Daily limit reached! You've used ${perk.name} ${usesToday}/${resolved.dailyLimit} times today. Try again tomorrow.`,
      })
    }

    // ── One-time perk: check for existing pending/completed ──
    if (perk.oneTime) {
      if (perk.deliveryType === 'spell') {
        const [existing] = await charPool.query<RowDataPacket[]>(
          `SELECT id FROM web_spell_requests WHERE character_guid = ? AND spell_id = ? AND status IN ('pending', 'waiting') LIMIT 1`,
          [characterGuid, perk.gameId],
        )
        if ((existing as any[]).length > 0) {
          return { success: true, message: `${perk.name} is already being processed!`, usesToday, dailyLimit: resolved.dailyLimit }
        }
      } else if (perk.deliveryType === 'item') {
        const [existing] = await charPool.query<RowDataPacket[]>(
          `SELECT id FROM web_item_requests WHERE character_guid = ? AND item_entry = ? AND status = 'pending' LIMIT 1`,
          [characterGuid, perk.gameId],
        )
        if ((existing as any[]).length > 0) {
          return { success: true, message: `${perk.name} is already being delivered! Check your mailbox.`, usesToday, dailyLimit: resolved.dailyLimit }
        }
      }
    }

    // ── DICE ROLL ──
    const { diceSides, rollThreshold: threshold } = resolved
    const roll = Math.floor(Math.random() * diceSides) + 1

    console.log(`[Perk] ${user.username}${isGM ? ' (GM)' : ''} rolled ${roll}/${diceSides} (need ≥${threshold}) for "${perk.name}" on ${character.name} (guid: ${characterGuid}, realm: ${realmId})`)

    // ── CRITICAL FAIL (rolled 1) ──
    if (roll === 1) {
      const critDebuffSpell = perk.critFailDebuffSpellId ?? perkConfig.critFailDebuffSpellId
      const critDebuffDuration = perk.critFailDebuffDurationMs ?? perkConfig.critFailDebuffDurationMs

      await applyDebuff(
        charPool,
        characterGuid,
        critDebuffSpell,
        critDebuffDuration,
        `Critical fail! Rolled 1 on d${diceSides} for ${perk.name}.`,
      )

      return {
        success: false,
        message: `💀 Critical Fail! You rolled a 1 on d${diceSides}. The dark forces punish your hubris — Resurrection Sickness has been applied!`,
        roll,
        diceSides,
        threshold,
        outcome: 'critfail',
        usesToday,
        dailyLimit: resolved.dailyLimit,
      }
    }

    // ── NORMAL FAIL (below threshold) ──
    if (roll < threshold) {
      const failDebuffSpell = perk.failDebuffSpellId ?? perkConfig.failDebuffSpellId
      const failDebuffDuration = perk.failDebuffDurationMs ?? perkConfig.failDebuffDurationMs

      await applyDebuff(
        charPool,
        characterGuid,
        failDebuffSpell,
        failDebuffDuration,
        `Rolled ${roll} on d${diceSides} (needed ${threshold}+) for ${perk.name}. Better luck next time.`,
      )

      return {
        success: false,
        message: `🎲 You rolled ${roll} on d${diceSides} — needed ${threshold} or higher. A debuff has been applied as consolation. Try again!`,
        roll,
        diceSides,
        threshold,
        outcome: 'fail',
        usesToday,
        dailyLimit: resolved.dailyLimit,
      }
    }

    // ── SUCCESS ──
    await deliverPerk(charPool, characterGuid, perk)
    await recordUsage(charPool, characterGuid, perkId, 'success', roll)
    const newUsesToday = usesToday + 1

    return {
      success: true,
      message: `🎉 You rolled ${roll} on d${diceSides} — success! ${perk.successMessage}`,
      roll,
      diceSides,
      threshold,
      outcome: 'success',
      usesToday: newUsesToday,
      dailyLimit: resolved.dailyLimit,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('Error processing activate-perk request:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to process the perk activation.',
      data: { detail: error instanceof Error ? error.message : 'Unknown error' },
    })
  }
})
