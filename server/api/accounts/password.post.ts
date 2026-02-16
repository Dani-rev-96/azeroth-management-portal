import { findAccountById } from '#server/services/account'
import { getAuthDbPool } from '#server/utils/mysql'
import { generateSrp6Credentials } from '#server/utils/srp6'
import { getAuthenticatedUser } from '#server/utils/auth'
import { AccountMappingDB } from '#server/utils/db'

/**
 * POST /api/accounts/password
 * Update WoW account password with SRP6 regeneration
 */
export default defineEventHandler(async (event) => {
  try {
    // Require authentication
    const user = await getAuthenticatedUser(event)

    const body = await readBody(event)
    const { accountId, newPassword } = body

    // Validation
    if (!accountId || typeof accountId !== 'number') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Valid account ID is required',
      })
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password must be at least 8 characters long',
      })
    }

    // Verify account ownership: user must own this account (via mapping or direct auth)
    const config = useRuntimeConfig()
    if (config.public.authMode === 'direct') {
      // In direct auth mode, the user ID is the account ID
      if (String(accountId) !== user.id) {
        throw createError({
          statusCode: 403,
          statusMessage: 'You can only change your own account password',
        })
      }
    } else {
      // In external auth modes, check the account mapping
      const mappings = AccountMappingDB.findByExternalId(user.id)
      const ownsAccount = mappings.some(m => m.wow_account_id === accountId)
      if (!ownsAccount) {
        throw createError({
          statusCode: 403,
          statusMessage: 'You can only change passwords for your own linked accounts',
        })
      }
    }

    // Verify account exists
    const account = await findAccountById(accountId)

    if (!account) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Account not found',
      })
    }

    // Generate new SRP6 credentials
    const { salt, verifier } = generateSrp6Credentials(account.username, newPassword)

    // Update the account in the database
    const pool = await getAuthDbPool()

    await pool.query(
      'UPDATE account SET salt = ?, verifier = ? WHERE id = ?',
      [salt, verifier, accountId]
    )

    console.log(`[✓] Password updated for account: ${account.username} (ID: ${accountId})`)

    return {
      success: true,
      message: 'Password updated successfully',
    }
  } catch (error) {
    console.error('Error updating password:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update password',
    })
  }
})
