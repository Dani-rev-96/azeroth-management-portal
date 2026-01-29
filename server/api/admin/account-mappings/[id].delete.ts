/**
 * DELETE /api/admin/account-mappings/:id
 * Delete an account mapping by ID (GM only)
 */
import { getAuthenticatedGM } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    await getAuthenticatedGM(event)

    const id = getRouterParam(event, 'id')
    const mappingId = parseInt(id || '', 10)

    if (isNaN(mappingId)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid mapping ID',
      })
    }

    const { AccountMappingDB } = await import('#server/utils/db')

    // Get mapping details for the response message
    const mapping = AccountMappingDB.findById(mappingId)
    if (!mapping) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Mapping not found',
      })
    }

    // Delete the mapping
    const deleted = AccountMappingDB.deleteById(mappingId)
    if (!deleted) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete mapping',
      })
    }

    return {
      message: `Successfully unlinked ${mapping.display_name} from WoW account ${mapping.wow_account_username}`,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error deleting account mapping:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete account mapping',
    })
  }
})
