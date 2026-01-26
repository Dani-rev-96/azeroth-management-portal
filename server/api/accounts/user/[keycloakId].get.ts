import { AccountMappingDB } from '#server/utils/db'
import { findRealmsWithCharacters } from '#server/services/realm'
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
    const config = useRuntimeConfig()
    const authMode = config.public.authMode

    // Get authenticated user from headers or mock user
    let authenticatedUser: string | undefined
    if (authMode === 'mock') {
      authenticatedUser = config.public.mockUser || 'admin'
    } else {
      authenticatedUser = getHeader(event, 'x-remote-user')
    }

    // Security check: verify the requested keycloakId matches authenticated user
    // In production, this is based on Keycloak username
    // Note: This is a basic check - might need adjustment based on your security requirements
    if (authMode !== 'mock' && authenticatedUser) {
      const requestedMappings = AccountMappingDB.findByKeycloakId(keycloakId)
      if (requestedMappings.length > 0 && requestedMappings[0]?.keycloak_username !== authenticatedUser) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Not authorized to view these accounts',
        })
      }
    }

    // Get all mappings from SQLite database
    const dbMappings = AccountMappingDB.findByKeycloakId(keycloakId)

    // Transform to ManagedAccount objects with character data from all realms
    const accounts: ManagedAccount[] = await Promise.all(
      dbMappings.map(async (dbMapping) => {
        const mapping: AccountMapping = {
          keycloakId: dbMapping.keycloak_id,
          keycloakUsername: dbMapping.keycloak_username,
          wowAccountId: dbMapping.wow_account_id,
          wowAccountName: dbMapping.wow_account_username,
          createdAt: dbMapping.created_at,
          lastUsed: dbMapping.last_used || undefined,
        }

        // Find all realms with characters for this account
        const realms = await findRealmsWithCharacters(dbMapping.wow_account_id)

        return {
          mapping,
          wowAccount: {
            id: dbMapping.wow_account_id,
            username: dbMapping.wow_account_username,
            sha_pass_hash: '',
            expansion: 2,
            mutetime: 0,
            locale: 0,
          },
          realms,
        }
      })
    )

    return accounts
  } catch (error) {
    console.error('Error loading accounts:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load accounts',
    })
  }
})
