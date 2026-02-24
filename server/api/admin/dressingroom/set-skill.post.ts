/**
 * POST /api/admin/dressingroom/set-skill
 * Set a general skill level (weapon skills, defense, etc.) for a character
 * GM only
 *
 * Body: { guid: number, realmId: string, skillId: number, value: number }
 *
 * Uses web_skill_requests Eluna queue when enabled.
 * Max value for weapon/defense skills is 5 * character level (400 at level 80).
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { getElunaConfig } from '#server/utils/config'
import { verifyCharacterOwnership } from '#server/utils/dressingroom'

const GENERAL_SKILLS: Record<number, string> = {
  // Weapon skills
  43: 'Swords',
  44: 'Axes',
  45: 'Bows',
  46: 'Guns',
  54: 'Maces',
  55: 'Two-Handed Swords',
  136: 'Staves',
  160: 'Two-Handed Maces',
  162: 'Unarmed',
  172: 'Two-Handed Axes',
  173: 'Daggers',
  176: 'Thrown',
  226: 'Crossbows',
  228: 'Wands',
  229: 'Polearms',
  473: 'Fist Weapons',
  // Defense
  95: 'Defense',
}

export default defineEventHandler(async (event) => {
  try {
    const { id: userId, username, ownAccountOnly } = await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

    const body = await readBody(event)
    const { guid, realmId, skillId, value } = body as {
      guid: number
      realmId: string
      skillId: number
      value: number
    }

    if (!guid || typeof guid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Valid character GUID is required' })
    }
    if (!realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }
    if (!skillId || !GENERAL_SKILLS[skillId]) {
      throw createError({
        statusCode: 400,
        statusMessage: `Invalid skill ID. Valid: ${Object.entries(GENERAL_SKILLS).map(([id, name]) => `${id} (${name})`).join(', ')}`,
      })
    }
    if (value === undefined || typeof value !== 'number' || value < 0 || value > 400) {
      throw createError({ statusCode: 400, statusMessage: 'Skill value must be between 0 and 400' })
    }

    const pool = await getCharactersDbPool(realmId)

    // Verify character exists and get level for max skill cap
    const [chars] = await pool.query(
      'SELECT guid, name, account, level FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )
    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    if (ownAccountOnly) verifyCharacterOwnership(userId, (chars as any[])[0].account)

    const charName = (chars as any[])[0].name
    const charLevel = (chars as any[])[0].level || 80
    const skillName = GENERAL_SKILLS[skillId]

    // Max weapon/defense skill = 5 * level
    const maxSkillValue = charLevel * 5
    const clampedValue = Math.min(value, maxSkillValue)

    const elunaConfig = getElunaConfig()

    if (elunaConfig.enabled) {
      // Queue via web_skill_requests (same table used by professions)
      // For weapon/defense skills: value = current, max = same as value (no tier system)
      await pool.query(
        `INSERT INTO web_skill_requests (character_guid, skill_id, skill_value, skill_max, reason, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`,
        [guid, skillId, clampedValue, maxSkillValue, `GM DressingRoom: ${username} set ${skillName} to ${clampedValue}/${maxSkillValue}`]
      )

      console.log(`[DressingRoom] GM ${username} queued ${skillName} skill for ${charName} (${guid}): ${clampedValue}/${maxSkillValue}`)

      return {
        success: true,
        message: `Queued ${skillName} skill update for ${charName}: ${clampedValue}/${maxSkillValue} (will apply shortly)`,
        method: 'eluna',
      }
    } else {
      // Direct DB update
      const [existing] = await pool.query(
        'SELECT skill, value, max FROM character_skills WHERE guid = ? AND skill = ?',
        [guid, skillId]
      )

      if ((existing as any[]).length > 0) {
        await pool.query(
          'UPDATE character_skills SET value = ?, max = ? WHERE guid = ? AND skill = ?',
          [clampedValue, maxSkillValue, guid, skillId]
        )
      } else {
        await pool.query(
          'INSERT INTO character_skills (guid, skill, value, max) VALUES (?, ?, ?, ?)',
          [guid, skillId, clampedValue, maxSkillValue]
        )
      }

      console.log(`[DressingRoom] GM ${username} set ${skillName} to ${clampedValue}/${maxSkillValue} for ${charName} (${guid})`)

      return {
        success: true,
        message: `Set ${charName}'s ${skillName} to ${clampedValue}/${maxSkillValue}`,
        method: 'direct',
      }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[DressingRoom] Error setting skill:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to set skill' })
  }
})
