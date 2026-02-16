/**
 * MySQL Database Connection Pool
 * Server-side only utility for connecting to AzerothCore databases
 *
 * Pools are dynamically created based on realm configuration from environment variables
 */

import mysql from 'mysql2/promise'
import type { Pool } from 'mysql2/promise'
import { getAuthDbConfig, getRealmConfig } from '#server/utils/config'

// Connection pool cache (reuse connections)
// Keys: 'auth', '{realmId}-world', '{realmId}-characters'
const pools: Map<string, Pool> = new Map()
// Promise cache to prevent race conditions during pool creation
const poolPromises: Map<string, Promise<Pool>> = new Map()

/**
 * Get or create a pool atomically (prevents duplicate pool creation on concurrent access)
 */
function getOrCreatePool(cacheKey: string, factory: () => Pool): Pool {
  if (pools.has(cacheKey)) {
    return pools.get(cacheKey)!
  }
  const pool = factory()
  pools.set(cacheKey, pool)
  return pool
}

/**
 * Get or create the auth database pool
 */
export async function getAuthDbPool(): Promise<Pool> {
  const cacheKey = 'auth'

  // Return cached pool if exists
  if (pools.has(cacheKey)) {
    return pools.get(cacheKey)!
  }

  const authConfig = getAuthDbConfig()

  const pool = getOrCreatePool(cacheKey, () => {
    const p = mysql.createPool({
      host: authConfig.host,
      port: authConfig.port,
      user: authConfig.user,
      password: authConfig.password,
      database: authConfig.database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    })
    console.log(`[✓] Created MySQL pool for auth (${authConfig.host}:${authConfig.port})`)
    return p
  })

  return pool
}

/**
 * Get or create a world database pool for a specific realm
 * @param realmId - The realm identifier (from NUXT_DB_REALM_*_ID)
 */
export async function getWorldDbPool(realmId: string): Promise<Pool> {
  const cacheKey = `${realmId}-world`

  // Return cached pool if exists
  if (pools.has(cacheKey)) {
    return pools.get(cacheKey)!
  }

  const realmConfig = getRealmConfig(realmId)
  if (!realmConfig) {
    throw new Error(`Unknown realm ID: ${realmId}. Make sure NUXT_DB_REALM_*_ID is configured.`)
  }

  const pool = getOrCreatePool(cacheKey, () => {
    const p = mysql.createPool({
      host: realmConfig.dbHost,
      port: realmConfig.dbPort,
      user: realmConfig.dbUser,
      password: realmConfig.dbPassword,
      database: 'acore_world',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    })
    console.log(`[✓] Created MySQL pool for ${realmId}-world (${realmConfig.dbHost}:${realmConfig.dbPort})`)
    return p
  })

  return pool
}

/**
 * Get or create a characters database pool for a specific realm
 * @param realmId - The realm identifier (from NUXT_DB_REALM_*_ID)
 */
export async function getCharactersDbPool(realmId: string): Promise<Pool> {
  const cacheKey = `${realmId}-characters`

  // Return cached pool if exists
  if (pools.has(cacheKey)) {
    return pools.get(cacheKey)!
  }

  const realmConfig = getRealmConfig(realmId)
  if (!realmConfig) {
    throw new Error(`Unknown realm ID: ${realmId}. Make sure NUXT_DB_REALM_*_ID is configured.`)
  }

  const pool = getOrCreatePool(cacheKey, () => {
    const p = mysql.createPool({
      host: realmConfig.dbHost,
      port: realmConfig.dbPort,
      user: realmConfig.dbUser,
      password: realmConfig.dbPassword,
      database: 'acore_characters',
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
    })
    console.log(`[✓] Created MySQL pool for ${realmId}-characters (${realmConfig.dbHost}:${realmConfig.dbPort})`)
    return p
  })

  return pool
}

/**
 * Close all database connections (for graceful shutdown)
 */
export async function closeAllPools(): Promise<void> {
  const closePromises = Array.from(pools.entries()).map(async ([key, pool]) => {
    await pool.end()
    pools.delete(key)
    console.log(`[✓] Closed MySQL pool for ${key}`)
  })

  await Promise.all(closePromises)
}
