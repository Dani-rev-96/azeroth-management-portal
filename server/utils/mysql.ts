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

  // Get credentials and config
  const config = useRuntimeConfig()
  const serverConfig = await useServerConfig()
  
  // Map character db keys to their base db config keys
  const baseDbKeyMap: Record<string, keyof typeof serverConfig.databaseConfigs> = {
    'blizzlike-characters-db': 'blizzlike-db',
    'ip-characters-db': 'ip-db',
    'ip-boosted-characters-db': 'ip-boosted-db',
  }
  
  // Get the base config key (for character dbs, use their base db config)
  const configKey = baseDbKeyMap[dbKey as keyof typeof baseDbKeyMap] || dbKey
  const dbConfig = serverConfig.databaseConfigs[configKey as keyof typeof serverConfig.databaseConfigs]
  if (!dbConfig) {
    throw new Error(`Database configuration not found for: ${dbKey}`)
  }

  // Map dbKey to runtimeConfig credentials
  const credentialsMap = {
    'auth-db': { user: config.db.authUser, password: config.db.authPassword },
    'blizzlike-db': { user: config.db.blizzlikeWorldUser, password: config.db.blizzlikeWorldPassword },
    'blizzlike-characters-db': { user: config.db.blizzlikeWorldUser, password: config.db.blizzlikeWorldPassword },
    'ip-db': { user: config.db.ipWorldUser, password: config.db.ipWorldPassword },
    'ip-characters-db': { user: config.db.ipWorldUser, password: config.db.ipWorldPassword },
    'ip-boosted-db': { user: config.db.ipBoostedWorldUser, password: config.db.ipBoostedWorldPassword },
    'ip-boosted-characters-db': { user: config.db.ipBoostedWorldUser, password: config.db.ipBoostedWorldPassword },
  }

  const credentials = credentialsMap[dbKey]
  
  // Determine which database to use (world or characters)
  const isCharactersDb = dbKey.includes('-characters-')
  const databaseIndex = isCharactersDb ? 1 : 0 // 0 = world/auth, 1 = characters
  
  // Create pool configuration
  const poolConfig: PoolOptions = {
    host: dbConfig.host,
    port: dbConfig.port,
    user: credentials.user,
    password: credentials.password,
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
  // Map realm IDs to database keys
  const realmDbMap: Record<string, keyof PoolCache> = {
    'wotlk': dbType === 'characters' ? 'blizzlike-characters-db' : 'blizzlike-db',
    'wotlk-ip': dbType === 'characters' ? 'ip-characters-db' : 'ip-db',
    'wotlk-ip-boosted': dbType === 'characters' ? 'ip-boosted-characters-db' : 'ip-boosted-db',
  }

  const dbKey = realmDbMap[realmId]
  if (!dbKey) {
    throw new Error(`Unknown realm ID: ${realmId}`)
  }

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
