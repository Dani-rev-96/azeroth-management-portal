/**
 * POST /api/admin/dressingroom/set-profession
 * Set profession skill level for a character
 * GM only
 *
 * Body: { guid: number, realmId: string, skillId: number, value: number, max: number }
 *
 * Uses web_skill_requests Eluna queue when enabled to avoid
 * server memory cache conflicts with online players.
 *
 * Also teaches necessary profession training spells so the skill
 * level displays correctly in the spellbook.
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { getElunaConfig } from '#server/utils/config'
import { verifyCharacterOwnership } from '#server/utils/dressingroom'

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

/**
 * Profession training spell IDs by tier (WoW 3.3.5a WotLK).
 * Each tier corresponds to a max skill level:
 *   Apprentice (75), Journeyman (150), Expert (225),
 *   Artisan (300), Master (375), Grand Master (450)
 *
 * These spells must be in character_spell for the profession
 * to display the correct rank in the spellbook.
 */
const PROFESSION_TRAINING_SPELLS: Record<number, { maxThreshold: number; spellId: number }[]> = {
  // Alchemy
  171: [
    { maxThreshold: 75, spellId: 2259 },   // Apprentice
    { maxThreshold: 150, spellId: 3101 },   // Journeyman
    { maxThreshold: 225, spellId: 3464 },   // Expert
    { maxThreshold: 300, spellId: 11611 },  // Artisan
    { maxThreshold: 375, spellId: 28596 },  // Master
    { maxThreshold: 450, spellId: 51304 },  // Grand Master
  ],
  // Blacksmithing
  164: [
    { maxThreshold: 75, spellId: 2018 },
    { maxThreshold: 150, spellId: 3100 },
    { maxThreshold: 225, spellId: 3538 },
    { maxThreshold: 300, spellId: 9785 },
    { maxThreshold: 375, spellId: 29844 },
    { maxThreshold: 450, spellId: 51300 },
  ],
  // Enchanting
  333: [
    { maxThreshold: 75, spellId: 7411 },
    { maxThreshold: 150, spellId: 7412 },
    { maxThreshold: 225, spellId: 7413 },
    { maxThreshold: 300, spellId: 13920 },
    { maxThreshold: 375, spellId: 28029 },
    { maxThreshold: 450, spellId: 51313 },
  ],
  // Engineering
  202: [
    { maxThreshold: 75, spellId: 4036 },
    { maxThreshold: 150, spellId: 4037 },
    { maxThreshold: 225, spellId: 4038 },
    { maxThreshold: 300, spellId: 12656 },
    { maxThreshold: 375, spellId: 30350 },
    { maxThreshold: 450, spellId: 51306 },
  ],
  // Herbalism
  182: [
    { maxThreshold: 75, spellId: 2366 },
    { maxThreshold: 150, spellId: 2368 },
    { maxThreshold: 225, spellId: 3570 },
    { maxThreshold: 300, spellId: 11993 },
    { maxThreshold: 375, spellId: 28695 },
    { maxThreshold: 450, spellId: 50300 },
  ],
  // Inscription
  773: [
    { maxThreshold: 75, spellId: 45357 },
    { maxThreshold: 150, spellId: 45358 },
    { maxThreshold: 225, spellId: 45359 },
    { maxThreshold: 300, spellId: 45360 },
    { maxThreshold: 375, spellId: 45361 },
    { maxThreshold: 450, spellId: 45363 },
  ],
  // Jewelcrafting
  755: [
    { maxThreshold: 75, spellId: 25229 },
    { maxThreshold: 150, spellId: 25230 },
    { maxThreshold: 225, spellId: 28894 },
    { maxThreshold: 300, spellId: 28895 },
    { maxThreshold: 375, spellId: 28897 },
    { maxThreshold: 450, spellId: 51311 },
  ],
  // Leatherworking
  165: [
    { maxThreshold: 75, spellId: 2108 },
    { maxThreshold: 150, spellId: 3104 },
    { maxThreshold: 225, spellId: 3811 },
    { maxThreshold: 300, spellId: 10662 },
    { maxThreshold: 375, spellId: 32549 },
    { maxThreshold: 450, spellId: 51302 },
  ],
  // Mining
  186: [
    { maxThreshold: 75, spellId: 2575 },
    { maxThreshold: 150, spellId: 2576 },
    { maxThreshold: 225, spellId: 3564 },
    { maxThreshold: 300, spellId: 10248 },
    { maxThreshold: 375, spellId: 29354 },
    { maxThreshold: 450, spellId: 50310 },
  ],
  // Skinning
  393: [
    { maxThreshold: 75, spellId: 8613 },
    { maxThreshold: 150, spellId: 8617 },
    { maxThreshold: 225, spellId: 8618 },
    { maxThreshold: 300, spellId: 10768 },
    { maxThreshold: 375, spellId: 32678 },
    { maxThreshold: 450, spellId: 50305 },
  ],
  // Tailoring
  197: [
    { maxThreshold: 75, spellId: 3908 },
    { maxThreshold: 150, spellId: 3909 },
    { maxThreshold: 225, spellId: 3910 },
    { maxThreshold: 300, spellId: 12180 },
    { maxThreshold: 375, spellId: 26790 },
    { maxThreshold: 450, spellId: 51309 },
  ],
  // Cooking
  185: [
    { maxThreshold: 75, spellId: 2550 },
    { maxThreshold: 150, spellId: 3102 },
    { maxThreshold: 225, spellId: 3413 },
    { maxThreshold: 300, spellId: 18260 },
    { maxThreshold: 375, spellId: 33359 },
    { maxThreshold: 450, spellId: 51296 },
  ],
  // First Aid
  129: [
    { maxThreshold: 75, spellId: 3273 },
    { maxThreshold: 150, spellId: 3274 },
    { maxThreshold: 225, spellId: 7924 },
    { maxThreshold: 300, spellId: 10846 },
    { maxThreshold: 375, spellId: 27028 },
    { maxThreshold: 450, spellId: 45542 },
  ],
  // Fishing
  356: [
    { maxThreshold: 75, spellId: 7620 },
    { maxThreshold: 150, spellId: 7731 },
    { maxThreshold: 225, spellId: 7732 },
    { maxThreshold: 300, spellId: 18248 },
    { maxThreshold: 375, spellId: 33095 },
    { maxThreshold: 450, spellId: 51294 },
  ],
}

