/**
 * Realm Query Utilities
 * Helper functions for querying across multiple realms
 */

import type { Pool } from 'mysql2/promise'

interface RealmConfig {
  name: string
  [key: string]: any
}

/**
 * Get realms to query based on optional filter
 */
export function getRealmsToQuery(
  allRealms: Record<string, RealmConfig>,
  realmIdFilter?: string
): Record<string, RealmConfig> {
  if (!realmIdFilter) {
    return allRealms
  }

  if (!(realmIdFilter in allRealms)) {
    throw createError({
      statusCode: 400,
      statusMessage: `Invalid realm ID: ${realmIdFilter}`,
    })
  }

  const realm = allRealms[realmIdFilter]
  if (!realm) {
    throw createError({
      statusCode: 400,
      statusMessage: `Realm not found: ${realmIdFilter}`,
    })
  }

  return { [realmIdFilter]: realm }
}

/**
 * Execute a query across multiple realms and aggregate results
 */
export async function queryAllRealms<T>(
  realms: Record<string, RealmConfig>,
  getPool: (realmId: string) => Promise<Pool>,
  queryFn: (pool: Pool, realmId: string, realm: RealmConfig) => Promise<T[]>
): Promise<T[]> {
  const results: T[] = []

  for (const [realmId, realm] of Object.entries(realms)) {
    const pool = await getPool(realmId)
    const realmResults = await queryFn(pool, realmId, realm)
    results.push(...realmResults)
  }

  return results
}

/**
 * Execute an aggregation query across multiple realms
 */
export async function aggregateAcrossRealms<T extends Record<string, number>>(
  realms: Record<string, RealmConfig>,
  getPool: (realmId: string) => Promise<Pool>,
  queryFn: (pool: Pool, realmId: string, realm: RealmConfig) => Promise<T>,
  initialValue: T
): Promise<T> {
  const result = { ...initialValue }

  for (const [realmId, realm] of Object.entries(realms)) {
    const pool = await getPool(realmId)
    const realmResult = await queryFn(pool, realmId, realm)

    for (const key of Object.keys(result) as Array<keyof T>) {
      (result[key] as number) += (realmResult[key] as number) || 0
    }
  }

  return result
}
