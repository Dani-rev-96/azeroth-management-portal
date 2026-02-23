/**
 * GET /api/admin/dressingroom/spell-search
 * Search spells by name or ID from the DBC spell database
 *
 * Query: ?q=<search>&limit=<number>
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { searchSpellsByName, getSpell } from '#server/utils/dbc-db'

export default defineEventHandler(async (event) => {
  try {
    await getAuthenticatedFeatureUser(event, 'admin.dressingroom')

    const query = getQuery(event)
    const q = (query.q as string || '').trim()
    const limit = Math.min(Math.max(parseInt(query.limit as string) || 50, 1), 200)

    if (!q || q.length < 2) {
      throw createError({ statusCode: 400, statusMessage: 'Search query must be at least 2 characters' })
    }

    // Search by ID or name
    const isNumeric = /^\d+$/.test(q)

    if (isNumeric) {
      const spell = await getSpell(parseInt(q))
      if (spell) {
        return {
          spells: [{
            id: spell.id,
            name: spell.name || `Spell #${spell.id}`,
            rank: spell.rank || '',
            description: spell.description || '',
            schoolMask: spell.school_mask,
          }],
        }
      }
      return { spells: [] }
    }

    const spells = await searchSpellsByName(q, limit)

    return {
      spells: spells.map(s => ({
        id: s.id,
        name: s.name || `Spell #${s.id}`,
        rank: s.rank || '',
        description: s.description || '',
        schoolMask: s.school_mask,
      })),
    }
  } catch (error: any) {
    if (error?.statusCode) throw error
    console.error('[DressingRoom] Error searching spells:', error)
    throw createError({ statusCode: 500, statusMessage: 'Failed to search spells' })
  }
})
