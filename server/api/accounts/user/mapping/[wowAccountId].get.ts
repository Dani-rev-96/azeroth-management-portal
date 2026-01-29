import { getAuthenticatedUser, isDirectAuthMode, getDirectAuthSession } from '#server/utils/auth'
import type { ManagedAccount, AccountMapping } from '~/types'

/**
 * GET /api/accounts/user/mapping/:wowAccountId
 * Get account mapping and character data for a WoW account
 * Requires: User owns the account OR user is a GM
 */
export default defineEventHandler(async (event) => {
  // Require authentication
  const authenticatedUser = await getAuthenticatedUser(event)

  const wowAccountId = getRouterParam(event, 'wowAccountId')

  if (!wowAccountId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'WoW Account ID is required',
    })
  }

  const accountIdNum = Number(wowAccountId)
  if (isNaN(accountIdNum)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid WoW Account ID',
    })
  }

  try {
    // Check if user is GM
    let isGM = false
    try {
      const { getAuthenticatedGM } = await import('#server/utils/auth')
      await getAuthenticatedGM(event)
      isGM = true
    } catch {
      // Not a GM, need to check ownership
    }

    // If not GM, verify ownership
    if (!isGM) {
      // In direct auth mode, verify ownership from session
      if (isDirectAuthMode()) {
        const session = await getDirectAuthSession(event)
        if (!session || session.accountId !== accountIdNum) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Access denied',
          })
        }
      } else {
        // In external auth mode, verify via mapping database
        const { getDatabase } = await import('#server/utils/db')
        const db = getDatabase()
        const stmt = db.prepare(
          'SELECT external_id FROM account_mappings WHERE wow_account_id = ?'
        )
        const dbMapping = stmt.get(accountIdNum) as { external_id: string } | undefined

        if (!dbMapping || dbMapping.external_id !== authenticatedUser.id) {
          throw createError({
            statusCode: 403,
            statusMessage: 'Access denied',
          })
        }
      }
    }

    // Fetch account data from AzerothCore
    const { findAccountById } = await import('#server/services/account')
    const account = await findAccountById(accountIdNum)

    if (!account) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Account not found',
      })
    }

    // Fetch characters from all realms
    const { findRealmsWithCharacters } = await import('#server/services/realm')
    const realms = await findRealmsWithCharacters(accountIdNum)

    // Build mapping based on auth mode
    let mapping: AccountMapping

    if (isDirectAuthMode()) {
      // In direct mode, create synthetic mapping from session
      const session = await getDirectAuthSession(event)
      mapping = {
        // Use account ID as the unique external identifier in direct mode
        externalId: String(session?.accountId || account.id),
        displayName: session?.username || account.username,
        email: session?.email,
        wowAccountId: account.id,
        wowAccountName: account.username,
        createdAt: account.joindate,
        lastUsed: account.last_login || undefined,
      }
    } else {
      // In external auth mode, get mapping from database (optional for GM)
      const { getDatabase } = await import('#server/utils/db')
      const db = getDatabase()
      const mappingStmt = db.prepare(
        'SELECT * FROM account_mappings WHERE wow_account_id = ?'
      )
      const dbMapping = mappingStmt.get(accountIdNum) as any

      // Build mapping from database or from account data
      mapping = dbMapping ? {
        externalId: dbMapping.external_id,
        displayName: dbMapping.display_name,
        email: dbMapping.email || undefined,
        wowAccountId: dbMapping.wow_account_id,
        wowAccountName: dbMapping.wow_account_username,
        createdAt: dbMapping.created_at,
        lastUsed: dbMapping.last_used || undefined,
      } : {
        externalId: '',
        displayName: '',
        wowAccountId: account.id,
        wowAccountName: account.username,
        createdAt: account.joindate,
        lastUsed: account.last_login || undefined,
      }
    }

    const accountData: ManagedAccount = {
      mapping,
      wowAccount: {
        id: account.id,
        username: account.username,
        sha_pass_hash: '',
        expansion: account.expansion,
        mutetime: account.mutetime,
        locale: account.locale,
      },
      realms,
    }

    return accountData
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error fetching account mapping:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch account data',
    })
  }
})
