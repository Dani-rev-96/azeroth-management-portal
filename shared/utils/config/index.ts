/**
 * Shared Configuration Types
 *
 * All runtime configuration is loaded from environment variables via the server.
 * Client-side should fetch realm info from /api/realms endpoint.
 * Server-side should use: import { getRealms, getShopConfig } from '#server/utils/config'
 *
 * This file only exports types for shared use between client and server.
 */

import type { RealmConfig, RealmId, ShopConfig } from '~/types'

// Public realm info (without credentials) for client-side use
export type PublicRealmConfig = {
  id: RealmId
  name: string
  description: string
}

// Export type helpers
export type { RealmConfig, RealmId, ShopConfig }
