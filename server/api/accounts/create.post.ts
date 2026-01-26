/**
 * POST /api/accounts/create
 * Create a new WoW account in the AzerothCore auth database
 */
import { createAccount } from '#server/services/account'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const { username, password, email } = body

  // Validation
  if (!username || typeof username !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username is required',
    })
  }

  if (!password || typeof password !== 'string') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password is required',
    })
  }

  // Username validation (AzerothCore requirements)
  if (username.length < 3 || username.length > 16) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username must be between 3 and 16 characters',
    })
  }

  if (!/^[a-zA-Z0-9]+$/.test(username)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Username can only contain letters and numbers',
    })
  }

  // Password validation
  if (password.length < 8) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Password must be at least 8 characters',
    })
  }

  // Email validation (optional)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid email format',
    })
  }

  try {
    const account = await createAccount(username, password, email)

    console.log(`[✓] Account created: ${account.username} (ID: ${account.id})`)

    return {
      success: true,
      account: {
        id: account.id,
        username: account.username,
        email: account.email,
        expansion: account.expansion,
        joindate: account.joindate,
      },
    }
  } catch (error) {
    console.error('Account creation error:', error)
    
    if (error instanceof Error && error.message === 'Account already exists') {
      throw createError({
        statusCode: 409,
        statusMessage: 'An account with this username already exists',
      })
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create account',
    })
  }
})
