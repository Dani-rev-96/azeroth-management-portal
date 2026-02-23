/**
 * POST /api/admin/dressingroom/set-profession
 * Set profession skill level for a character
 * GM only
 *
 * Body: { guid: number, realmId: string, skillId: number, value: number, max: number }
 *
 * Uses web_skill_requests Eluna queue when enabled to avoid
 * server memory cache conflicts with online players.
 */
import { getAuthenticatedGM } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { getElunaConfig } from '#server/utils/config'

const PROFESSION_SKILLS: Record<number, string> = {
  164: 'Blacksmithing',
  165: 'Leatherworking',
  171: 'Alchemy',
  182: 'Herbalism',
  186: 'Mining',
  197: 'Tailoring',
  202: 'Engineering',
  333: 'Enchanting',
  393: 'Skinning',
  755: 'Jewelcrafting',
  773: 'Inscription',
  129: 'First Aid',
  185: 'Cooking',
  356: 'Fishing',
  762: 'Riding',
}

export default defineEventHandler(async (event) => {
  try {
    const { username } = await getAuthenticatedGM(event)

    const body = await readBody(event)
    const { guid, realmId, skillId, value, max } = body as {
      guid: number
      realmId: string
      skillId: number
      value: number
      max: number
    }

    if (!guid || typeof guid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Valid character GUID is required' })
    }
    if (!realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }
    if (!skillId || !PROFESSION_SKILLS[skillId]) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid profession skill ID. Valid IDs: ${Object.entries(PROFESSION_SKILLS).map(([id, name]) => `${id} (${name})`).join(', ')}`,
      })
    }
    if (value === undefined || typeof value !== 'number' || value < 0 || value > 450) {
      throw createError({ statusCode: 400, statusMessage: 'Skill value must be between 0 and 450' })
    }
    if (max === undefined || typeof max !== 'number' || max < 0 || max > 450) {
      throw createError({ statusCode: 400, statusMessage: 'Skill max must be between 0 and 450' })
    }

    const pool = await getCharactersDbPool(realmId)

    // Verify character exists
    const [chars] = await pool.query(
      'SELECT guid, name FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )
    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    const charName = (chars as any[])[0].name
    const profName = PROFESSION_SKILLS[skillId]

    const elunaConfig = getElunaConfig()

    if (elunaConfig.enabled) {
      // Queue via web_skill_requests for Eluna processing
      // Eluna handles online (player:SetSkill) vs offline (DB update) correctly
      await pool.query(
        `INSERT INTO web_skill_requests (character_guid, skill_id, skill_value, skill_max, reason, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [guid, skillId, value, max, `GM DressingRoom: ${username} set ${profName} to ${value}/${max}`]
      )

      const action = value === 0 && max === 0 ? 'removal' : 'update'
      console.log(`[DressingRoom] GM ${username} queued ${profName} ${action} for ${charName} (${guid}): ${value}/${max}`)

      return {
        success: true,
        message: `Queued ${profName} ${action} for ${charName} (will apply shortly)`,
        action: 'queued',
        method: 'eluna',
      }
    } else {
      // Direct DB update (only safe for offline characters)
      // Check if character already has this skill
      const [existing] = await pool.query(
        'SELECT skill, value, max FROM character_skills WHERE guid = ? AND skill = ?',
        [guid, skillId]
      )

      if ((existing as any[]).length > 0) {
        if (value === 0 && max === 0) {
          // Remove the profession
          await pool.query('DELETE FROM character_skills WHERE guid = ? AND skill = ?', [guid, skillId])
          console.log(`[DressingRoom] GM ${username} removed ${profName} from ${charName} (${guid})`)
          return {
            success: true,
            message: `Removed ${profName} from ${charName}`,
            action: 'removed',
            method: 'direct',
          }
        }

        // Update existing
        await pool.query(
          'UPDATE character_skills SET value = ?, max = ? WHERE guid = ? AND skill = ?',
          [value, max, guid, skillId]
        )
      } else {
        if (value === 0 && max === 0) {
          return {
            success: true,
            message: `${charName} doesn't have ${profName}`,
            action: 'none',
            method: 'direct',
          }
        }

        // Insert new skill
        await pool.query(
          'INSERT INTO character_skills (guid, skill, value, max) VALUES (?, ?, ?, ?)',
          [guid, skillId, value, max]
        )
      }

      console.log(`[DressingRoom] GM ${username} set ${profName} to ${value}/${max} for ${charName} (${guid})`)

      return {
        success: true,
        message: `Set ${charName}'s ${profName} to ${value}/${max}`,
        action: (existing as any[]).length > 0 ? 'updated' : 'added',
        skillId,
        professionName: profName,
        value,
        max,
        method: 'direct',
      }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[DressingRoom] Error setting profession:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to set profession' })
  }
})
