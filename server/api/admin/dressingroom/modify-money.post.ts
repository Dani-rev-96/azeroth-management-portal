/**
 * POST /api/admin/dressingroom/modify-money
 * Set, add, or remove a character's gold
 * GM only
 *
 * Body: { guid: number, realmId: string, money: number, mode?: 'set' | 'add' | 'remove' }
 * Money is in copper (1 gold = 10000 copper)
 * - mode 'set' (default): set money to exact value
 * - mode 'add': add amount to current money (capped at gold cap)
 * - mode 'remove': subtract amount from current money (floor at 0)
 *
 * Uses web_money_requests Eluna queue when enabled to avoid
 * server memory cache conflicts with online players.
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { getElunaConfig } from '#server/utils/config'
import { verifyCharacterOwnership } from '#server/utils/dressingroom'

const MAX_MONEY = 2147483647 // Gold cap: 214748g 36s 47c

export default defineEventHandler(async (event) => {
  try {
    const { id: userId, username, ownAccountOnly } = await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

    const body = await readBody(event)
    const { guid, realmId, money, mode = 'set' } = body as {
      guid: number
      realmId: string
      money: number
      mode?: 'set' | 'add' | 'remove'
    }

    if (!guid || typeof guid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Valid character GUID is required' })
    }
    if (!realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }
    if (money === undefined || typeof money !== 'number' || money < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Money must be a non-negative number (in copper)' })
    }
    if (!['set', 'add', 'remove'].includes(mode)) {
      throw createError({ statusCode: 400, statusMessage: 'Mode must be set, add, or remove' })
    }

    const pool = await getCharactersDbPool(realmId)

    // Verify character exists and get current money
    const [chars] = await pool.query(
      'SELECT guid, name, money, account FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )

    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    if (ownAccountOnly) verifyCharacterOwnership(userId, (chars as any[])[0].account)

    const oldMoney = Number((chars as any[])[0].money)
    const charName = (chars as any[])[0].name

    // Compute final money based on mode
    let finalMoney: number
    if (mode === 'add') {
      finalMoney = Math.min(oldMoney + money, MAX_MONEY)
    } else if (mode === 'remove') {
      finalMoney = Math.max(oldMoney - money, 0)
    } else {
      finalMoney = Math.min(money, MAX_MONEY)
    }

    const deltaMoney = finalMoney - oldMoney
    const modeLabel = mode === 'add' ? 'added' : mode === 'remove' ? 'removed' : 'set'

    const elunaConfig = getElunaConfig()

    if (elunaConfig.enabled) {
      // Queue via web_money_requests for Eluna processing
      // Eluna handles online (player:ModifyMoney) vs offline (DB update) correctly
      await pool.query(
        `INSERT INTO web_money_requests (character_guid, delta_copper, reason, status)
         VALUES (?, ?, ?, 'pending')`,
        [guid, deltaMoney, `GM DressingRoom: ${username} ${modeLabel} money → ${finalMoney} copper`]
      )

      console.log(`[DressingRoom] GM ${username} ${modeLabel} money for ${charName} (${guid}): ${oldMoney} → ${finalMoney} copper (delta: ${deltaMoney})`)

      return {
        success: true,
        message: `Queued ${charName}'s gold change to ${formatMoney(finalMoney)} (will apply shortly)`,
        oldMoney,
        newMoney: finalMoney,
        method: 'eluna',
      }
    } else {
      // Direct DB update (only safe for offline characters)
      await pool.query('UPDATE characters SET money = ? WHERE guid = ?', [finalMoney, guid])

      console.log(`[DressingRoom] GM ${username} ${modeLabel} money for ${charName} (${guid}): ${oldMoney} → ${finalMoney} copper`)

      return {
        success: true,
        message: `${mode === 'add' ? 'Added' : mode === 'remove' ? 'Removed' : 'Set'} ${charName}'s gold ${mode === 'set' ? 'to' : mode === 'add' ? '(now' : '(now'} ${formatMoney(finalMoney)}${mode !== 'set' ? ')' : ''}`,
        oldMoney,
        newMoney: finalMoney,
        method: 'direct',
      }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[DressingRoom] Error modifying money:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to modify money' })
  }
})

function formatMoney(copper: number): string {
  const gold = Math.floor(copper / 10000)
  const silver = Math.floor((copper % 10000) / 100)
  const c = copper % 100
  const parts: string[] = []
  if (gold > 0) parts.push(`${gold}g`)
  if (silver > 0) parts.push(`${silver}s`)
  if (c > 0 || parts.length === 0) parts.push(`${c}c`)
  return parts.join(' ')
}
