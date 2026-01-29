/**
 * Configuration Types Export
 *
 * All runtime configuration is loaded from environment variables via the server.
 *
 * Client-side: Fetch realm info from /api/realms endpoint
 * Server-side: import { getRealms, getRealmConfig, getAuthDbConfig, getShopConfig } from '#server/utils/config'
 *
 * This file only re-exports types for shared use.
 */

export type { PublicRealmConfig, RealmConfig, RealmId, ShopConfig } from './config/index'

