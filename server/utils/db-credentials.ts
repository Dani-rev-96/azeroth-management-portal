/**
 * Database credentials loader - Server-side only
 * Loads from SOPS-encrypted .env files
 * 
 * Usage in API routes:
 *   const creds = useDbCredentials()
 *   await connectDB(creds['auth-db'].user, creds['auth-db'].password)
 */

interface DatabaseCredentials {
  user: string
  password: string
}

interface DbCredentials {
  'auth-db': DatabaseCredentials
  'blizzlike-db': DatabaseCredentials
  'ip-db': DatabaseCredentials
  'ip-boosted-db': DatabaseCredentials
}

// Load credentials from environment variables
// These are loaded from .db.<env>.env files during Nuxt initialization
function getDbCredentialsFromEnv(): DbCredentials {
  return {
    'auth-db': {
      user: process.env.DB_AUTH_USER || '',
      password: process.env.DB_AUTH_PASSWORD || '',
    },
    'blizzlike-db': {
      user: process.env.DB_BLIZZLIKE_WORLD_USER || '',
      password: process.env.DB_BLIZZLIKE_WORLD_PASSWORD || '',
    },
    'ip-db': {
      user: process.env.DB_IP_WORLD_USER || '',
      password: process.env.DB_IP_WORLD_PASSWORD || '',
    },
    'ip-boosted-db': {
      user: process.env.DB_IP_BOOSTED_WORLD_USER || '',
      password: process.env.DB_IP_BOOSTED_WORLD_PASSWORD || '',
    },
  }
}

let cachedCredentials: DbCredentials | null = null

/**
 * Get database credentials (server-side only)
 * Called from useDbCredentialsComposable or API routes
 */
export function useDbCredentials(): DbCredentials {
  if (cachedCredentials) {
    return cachedCredentials
  }

  const creds = getDbCredentialsFromEnv()

  // Validate credentials are loaded
  if (!creds['auth-db'].user || !creds['auth-db'].password) {
    console.warn(
      '[WARN] Database credentials not loaded. ' +
      'Make sure .db.<env>.env file is loaded before Nuxt initialization.'
    )
  }

  cachedCredentials = creds
  return creds
}
