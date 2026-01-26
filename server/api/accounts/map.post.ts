import { AccountMappingDB } from '#server/utils/db'
import { verifyAccountCredentials } from '#server/services/account'
import { findRealmsWithCharacters } from '#server/services/realm'
import type { ManagedAccount, AccountMapping } from '~/types'

/**
 * POST /api/accounts/map
 * Create mapping between Keycloak user and WoW account
 * Verifies WoW account credentials before creating mapping
 * No realm selection needed - auth is shared across all realms
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  const { keycloakId, wowAccountName, wowAccountPassword } = body

  if (!keycloakId || !wowAccountName || !wowAccountPassword) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required fields: keycloakId, wowAccountName, wowAccountPassword',
    })
  }

  try {
    const config = useRuntimeConfig()
    const authMode = config.public.authMode

    // Get Keycloak username from auth headers or mock user
    let keycloakUsername: string
    if (authMode === 'mock') {
      keycloakUsername = config.public.mockUser || 'admin'
    } else {
      keycloakUsername = getHeader(event, 'x-remote-user') || keycloakId
    }

    // Verify WoW account credentials against AzerothCore database
    const wowAccount = await verifyAccountCredentials(wowAccountName, wowAccountPassword)
    
    if (!wowAccount) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid WoW account credentials. Please check your username and password.',
      })
    }

    // Check if mapping already exists
    if (AccountMappingDB.exists(keycloakId, wowAccount.id)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Account mapping already exists',
      })
    }

    // Create mapping in SQLite database
    const dbMapping = AccountMappingDB.create({
      keycloakId,
      keycloakUsername,
      wowAccountId: wowAccount.id,
      wowAccountUsername: wowAccount.username,
    })

    // Transform to response format
    const mapping: AccountMapping = {
      keycloakId: dbMapping.keycloak_id,
      keycloakUsername: dbMapping.keycloak_username,
      wowAccountId: dbMapping.wow_account_id,
      wowAccountName: dbMapping.wow_account_username,
      createdAt: dbMapping.created_at,
    }

    // Find all realms with characters for this account
    const realms = await findRealmsWithCharacters(wowAccount.id)

    const result: ManagedAccount = {
      mapping,
      wowAccount: {
        id: wowAccount.id,
        username: wowAccount.username,
        sha_pass_hash: '', // Don't expose hash
        email: wowAccount.email || undefined,
        last_login: wowAccount.last_login || undefined,
        last_ip: wowAccount.last_ip,
        expansion: wowAccount.expansion,
        mutetime: Number(wowAccount.mutetime),
        locale: wowAccount.locale,
      },
      realms,
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
