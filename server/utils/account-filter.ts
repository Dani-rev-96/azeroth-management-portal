/**
 * Account Query Utilities
 * Helper functions for account-related queries
 */

import type { RowDataPacket } from 'mysql2/promise'
import { getAuthDbPool } from './mysql'

// Cache for non-bot account IDs (short TTL since accounts can be created)
let nonBotAccountIdsCache: number[] | null = null
let nonBotAccountIdsCacheTime = 0
const CACHE_TTL_MS = 30000 // 30 seconds

/**
 * Get all non-bot account IDs from auth database
 * Cached for performance
 */
export async function getNonBotAccountIds(): Promise<number[]> {
  const now = Date.now()

  // Return cached result if still valid
  if (nonBotAccountIdsCache && (now - nonBotAccountIdsCacheTime) < CACHE_TTL_MS) {
    return nonBotAccountIdsCache
  }

  const authPool = await getAuthDbPool()
  const [rows] = await authPool.query<RowDataPacket[]>(
    'SELECT id FROM account WHERE username NOT LIKE "RNDBOT%"'
  )

  nonBotAccountIdsCache = rows.map(row => row.id)
  nonBotAccountIdsCacheTime = now

  return nonBotAccountIdsCache
}

/**
 * Build SQL WHERE clause filter for non-bot accounts
 * Returns '1=1' if no valid accounts (will match nothing when ANDed)
 */
export async function buildNonBotAccountFilter(column: string = 'account'): Promise<string> {
  const ids = await getNonBotAccountIds()

  if (ids.length === 0) {
    return '1=0' // Match nothing
  }

  return `${column} IN (${ids.join(',')})`
}

/**
 * Check if a result set has any non-bot accounts
 */
export async function hasNonBotAccounts(): Promise<boolean> {
  const ids = await getNonBotAccountIds()
  return ids.length > 0
}

/**
 * Invalidate the non-bot account cache
 * Call this when accounts are created or deleted
 */
export function invalidateNonBotAccountCache(): void {
  nonBotAccountIdsCache = null
  nonBotAccountIdsCacheTime = 0
}
