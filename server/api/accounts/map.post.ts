import { AccountMappingDB } from '#server/utils/db'
import { realms } from '#shared/utils/config'
import type { ManagedAccount, AccountMapping, RealmId } from '~/types'

/**
 * POST /api/accounts/map
 * Create mapping between Keycloak user and WoW account
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { keycloakId, wowAccountName, wowAccountPassword, realmId } = body

  if (!keycloakId || !wowAccountName || !wowAccountPassword || !realmId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: keycloakId, wowAccountName, wowAccountPassword, realmId',
    })
  }

  // Validate realm exists
  if (!realms[realmId as RealmId]) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid realm ID',
    })
  }

  try {
    // Get Keycloak username from auth headers
    const keycloakUsername = getHeader(event, 'x-remote-user') || keycloakId

    // TODO: Verify WoW account exists and password is correct
    // For now, we'll use a mock account ID
    // In production, query the WoW auth database
    const wowAccountId = Math.floor(Math.random() * 1000000) // TEMPORARY

    // Check if mapping already exists
    if (AccountMappingDB.exists(keycloakId, wowAccountId, realmId)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Account mapping already exists',
      })
    }

    // Create mapping in SQLite database
    const dbMapping = AccountMappingDB.create({
      keycloakId,
      keycloakUsername,
      wowAccountId,
      wowAccountUsername: wowAccountName,
      realmId,
    })

    // Transform to response format
    const realm = realms[realmId as RealmId]
    const mapping: AccountMapping = {
      keycloakId: dbMapping.keycloak_id,
      keycloakUsername: dbMapping.keycloak_username,
      wowAccountId: dbMapping.wow_account_id,
      wowAccountName: dbMapping.wow_account_username,
      realmId: dbMapping.realm_id as RealmId,
      createdAt: dbMapping.created_at,
    }

    const result: ManagedAccount = {
      mapping,
      realm,
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

    return result
  } catch (error) {
    console.error('Error creating account mapping:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create account mapping',
    })
  }
})
