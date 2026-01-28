/**
 * MySQL Database Connection Pool
 * Server-side only utility for connecting to AzerothCore databases
 *
 * Pools are dynamically created based on realm configuration from environment variables
 */

import mysql from 'mysql2/promise'
import type { Pool, PoolOptions } from 'mysql2/promise'
import { getAuthDbConfig, getRealmConfig } from '#server/utils/config'

// Connection pool cache (reuse connections)
// Keys: 'auth', '{realmId}-world', '{realmId}-characters'
const pools: Map<string, Pool> = new Map()

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

  const poolConfig: PoolOptions = {
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
  }

  const pool = mysql.createPool(poolConfig)
  pools.set(cacheKey, pool)

  console.log(`[✓] Created MySQL pool for auth (${authConfig.host}:${authConfig.port})`)

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

  const poolConfig: PoolOptions = {
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
  }

  const pool = mysql.createPool(poolConfig)
  pools.set(cacheKey, pool)

  console.log(`[✓] Created MySQL pool for ${realmId}-world (${realmConfig.dbHost}:${realmConfig.dbPort})`)

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

  const poolConfig: PoolOptions = {
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
  }

  const pool = mysql.createPool(poolConfig)
  pools.set(cacheKey, pool)

  console.log(`[✓] Created MySQL pool for ${realmId}-characters (${realmConfig.dbHost}:${realmConfig.dbPort})`)

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
