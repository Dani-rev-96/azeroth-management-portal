/**
 * Configuration Export
 * This is a convenience re-export that loads environment-specific configs
 *
 * Import from here for cleaner imports:
 *   import { realms, getDatabaseConfigs } from '~/utils/config'
 *
 * Environment-specific configs are in shared/utils/config/:
 *   - local.ts (development)
 *   - staging.ts (staging)
 *   - production.ts (production)
 */

export {
  realms,
  authServerConfig,
  getDatabaseConfigs,
  getServerConfig,
  useServerConfig,
} from './config/index'

