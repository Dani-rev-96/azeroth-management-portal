/**
 * GM Access Service
 * Checks user permissions from account_access table
 */

import { getAuthDbPool } from '#server/utils/mysql'
import type { Pool } from 'mysql2/promise'

export interface GMAccess {
  accountId: number
  gmLevel: number
  realmId: number
  comment: string | null
}

/**
 * Check if an account has GM access
 * @param accountId WoW account ID
 * @param realmId Optional realm ID (-1 means all realms)
 * @returns GM access info or null if not a GM
 */
export async function getGMAccess(accountId: number, realmId?: number): Promise<GMAccess | null> {
  const pool = await getAuthDbPool()

  let query = 'SELECT * FROM account_access WHERE id = ?'
  const params: any[] = [accountId]

  if (realmId !== undefined) {
    query += ' AND (RealmID = ? OR RealmID = -1)'
    params.push(realmId)
  }

  query += ' ORDER BY gmlevel DESC LIMIT 1'

  const [rows] = await pool.query(query, params)
  const results = rows as any[]

  if (results.length === 0) {
    return null
  }

  const row = results[0]
  return {
    accountId: row.id,
    gmLevel: row.gmlevel,
    realmId: row.RealmID,
    comment: row.comment || null,
  }
}

/**
 * Get all GM accounts
 * @returns List of all accounts with GM access
 */
export async function getAllGMAccounts(): Promise<GMAccess[]> {
  const pool = await getAuthDbPool()

  const [rows] = await pool.query(
    'SELECT * FROM account_access ORDER BY gmlevel DESC, id ASC'
  )
  const results = rows as any[]

  return results.map(row => ({
    accountId: row.id,
    gmLevel: row.gmlevel,
    realmId: row.RealmID,
    comment: row.comment || null,
  }))
}

/**
 * Check if user has GM access based on their mapped accounts
 * @param externalId External auth user ID (username or unique identifier)
 * @returns Highest GM level found, or 0 if not a GM
 */
export async function getUserGMLevel(externalId: string): Promise<number> {
  const { AccountMappingDB } = await import('#server/utils/db')
  const mappings = AccountMappingDB.findByExternalId(externalId)

  if (mappings.length === 0) {
    return 0
  }

  let highestLevel = 0

  for (const mapping of mappings) {
    const access = await getGMAccess(mapping.wow_account_id)
    if (access && access.gmLevel > highestLevel) {
      highestLevel = access.gmLevel
    }
  }

  return highestLevel
}

/**
 * Get all accounts with their GM status
 * Useful for admin panel
 */
export async function getAllAccountsWithGMStatus() {
  const { findAllAccounts } = await import('#server/services/account')
  const accounts = await findAllAccounts()

  const accountsWithGM = await Promise.all(
    accounts.map(async (account) => {
      const gmAccess = await getGMAccess(account.id)
      return {
        ...account,
        isGM: gmAccess !== null,
        gmLevel: gmAccess?.gmLevel || 0,
        gmRealmId: gmAccess?.realmId,
        gmComment: gmAccess?.comment,
      }
    })
  )

  return accountsWithGM
}
