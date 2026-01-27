/**
 * MySQL Database Connection Pool
 * Server-side only utility for connecting to AzerothCore databases
 */

import mysql from 'mysql2/promise'
import type { Pool, PoolOptions } from 'mysql2/promise'

type PoolCache = {
  'auth-db': Pool | null
  'blizzlike-db': Pool | null
  'blizzlike-characters-db': Pool | null
  'ip-db': Pool | null
  'ip-characters-db': Pool | null
  'ip-boosted-db': Pool | null
  'ip-boosted-characters-db': Pool | null
}

// Connection pool cache (reuse connections)
const pools: PoolCache = {
  'auth-db': null,
  'blizzlike-db': null,
  'blizzlike-characters-db': null,
  'ip-db': null,
  'ip-characters-db': null,
  'ip-boosted-db': null,
  'ip-boosted-characters-db': null,
}

/**
 * Get or create a connection pool for a specific database
 */
export async function getDbPool(dbKey: keyof PoolCache): Promise<Pool> {
  // Return cached pool if exists
  if (pools[dbKey]) {
    return pools[dbKey]!
  }

  // Get config
  const serverConfig = await useServerConfig()

  // For character databases, derive the base database key
  const isCharactersDb = dbKey.includes('-characters-')
  const configKey = isCharactersDb ? dbKey.replace('-characters-db', '-db') : dbKey

  const dbConfig = serverConfig.databaseConfigs[configKey as keyof typeof serverConfig.databaseConfigs]
  if (!dbConfig) {
    throw new Error(`Database configuration not found for: ${configKey}`)
  }

  // Determine which database to use (world or characters)
  const databaseIndex = isCharactersDb ? 1 : 0 // 0 = world/auth, 1 = characters

  // Create pool configuration
  const poolConfig: PoolOptions = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: dbConfig.user,
    password: dbConfig.password,
    database: dbConfig.databases[databaseIndex],
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0,
  }

  // Create and cache the pool
  const pool = mysql.createPool(poolConfig)
  pools[dbKey] = pool

  console.log(`[✓] Created MySQL pool for ${dbKey} (${dbConfig.host}:${dbConfig.port})`)

  return pool
}

/**
 * Get the auth database pool (for account verification)
 */
export async function getAuthDbPool(): Promise<Pool> {
  return getDbPool('auth-db')
}

/**
 * Get a world database pool for a specific realm
 * @param realmId - The realm identifier
 * @param dbType - 'world' for game data, 'characters' for character data (default: 'world')
 */
export async function getWorldDbPool(realmId: string, dbType: 'world' | 'characters' = 'world'): Promise<Pool> {
  const serverConfig = await useServerConfig()
  const realm = serverConfig.realms[realmId as keyof typeof serverConfig.realms]

  if (!realm) {
    throw new Error(`Unknown realm ID: ${realmId}`)
  }

  // Use the databaseKey from realm config to determine pool key
  const baseDbKey = realm.databaseKey
  const dbKey = (dbType === 'characters' ? `${baseDbKey.replace('-db', '')}-characters-db` : baseDbKey) as keyof PoolCache

  return getDbPool(dbKey)
}

/**
 * Get a character database pool for a specific realm
 * Convenience wrapper for getWorldDbPool with 'characters' type
 */
export async function getCharactersDbPool(realmId: string): Promise<Pool> {
  return getWorldDbPool(realmId, 'characters')
}

/**
 * Close all database connections (for graceful shutdown)
 */
export async function closeAllPools(): Promise<void> {
  const closePromises = Object.entries(pools).map(async ([key, pool]) => {
    if (pool) {
      await pool.end()
      pools[key as keyof PoolCache] = null
      console.log(`[✓] Closed MySQL pool for ${key}`)
    }
  })

  await Promise.all(closePromises)
}
