/**
 * POST /api/auth/login
 * Direct WoW account login (only available when authMode='direct')
 *
 * This allows users to log in with their WoW account credentials directly,
 * without needing an external identity provider.
 */
import { verifyAccountCredentials, isAccountBanned } from '#server/services/account'
import { getGMAccess } from '#server/services/gm'
import { createDirectAuthSession, isDirectAuthMode } from '#server/utils/auth'

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()

  // Only allow direct login when in 'direct' auth mode
  if (!isDirectAuthMode()) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Direct login is not enabled. Use external authentication.',
    })
  }

  const body = await readBody(event)
  const { username, password } = body

  if (!username || !password) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username and password are required',
    })
  }

  try {
    // Verify WoW account credentials
    const account = await verifyAccountCredentials(username, password)

    if (!account) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Invalid username or password',
      })
    }

    // Check if account is banned
    const banned = await isAccountBanned(account.id)
    if (banned) {
      throw createError({
        statusCode: 403,
        statusMessage: 'This account has been banned',
      })
    }

    // Get GM level for this account
    const gmAccess = await getGMAccess(account.id)
    const gmLevel = gmAccess?.gmLevel || 0

    // Create session
    createDirectAuthSession(
      event,
      account.id,
      account.username,
      account.email || undefined,
      gmLevel
    )

    return {
      success: true,
      user: {
        sub: account.username, // Use username as the unique identifier
        preferred_username: account.username,
        email: account.email || '',
        email_verified: !!account.email,
        isGM: gmLevel > 0,
        gmLevel,
      },
    }
  } catch (error) {
    console.error('Login error:', error)
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Login failed',
    })
  }
})
