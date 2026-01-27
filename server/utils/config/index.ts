/**
 * Server-side Database Configuration
 * Automatically loads the correct database config based on NODE_ENV
 *
 * SERVER-SIDE ONLY - Contains sensitive credentials
 *
 * Usage in API routes:
 *   const { databaseConfigs } = await useServerDatabaseConfig()
 */

/**
 * Get database configurations (server-side only)
 */
export const useServerDatabaseConfig = async () => {
  const env = process.env.NODE_ENV || 'development'

  try {
    let config
    if (env === 'production') {
      config = await import('./production')
    } else {
      config = await import('./local')
    }

    return {
      databaseConfigs: config.getDatabaseConfigs(),
    }
  } catch (error) {
    console.error(`Failed to load database config for environment: ${env}`, error)
    // Fallback to local
    const config = await import('./local')
    return {
      databaseConfigs: config.getDatabaseConfigs(),
    }
  }
}

// Direct conditional exports for server-side imports (API routes)
export * from './local'
