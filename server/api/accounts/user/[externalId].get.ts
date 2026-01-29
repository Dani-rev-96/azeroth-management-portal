import { AccountMappingDB } from '#server/utils/db'
import { findRealmsWithCharacters } from '#server/services/realm'
import { getDirectAuthSession, isDirectAuthMode } from '#server/utils/auth'
import type { ManagedAccount, AccountMapping } from '~/types'

/**
 * GET /api/accounts/user/:externalId
 * Get all WoW accounts mapped to an external auth user
 *
 * In direct auth mode: Returns the WoW account from session (no mapping DB needed)
 * In external auth mode: Returns accounts from the mapping database
 */
export default defineEventHandler(async (event) => {
  const externalId = getRouterParam(event, 'externalId')

  if (!externalId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'External ID is required',
    })
  }

  try {
    const config = useRuntimeConfig()
    const authMode = config.public.authMode

    // In direct auth mode, return account data from session (no mapping DB needed)
    if (isDirectAuthMode()) {
      const session = await getDirectAuthSession(event)
      if (!session) {
        throw createError({
          statusCode: 401,
          statusMessage: 'Not authenticated',
        })
      }

      // Verify the externalId matches the session accountId (the unique identifier in direct mode)
      if (externalId !== String(session.accountId)) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Not authorized to view these accounts',
        })
      }

      // Create a synthetic account mapping from session data
      const mapping: AccountMapping = {
        externalId: String(session.accountId),
        displayName: session.username,
        email: session.email,
        wowAccountId: session.accountId,
        wowAccountName: session.username,
        createdAt: new Date().toISOString(),
        lastUsed: new Date().toISOString(),
      }

      // Find all realms with characters for this account
      const realms = await findRealmsWithCharacters(session.accountId)

      const account: ManagedAccount = {
        mapping,
        wowAccount: {
          id: session.accountId,
          username: session.username,
          sha_pass_hash: '',
          expansion: 2,
          mutetime: 0,
          locale: 0,
        },
        realms,
      }

      return [account]
    }

    // External auth mode: Get authenticated user ID
    const { getAuthenticatedUser } = await import('#server/utils/auth')
    const authenticatedUser = await getAuthenticatedUser(event)

    // Security check: verify the requested externalId matches authenticated user's ID
    if (externalId !== authenticatedUser.id) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Not authorized to view these accounts',
      })
    }

    // Get all mappings from SQLite database
    const dbMappings = AccountMappingDB.findByExternalId(externalId)

    // Transform to ManagedAccount objects with character data from all realms
    const accounts: ManagedAccount[] = await Promise.all(
      dbMappings.map(async (dbMapping) => {
        const mapping: AccountMapping = {
          externalId: dbMapping.external_id,
          displayName: dbMapping.display_name,
          email: dbMapping.email || undefined,
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
