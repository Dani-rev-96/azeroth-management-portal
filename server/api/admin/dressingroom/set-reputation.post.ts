/**
 * POST /api/admin/dressingroom/set-reputation
 * Set a character's reputation with a faction
 * GM only
 *
 * Body: { guid: number, realmId: string, factionId: number, standing: number }
 *
 * Uses web_reputation_requests Eluna queue when enabled to avoid
 * server memory cache conflicts with online players.
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { getElunaConfig } from '#server/utils/config'
import { verifyCharacterOwnership } from '#server/utils/dressingroom'

export default defineEventHandler(async (event) => {
  try {
    const { id: userId, username, ownAccountOnly } = await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

    const body = await readBody(event)
    const { guid, realmId, factionId, standing } = body as {
      guid: number
      realmId: string
      factionId: number
      standing: number
    }

    if (!guid || typeof guid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Valid character GUID is required' })
    }
    if (!realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }
    if (!factionId || typeof factionId !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Valid faction ID is required' })
    }
    if (standing === undefined || typeof standing !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Standing value is required' })
    }
    // Standing range: -42000 (Hated) to 42999 (Exalted max)
    if (standing < -42000 || standing > 42999) {
      throw createError({ statusCode: 400, statusMessage: 'Standing must be between -42000 and 42999' })
    }

    const pool = await getCharactersDbPool(realmId)

    // Verify character exists
    const [chars] = await pool.query(
      'SELECT guid, name, account FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )
    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    if (ownAccountOnly) verifyCharacterOwnership(userId, (chars as any[])[0].account)

    const charName = (chars as any[])[0].name
    const elunaConfig = getElunaConfig()

    if (elunaConfig.enabled) {
      // Queue via web_reputation_requests for Eluna processing
      await pool.query(
        `INSERT INTO web_reputation_requests (character_guid, faction_id, standing, reason, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [guid, factionId, standing, `GM DressingRoom: ${username} set faction ${factionId} to ${standing}`]
      )

      console.log(`[DressingRoom] GM ${username} queued reputation for ${charName} (${guid}): faction ${factionId} → ${standing}`)

      return {
        success: true,
        message: `Queued reputation change for ${charName} (will apply shortly)`,
        method: 'eluna',
      }
    } else {
      // Direct DB update — check if reputation row exists
      const [existing] = await pool.query(
        'SELECT faction, standing FROM character_reputation WHERE guid = ? AND faction = ?',
        [guid, factionId]
      )

      if ((existing as any[]).length > 0) {
        await pool.query(
          'UPDATE character_reputation SET standing = ? WHERE guid = ? AND faction = ?',
          [standing, guid, factionId]
        )
      } else {
        // Insert new reputation entry with default flags (visible = 1)
        await pool.query(
          'INSERT INTO character_reputation (guid, faction, standing, flags) VALUES (?, ?, ?, 1)',
          [guid, factionId, standing]
        )
      }

      console.log(`[DressingRoom] GM ${username} set reputation for ${charName} (${guid}): faction ${factionId} → ${standing}`)

      return {
        success: true,
        message: `Set faction ${factionId} reputation to ${standing} for ${charName}`,
        method: 'direct',
      }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[DressingRoom] Error setting reputation:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to set reputation' })
  }
})
