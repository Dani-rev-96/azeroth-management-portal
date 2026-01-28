/**
 * Configuration Export
 * This is a convenience re-export that loads environment-specific configs
 * PUBLIC - Safe to share with client (only realm metadata, no credentials)
 *
 * Import from here for cleaner imports:
 *   import { realms, useServerConfig } from '~/shared/utils/config'
 *
 * For database credentials (server-side only):
 *   import { getRealms, getRealmConfig, getAuthDbConfig } from '#server/utils/config'
 *
 * Environment-specific configs are in shared/utils/config/:
 *   - local.ts (development)
 *   - production.ts (production)
 */

export {
  realms,
  useServerConfig,
} from './config/index'