/**
 * Get the training spell IDs needed for a given profession at a given max level.
 * Returns all tiers up to and including the matching max.
 */
function getTrainingSpellIds(skillId: number, maxLevel: number): number[] {
  const tiers = PROFESSION_TRAINING_SPELLS[skillId]
  if (!tiers) return []
  return tiers.filter(t => t.maxThreshold <= maxLevel).map(t => t.spellId)
}

/**
 * Get ALL training spell IDs for a profession (for removal).
 */
function getAllTrainingSpellIds(skillId: number): number[] {
  const tiers = PROFESSION_TRAINING_SPELLS[skillId]
  if (!tiers) return []
  return tiers.map(t => t.spellId)
}

export default defineEventHandler(async (event) => {
  try {
    const { id: userId, username, ownAccountOnly } = await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

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
      'SELECT guid, name, account FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )
    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    if (ownAccountOnly) verifyCharacterOwnership(userId, (chars as any[])[0].account)

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

      // Also queue training spells so the profession rank displays correctly
      if (value === 0 && max === 0) {
        // Removing profession: remove training spells
        const allSpells = getAllTrainingSpellIds(skillId)
        if (allSpells.length > 0) {
          // Delete training spells directly from DB (safe, Eluna will handle skill removal)
          const spellPlaceholders = allSpells.map(() => '?').join(',')
          await pool.query(
            `DELETE FROM character_spell WHERE guid = ? AND spell IN (${spellPlaceholders})`,
            [guid, ...allSpells]
          )
        }
      } else {
        // Teaching profession: queue training spells via web_spell_requests
        const trainingSpells = getTrainingSpellIds(skillId, max)
        for (const spellId of trainingSpells) {
          await pool.query(
            `INSERT INTO web_spell_requests (character_guid, spell_id, reason, status)
             VALUES (?, ?, ?, 'pending')`,
            [guid, spellId, `Auto: ${profName} training spell for ${value}/${max}`]
          )
        }
      }

      const action = value === 0 && max === 0 ? 'removal' : 'update'
      const spellCount = value === 0 && max === 0
        ? getAllTrainingSpellIds(skillId).length
        : getTrainingSpellIds(skillId, max).length
      console.log(`[DressingRoom] GM ${username} queued ${profName} ${action} for ${charName} (${guid}): ${value}/${max} (+${spellCount} training spells)`)

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

          // Also remove training spells
          const allSpells = getAllTrainingSpellIds(skillId)
          if (allSpells.length > 0) {
            const spellPlaceholders = allSpells.map(() => '?').join(',')
            await pool.query(
              `DELETE FROM character_spell WHERE guid = ? AND spell IN (${spellPlaceholders})`,
              [guid, ...allSpells]
            )
          }

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

      // Teach training spells directly (INSERT IGNORE to skip already-known spells)
      const trainingSpells = getTrainingSpellIds(skillId, max)
      for (const spellId of trainingSpells) {
        await pool.query(
          'INSERT IGNORE INTO character_spell (guid, spell, specMask) VALUES (?, ?, 255)',
          [guid, spellId]
        )
      }

      console.log(`[DressingRoom] GM ${username} set ${profName} to ${value}/${max} for ${charName} (${guid}) (+${trainingSpells.length} training spells)`)

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
