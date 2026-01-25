import { AccountMappingDB } from '#server/utils/db'
import { realms } from '#shared/utils/config'
import type { ManagedAccount, AccountMapping } from '~/types'

/**
 * GET /api/accounts/user/:keycloakId
 * Get all WoW accounts mapped to a Keycloak user
 */
export default defineEventHandler(async (event) => {
  const keycloakId = getRouterParam(event, 'keycloakId')

  if (!keycloakId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Keycloak ID is required',
    })
  }

  try {
    // Get all mappings from SQLite database
    const dbMappings = AccountMappingDB.findByKeycloakId(keycloakId)

    // Transform to ManagedAccount objects
    const accounts: ManagedAccount[] = dbMappings.map(dbMapping => {
      const realm = realms[dbMapping.realm_id as keyof typeof realms]
      
      const mapping: AccountMapping = {
        keycloakId: dbMapping.keycloak_id,
        keycloakUsername: dbMapping.keycloak_username,
        wowAccountId: dbMapping.wow_account_id,
        wowAccountName: dbMapping.wow_account_username,
        realmId: dbMapping.realm_id as any,
        createdAt: dbMapping.created_at,
        lastUsed: dbMapping.last_used || undefined,
      }

      return {
        mapping,
        realm,
        // TODO: Query WoW database for actual account and character data
        wowAccount: {
          id: dbMapping.wow_account_id,
          username: dbMapping.wow_account_username,
          sha_pass_hash: '',
          expansion: 2,
          mutetime: 0,
          locale: 0,
        },
        characters: [],
      }
    })

    return accounts
  } catch (error) {
    console.error('Error loading accounts:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load accounts',
    })
  }
})
