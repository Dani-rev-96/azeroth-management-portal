import { findAccountById } from '#server/services/account'
import type { AzerothCoreAccount } from '~/types'

/**
 * GET /api/accounts/detail/:accountId
 * Get detailed AzerothCore account information
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
