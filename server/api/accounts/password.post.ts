import { findAccountById } from '#server/services/account'
import { getAuthDbPool } from '#server/utils/mysql'
import { generateSrp6Credentials } from '#server/utils/srp6'

/**
 * POST /api/accounts/password
 * Update WoW account password with SRP6 regeneration
 */
export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event)
    const { accountId, newPassword } = body

    // Validation
    if (!accountId || typeof accountId !== 'number') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Valid account ID is required',
      })
    }

    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 6) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password must be at least 6 characters long',
      })
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
