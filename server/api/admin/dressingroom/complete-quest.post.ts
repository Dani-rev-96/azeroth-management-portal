/**
 * POST /api/admin/dressingroom/complete-quest
 * Mark quests as completed for a character
 * GM only
 *
 * Body: { guid: number, realmId: string, questIds: number[] }
 *
 * Uses web_quest_requests Eluna queue when enabled.
 * For online players: CompleteQuest() marks objectives done instantly.
 * Player visits quest giver to turn in and receive rewards (XP, gold, items, rep).
 * For offline players: direct DB manipulation marks quest as rewarded.
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getCharactersDbPool } from '#server/utils/mysql'
import { getElunaConfig } from '#server/utils/config'
import { verifyCharacterOwnership } from '#server/utils/dressingroom'

export default defineEventHandler(async (event) => {
  try {
    const { id: userId, username, ownAccountOnly } = await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

    const body = await readBody(event)
    const { guid, realmId, questIds } = body as {
      guid: number
      realmId: string
      questIds: number[]
    }

    if (!guid || typeof guid !== 'number') {
      throw createError({ statusCode: 400, statusMessage: 'Valid character GUID is required' })
    }
    if (!realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }
    if (!questIds || !Array.isArray(questIds) || questIds.length === 0) {
      throw createError({ statusCode: 400, statusMessage: 'At least one quest ID is required' })
    }
    if (questIds.length > 100) {
      throw createError({ statusCode: 400, statusMessage: 'Maximum 100 quests per request' })
    }

    const charPool = await getCharactersDbPool(realmId)

    // Verify character exists
    const [chars] = await charPool.query(
      'SELECT guid, name, account FROM characters WHERE guid = ? AND deleteDate IS NULL',
      [guid]
    )
    if ((chars as any[]).length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Character not found' })
    }

    if (ownAccountOnly) verifyCharacterOwnership(userId, (chars as any[])[0].account)

    const charName = (chars as any[])[0].name

    // Check which quests are already completed
    const placeholders = questIds.map(() => '?').join(',')
    const [alreadyCompleted] = await charPool.query(
      `SELECT quest FROM character_queststatus_rewarded WHERE guid = ? AND quest IN (${placeholders})`,
      [guid, ...questIds]
    )
    const completedSet = new Set((alreadyCompleted as any[]).map((r: any) => r.quest))
    const newQuests = questIds.filter(id => !completedSet.has(id))
    const alreadyDone = questIds.length - newQuests.length

    if (newQuests.length === 0) {
      return {
        success: true,
        message: `${charName} has already completed all requested quests`,
        completed: 0,
        alreadyDone,
      }
    }

    const elunaConfig = getElunaConfig()
    let completed = 0

    if (elunaConfig.enabled) {
      // Queue via web_quest_requests for Eluna processing
      for (const questId of newQuests) {
        await charPool.query(
          `INSERT INTO web_quest_requests (character_guid, quest_id, action, reason, status)
           VALUES (?, ?, 'complete', ?, 'pending')`,
          [guid, questId, `GM DressingRoom: ${username} completed quest ${questId}`]
        )
        completed++
      }
    } else {
      // Direct DB: insert into character_queststatus_rewarded
      for (const questId of newQuests) {
        try {
          // Remove from active quest log if present
          await charPool.query(
            'DELETE FROM character_queststatus WHERE guid = ? AND quest = ?',
            [guid, questId]
          )
          // Mark as rewarded
          await charPool.query(
            'INSERT IGNORE INTO character_queststatus_rewarded (guid, quest, active) VALUES (?, ?, 1)',
            [guid, questId]
          )
          completed++
        } catch (err) {
          console.warn(`[DressingRoom] Failed to complete quest ${questId} for ${charName}:`, err)
        }
      }
    }

    console.log(`[DressingRoom] GM ${username} completed ${completed} quests for ${charName} (${guid})`)

    return {
      success: true,
      message: `Completed ${completed} quest(s) for ${charName}${alreadyDone > 0 ? ` (${alreadyDone} already done)` : ''}`,
      completed,
      alreadyDone,
      method: elunaConfig.enabled ? 'eluna' : 'direct',
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) throw error
    console.error('[DressingRoom] Error completing quests:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to complete quests' })
  }
})
