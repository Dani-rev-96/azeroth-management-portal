/**
 * GET /api/admin/dressingroom/quest-search
 * Search quests by name or ID from the world database
 * GM only
 *
 * Query: ?q=<search>&realmId=<realmId>&guid=<charGuid>
 */
import { getAuthenticatedGM } from '#server/utils/auth'
import { getWorldDbPool, getCharactersDbPool } from '#server/utils/mysql'

export default defineEventHandler(async (event) => {
  try {
    await getAuthenticatedGM(event)

    const query = getQuery(event)
    const q = (query.q as string || '').trim()
    const realmId = query.realmId as string || ''
    const charGuid = parseInt(query.guid as string || '0')

    if (!q || q.length < 2) {
      throw createError({ statusCode: 400, statusMessage: 'Search query must be at least 2 characters' })
    }
    if (!realmId) {
      throw createError({ statusCode: 400, statusMessage: 'Realm ID is required' })
    }

    const worldPool = await getWorldDbPool(realmId)

    // Search by ID or name
    const isNumeric = /^\d+$/.test(q)
    let quests: any[]

    if (isNumeric) {
      const [rows] = await worldPool.query(
        `SELECT ID, LogTitle, QuestLevel, MinLevel, RewardXPDifficulty
         FROM quest_template
         WHERE ID = ?
         LIMIT 1`,
        [parseInt(q)]
      )
      quests = rows as any[]
    } else {
      const [rows] = await worldPool.query(
        `SELECT ID, LogTitle, QuestLevel, MinLevel, RewardXPDifficulty
         FROM quest_template
         WHERE LogTitle LIKE ?
         ORDER BY QuestLevel DESC, LogTitle ASC
         LIMIT 50`,
        [`%${q}%`]
      )
      quests = rows as any[]
    }

    // If we have a character GUID, check which quests are already completed
    let completedSet = new Set<number>()
    if (charGuid && quests.length > 0) {
      const charPool = await getCharactersDbPool(realmId)
      const questIds = quests.map((q: any) => q.ID)
      const placeholders = questIds.map(() => '?').join(',')
      const [completed] = await charPool.query(
        `SELECT quest FROM character_queststatus_rewarded WHERE guid = ? AND quest IN (${placeholders})`,
        [charGuid, ...questIds]
      )
      completedSet = new Set((completed as any[]).map((r: any) => r.quest))
    }

    return {
      quests: quests.map((q: any) => ({
        id: q.ID,
        name: q.LogTitle || `Quest #${q.ID}`,
        level: q.QuestLevel,
        minLevel: q.MinLevel,
        completed: completedSet.has(q.ID),
      })),
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    console.error('[DressingRoom] Error searching quests:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to search quests' })
  }
})
