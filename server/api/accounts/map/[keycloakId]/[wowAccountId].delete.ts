import { AccountMappingDB } from '#server/utils/db'

/**
 * DELETE /api/accounts/map/:keycloakId/:wowAccountId
 * Remove mapping between Keycloak user and WoW account
 */
export default defineEventHandler(async (event) => {
  const keycloakId = getRouterParam(event, 'keycloakId')
  const wowAccountIdStr = getRouterParam(event, 'wowAccountId')

  if (!keycloakId || !wowAccountIdStr) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing required parameters',
    })
  }

  const wowAccountId = parseInt(wowAccountIdStr, 10)
  if (isNaN(wowAccountId)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid WoW account ID',
    })
  }

  try {
    // Get authenticated user from headers
    const authenticatedUser = getHeader(event, 'x-remote-user')
    
    // Verify the mapping belongs to the authenticated user
    const mappings = AccountMappingDB.findByKeycloakId(keycloakId)
    const mapping = mappings.find(m => m.wow_account_id === wowAccountId)
    
    if (!mapping) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Account mapping not found',
      })
    }

    // Additional security check: verify keycloakId matches authenticated user
    if (authenticatedUser && mapping.keycloak_username !== authenticatedUser) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Not authorized to delete this mapping',
      })
    }

    // Delete the mapping from database
    const deleted = AccountMappingDB.delete(keycloakId, wowAccountId)
    
    if (!deleted) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete mapping',
      })
    }

    return {
      success: true,
      message: 'Account mapping removed',
    }
  } catch (error) {
    console.error('Error removing account mapping:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to remove account mapping',
    })
  }
})
