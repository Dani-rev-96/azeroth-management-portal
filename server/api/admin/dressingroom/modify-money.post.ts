/**
 * POST /api/admin/dressingroom/modify-money
 * Set or modify a character's gold
 * GM only
 *
 * Body: { guid: number, realmId: string, money: number }
 * Money is in copper (1 gold = 10000 copper)
 *
 * Uses web_money_requests Eluna queue when enabled to avoid
 * server memory cache conflicts with online players.
 */
import { getAuthenticatedGM } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { getElunaConfig } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  try {
    const { username } = await getAuthenticatedGM(event)

    const body = await readBody(event)
    const { guid, realmId, money } = body as {
      guid: number
      realmId: string
      money: number
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

    // Cap at gold cap (214748g 36s 47c)
    const maxMoney = 2147483647
    const finalMoney = Math.min(money, maxMoney)

    const pool = await getCharactersDbPool(realmId)

    // Verify character exists and get current money
    const [chars] = await pool.query(
      'SELECT guid, name, money FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )

    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    const oldMoney = Number((chars as any[])[0].money)
    const charName = (chars as any[])[0].name
    const deltaMoney = finalMoney - oldMoney

    const elunaConfig = getElunaConfig()

    if (elunaConfig.enabled) {
      // Queue via web_money_requests for Eluna processing
      // Eluna handles online (player:ModifyMoney) vs offline (DB update) correctly
      await pool.query(
        `INSERT INTO web_money_requests (character_guid, delta_copper, reason, status)
         VALUES (?, ?, ?, 'pending')`,
        [guid, deltaMoney, `GM DressingRoom: ${username} set money to ${finalMoney}`]
      )

      console.log(`[DressingRoom] GM ${username} queued money change for ${charName} (${guid}): ${oldMoney} → ${finalMoney} copper (delta: ${deltaMoney})`)

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

      console.log(`[DressingRoom] GM ${username} set money for ${charName} (${guid}): ${oldMoney} → ${finalMoney} copper`)

      return {
        success: true,
        message: `Set ${charName}'s gold to ${formatMoney(finalMoney)}`,
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
