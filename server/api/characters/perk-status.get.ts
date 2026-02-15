/**
 * GET /api/characters/perk-status?characterGuid=123&realmId=1
 *
 * Returns the current daily usage counts for all perks for a specific character.
 * Used by the frontend to show "X / Y uses today" on each perk card.
 */

import type { RowDataPacket } from 'mysql2/promise'

interface PerkUsageRow {
  perk_id: string
  cnt: number
}

export default defineEventHandler(async (event) => {
  const query = getQuery(event)
  const characterGuid = Number(query.characterGuid)
  const realmId = String(query.realmId || '')

  if (!characterGuid || !realmId) {
    throw createError({ statusCode: 400, statusMessage: 'characterGuid and realmId are required.' })
  }

  // Authenticate (must be logged in)
  const { getAuthenticatedUser } = await import('#server/utils/auth')
  await getAuthenticatedUser(event)

  try {
    const { getCharactersDbPool } = await import('#server/utils/mysql')
    const charPool = await getCharactersDbPool(realmId)

    // Ensure the table exists (no-op if already created by activate-perk)
    await charPool.query(`
      CREATE TABLE IF NOT EXISTS web_perk_usage (
        id INTEGER PRIMARY KEY AUTO_INCREMENT,
        character_guid INT NOT NULL,
        perk_id VARCHAR(64) NOT NULL,
        used_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        outcome VARCHAR(16) NOT NULL DEFAULT 'success',
        roll INT NOT NULL DEFAULT 0,
        INDEX idx_perk_usage_lookup (character_guid, perk_id, used_at)
      )
    `)

    const [rows] = await charPool.query<RowDataPacket[]>(
      `SELECT perk_id, COUNT(*) AS cnt
       FROM web_perk_usage
       WHERE character_guid = ? AND DATE(used_at) = CURDATE()
       GROUP BY perk_id`,
      [characterGuid],
    )

    // Build a map of perkId → usesToday
    const usage: Record<string, number> = {}
    for (const row of rows as PerkUsageRow[]) {
      usage[row.perk_id] = row.cnt
    }

    return { usage }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    console.error('Error fetching perk status:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch perk usage status.',
    })
  }
})
