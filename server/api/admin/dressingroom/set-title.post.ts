/**
 * POST /api/admin/dressingroom/set-title
 * Add, remove, or set active title for a character
 * GM only
 *
 * Body: { guid: number, realmId: string, titleId: number, action: 'add'|'remove'|'setChosen' }
 *
 * Uses web_title_requests Eluna queue when enabled:
 * - add: player:SetKnownTitle(titleId)
 * - remove: player:UnsetKnownTitle(titleId)
 * For 'setChosen': updates characters.chosenTitle
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { getElunaConfig } from '#server/utils/config'
import { verifyCharacterOwnership } from '#server/utils/dressingroom'

export default defineEventHandler(async (event) => {
  try {
    const { id: userId, username, ownAccountOnly } = await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

    const body = await readBody(event)
    const { guid, realmId, titleId, action } = body as {
      guid: number
      realmId: string
      titleId: number
      action: 'add' | 'remove' | 'setChosen'
    }

    if (!guid || typeof guid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Valid character GUID is required' })
    }
    if (!realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }
    if (titleId === undefined || typeof titleId !== 'number' || titleId < 0) {
      throw createError({ statusCode: 400, statusMessage: 'Valid title ID is required' })
    }
    if (!action || !['add', 'remove', 'setChosen'].includes(action)) {
      throw createError({ statusCode: 400, statusMessage: 'Action must be "add", "remove", or "setChosen"' })
    }

    const pool = await getCharactersDbPool(realmId)

    // Verify character exists
    const [chars] = await pool.query(
      'SELECT guid, name, knownTitles, chosenTitle, account FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )
    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    if (ownAccountOnly) verifyCharacterOwnership(userId, (chars as any[])[0].account)

    const charName = (chars as any[])[0].name
    const elunaConfig = getElunaConfig()

    if (action === 'setChosen') {
      // Setting chosen title is a simple column update, safe even for Eluna mode
      // because it only takes visual effect and the server reads it on demand
      await pool.query(
        'UPDATE characters SET chosenTitle = ? WHERE guid = ?',
        [titleId, guid]
      )

      console.log(`[DressingRoom] GM ${username} set chosen title ${titleId} for ${charName} (${guid})`)

      return {
        success: true,
        message: `Set ${charName}'s active title to ${titleId}`,
        action: 'setChosen',
        method: 'direct',
      }
    }

    if (elunaConfig.enabled) {
      // Queue via web_title_requests for Eluna processing
      await pool.query(
        `INSERT INTO web_title_requests (character_guid, title_id, action, reason, status)
         VALUES (?, ?, ?, ?, 'pending')`,
        [guid, titleId, action, `GM DressingRoom: ${username} ${action} title ${titleId}`]
      )

      console.log(`[DressingRoom] GM ${username} queued title ${action} ${titleId} for ${charName} (${guid})`)

      return {
        success: true,
        message: `Queued title ${action} for ${charName} (will apply shortly)`,
        action,
        method: 'eluna',
      }
    } else {
      // Direct DB: manipulate knownTitles bitmask
      const knownTitles = (chars as any[])[0].knownTitles || ''
      const titleBits = knownTitles.split(' ').map(Number)

      // Each uint32 holds 32 title bits
      const fieldIndex = Math.floor(titleId / 32)
      const bitIndex = titleId % 32

      // Ensure array is large enough
      while (titleBits.length <= fieldIndex) {
        titleBits.push(0)
      }

      if (action === 'add') {
        titleBits[fieldIndex] = (titleBits[fieldIndex] | (1 << bitIndex)) >>> 0
      } else {
        titleBits[fieldIndex] = (titleBits[fieldIndex] & ~(1 << bitIndex)) >>> 0
      }

      const newKnownTitles = titleBits.join(' ')
      await pool.query(
        'UPDATE characters SET knownTitles = ? WHERE guid = ?',
        [newKnownTitles, guid]
      )

      console.log(`[DressingRoom] GM ${username} ${action} title ${titleId} for ${charName} (${guid})`)

      return {
        success: true,
        message: `${action === 'add' ? 'Added' : 'Removed'} title ${titleId} for ${charName}`,
        action,
        method: 'direct',
      }
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[DressingRoom] Error setting title:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to set title' })
  }
})
