/**
 * POST /api/admin/dressingroom/teach-spell
 * Teach spells to a character via Eluna queue or direct DB insert
 * GM only
 *
 * Body: { guid: number, realmId: string, spellIds: number[] }
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { getElunaConfig } from '#server/utils/config'
import { verifyCharacterOwnership } from '#server/utils/dressingroom'

export default defineEventHandler(async (event) => {
  try {
    const { id: userId, username, ownAccountOnly } = await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

    const body = await readBody(event)
    const { guid, realmId, spellIds } = body as {
      guid: number
      realmId: string
      spellIds: number[]
    }

    if (!guid || typeof guid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Valid character GUID is required' })
    }
    if (!realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }
    if (!spellIds || !Array.isArray(spellIds) || spellIds.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'At least one spell ID is required' })
    }
    if (spellIds.length > 100) {
      throw createError({ statusCode: 400, statusMessage: 'Maximum 100 spells per request' })
    }

    const charPool = await getCharactersDbPool(realmId)

    // Verify character exists
    const [chars] = await charPool.query(
      'SELECT guid, name, online, account FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )
    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    if (ownAccountOnly) verifyCharacterOwnership(userId, (chars as any[])[0].account)

    const charName = (chars as any[])[0].name
    const elunaConfig = getElunaConfig()
    let taught = 0
    let alreadyKnown = 0

    // Check which spells the character already knows
    const spellPlaceholders = spellIds.map(() => '?').join(',')
    const [knownSpells] = await charPool.query(
      `SELECT spell FROM character_spell WHERE guid = ? AND spell IN (${spellPlaceholders})`,
      [guid, ...spellIds]
    )
    const knownSet = new Set((knownSpells as any[]).map(s => s.spell))

    const newSpells = spellIds.filter(id => !knownSet.has(id))
    alreadyKnown = spellIds.length - newSpells.length

    if (newSpells.length === 0) {
      return {
        success: true,
        message: `${charName} already knows all requested spells`,
        taught: 0,
        alreadyKnown,
      }
    }

    if (elunaConfig.enabled) {
      // Queue via web_spell_requests for Eluna processing
      for (const spellId of newSpells) {
        await charPool.query(
          `INSERT INTO web_spell_requests (character_guid, spell_id, reason, status)
           VALUES (?, ?, ?, 'pending')`,
          [guid, spellId, `GM DressingRoom: ${username} taught spell ${spellId}`]
        )
        taught++
      }
    } else {
      // Direct DB insert (less safe, works for offline characters)
      for (const spellId of newSpells) {
        try {
          await charPool.query(
            `INSERT IGNORE INTO character_spell (guid, spell, specMask)
             VALUES (?, ?, 255)`,
            [guid, spellId]
          )
          taught++
        } catch (err) {
          console.warn(`[DressingRoom] Failed to teach spell ${spellId} to ${charName}:`, err)
        }
      }
    }

    console.log(`[DressingRoom] GM ${username} taught ${taught} spells to ${charName} (${guid})`)

    return {
      success: true,
      message: `Taught ${taught} spell(s) to ${charName}${alreadyKnown > 0 ? ` (${alreadyKnown} already known)` : ''}`,
      taught,
      alreadyKnown,
      method: elunaConfig.enabled ? 'eluna' : 'direct',
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[DressingRoom] Error teaching spells:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to teach spells' })
  }
})
