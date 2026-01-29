/**
 * POST /api/admin/account-mappings
 * Create a new account mapping (GM only)
 *
 * Links an external user to a WoW account without requiring credentials
 */
import { getAuthenticatedGM } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    await getAuthenticatedGM(event)

    const body = await readBody(event)
    const { externalId, displayName, email, wowAccountId } = body

    // Validate required fields
    if (!externalId || typeof externalId !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'External ID is required',
      })
    }

    if (!displayName || typeof displayName !== 'string') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Display name is required',
      })
    }

    if (!wowAccountId || typeof wowAccountId !== 'number') {
      throw createError({
        statusCode: 400,
        statusMessage: 'WoW Account ID is required and must be a number',
      })
    }

    // Verify WoW account exists
    const { findAccountById } = await import('#server/services/account')
    const wowAccount = await findAccountById(wowAccountId)
    if (!wowAccount) {
      throw createError({
        statusCode: 404,
        statusMessage: `WoW account with ID ${wowAccountId} not found`,
      })
    }

    // Check if mapping already exists
    const { AccountMappingDB } = await import('#server/utils/db')
    if (AccountMappingDB.exists(externalId, wowAccountId)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This mapping already exists',
      })
    }

    // Create the mapping
    const mapping = AccountMappingDB.create({
      externalId,
      displayName,
      email: email || undefined,
      wowAccountId,
      wowAccountUsername: wowAccount.username,
    })

    return {
      message: `Successfully linked ${displayName} to WoW account ${wowAccount.username}`,
      mapping,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error creating account mapping:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create account mapping',
    })
  }
})
