import { findAccountById } from '#server/services/account'
import type { AzerothCoreAccount } from '~/types'
import { getAuthenticatedUser, getAuthenticatedGM } from '#server/utils/auth'

/**
 * GET /api/accounts/detail/:accountId
 * Get detailed AzerothCore account information
 * Requires: User owns the account OR user is a GM
 */
export default defineEventHandler(async (event) => {
  const accountId = getRouterParam(event, 'accountId')

  if (!accountId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Account ID is required',
    })
  }

  try {
    const accountIdNum = Number(accountId)

    if (isNaN(accountIdNum)) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid account ID',
      })
    }

    // Check authentication
    const authenticatedUser = await getAuthenticatedUser(event)

    // Check if user is GM
    let isGM = false
    try {
      await getAuthenticatedGM(event)
      isGM = true
    } catch {
      // Not a GM, that's okay
    }

    // If not GM, check if user owns this account
    if (!isGM) {
      const { getDatabase } = await import('#server/utils/db')
      const db = getDatabase()

      const stmt = db.prepare(
        'SELECT keycloak_id FROM account_mappings WHERE wow_account_id = ?'
      )
      const mapping = stmt.get(accountIdNum) as { keycloak_id: string } | undefined

      if (!mapping || mapping.keycloak_id !== authenticatedUser.username) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Access denied',
        })
      }
    }

    // Get account details from AzerothCore database
    const account = await findAccountById(accountIdNum)

    if (!account) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Account not found',
      })
    }

    // Return account data (without sensitive fields like salt/verifier)
    const safeAccount: AzerothCoreAccount = {
      id: account.id,
      username: account.username,
      salt: '', // Don't expose salt
      verifier: '', // Don't expose verifier
      email: account.email,
      joindate: account.joindate,
      last_ip: account.last_ip,
      last_login: account.last_login,
      online: account.online,
      expansion: account.expansion,
      mutetime: account.mutetime,
      locale: account.locale,
    }

    return safeAccount
  } catch (error) {
    console.error('Error fetching account details:', error)

    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch account details',
    })
  }
})
