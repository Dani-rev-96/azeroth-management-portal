/**
 * POST /api/admin/dressingroom/add-achievement
 * Grant achievements to a character
 * GM only
 *
 * Body: { guid: number, realmId: string, achievementIds: number[] }
 *
 * Note: There is no Eluna API to grant achievements at runtime.
 * This always does a direct DB insert. If the player is online,
 * they will need to relog to see the achievement.
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { verifyCharacterOwnership } from '#server/utils/dressingroom'

export default defineEventHandler(async (event) => {
  try {
    const { id: userId, username, ownAccountOnly } = await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

    const body = await readBody(event)
    const { guid, realmId, achievementIds } = body as {
      guid: number
      realmId: string
      achievementIds: number[]
    }

    if (!guid || typeof guid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Valid character GUID is required' })
    }
    if (!realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }
    if (!achievementIds || !Array.isArray(achievementIds) || achievementIds.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'At least one achievement ID is required' })
    }
    if (achievementIds.length > 100) {
      throw createError({ statusCode: 400, statusMessage: 'Maximum 100 achievements per request' })
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
    const isOnline = (chars as any[])[0].online === 1

    // Check which achievements are already earned
    const placeholders = achievementIds.map(() => '?').join(',')
    const [existing] = await charPool.query(
      `SELECT achievement FROM character_achievement WHERE guid = ? AND achievement IN (${placeholders})`,
      [guid, ...achievementIds]
    )
    const existingSet = new Set((existing as any[]).map((r: any) => r.achievement))
    const newAchievements = achievementIds.filter(id => !existingSet.has(id))
    const alreadyEarned = achievementIds.length - newAchievements.length

    if (newAchievements.length === 0) {
      return {
        success: true,
        message: `${charName} already has all requested achievements`,
        granted: 0,
        alreadyEarned,
      }
    }

    // Direct DB insert (no Eluna API for achievements)
    const now = Math.floor(Date.now() / 1000) // Unix timestamp
    let granted = 0

    for (const achievementId of newAchievements) {
      try {
        await charPool.query(
          'INSERT IGNORE INTO character_achievement (guid, achievement, date) VALUES (?, ?, ?)',
          [guid, achievementId, now]
        )
        granted++
      } catch (err) {
        console.warn(`[DressingRoom] Failed to grant achievement ${achievementId} to ${charName}:`, err)
      }
    }

    console.log(`[DressingRoom] GM ${username} granted ${granted} achievements to ${charName} (${guid})`)

    const relogNote = isOnline ? ' (relog required to see in-game)' : ''
    return {
      success: true,
      message: `Granted ${granted} achievement(s) to ${charName}${alreadyEarned > 0 ? ` (${alreadyEarned} already earned)` : ''}${relogNote}`,
      granted,
      alreadyEarned,
      requiresRelog: isOnline,
      method: 'direct',
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[DressingRoom] Error granting achievements:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to grant achievements' })
  }
})
