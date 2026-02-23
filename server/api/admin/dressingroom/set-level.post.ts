/**
 * POST /api/admin/dressingroom/set-level
 * Set character level directly
 * GM only
 *
 * Body: { guid: number, realmId: string, level: number }
 *
 * Uses web_level_requests Eluna queue when enabled to avoid
 * server memory cache conflicts with online players.
 */
import { getAuthenticatedGM } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { getElunaConfig } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  try {
    const { username } = await getAuthenticatedGM(event)

    const body = await readBody(event)
    const { guid, realmId, level } = body as {
      guid: number
      realmId: string
      level: number
    }

    if (!guid || typeof guid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Valid character GUID is required' })
    }
    if (!realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }
    if (!level || typeof level !== 'number' || level < 1 || level > 80) {
      throw createError({ statusCode: 400, statusMessage: 'Level must be between 1 and 80' })
    }

    const pool = await getCharactersDbPool(realmId)

    // Verify character exists
    const [chars] = await pool.query(
      'SELECT guid, name, level FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )
    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    const charName = (chars as any[])[0].name
    const oldLevel = (chars as any[])[0].level

    const elunaConfig = getElunaConfig()

    if (elunaConfig.enabled) {
      // Queue via web_level_requests for Eluna processing
      // Eluna handles online (player:SetLevel) vs offline (DB update) correctly
      await pool.query(
        `INSERT INTO web_level_requests (character_guid, level, reason, status)
         VALUES (?, ?, ?, 'pending')`,
        [guid, level, `GM DressingRoom: ${username} set level to ${level}`]
      )

      console.log(`[DressingRoom] GM ${username} queued level change for ${charName} (${guid}): ${oldLevel} → ${level}`)

      return {
        success: true,
        message: `Queued ${charName}'s level change to ${level} (will apply shortly)`,
        oldLevel,
        newLevel: level,
        method: 'eluna',
      }
    } else {
      // Direct DB update (only safe for offline characters)
      await pool.query('UPDATE characters SET level = ? WHERE guid = ?', [level, guid])

      console.log(`[DressingRoom] GM ${username} set level for ${charName} (${guid}): ${oldLevel} → ${level}`)

      return {
        success: true,
        message: `Set ${charName}'s level to ${level}`,
        oldLevel,
        newLevel: level,
        method: 'direct',
      }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[DressingRoom] Error setting level:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to set level' })
  }
})
