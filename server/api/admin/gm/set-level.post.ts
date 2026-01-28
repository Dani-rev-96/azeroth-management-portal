/**
 * POST /api/admin/gm/set-level
 * Set GM level for an account (GM only)
 */
export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    const { username, gmLevel: currentGMLevel } = await getAuthenticatedGM(event)

    const body = await readBody(event)
    const { accountId, gmLevel, realmId, comment } = body

    // Validation
    if (!accountId || typeof accountId !== 'number') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Valid account ID is required',
      })
    }

    if (gmLevel === undefined || typeof gmLevel !== 'number' || gmLevel < 0 || gmLevel > 10) {
      throw createError({
        statusCode: 400,
        statusMessage: 'GM level must be a number between 0 and 10',
      })
    }

    // RealmID: -1 means all realms, or specific realm ID
    const targetRealmId = realmId !== undefined ? realmId : -1

    // Security check: prevent setting GM level higher than or equal to your own
    if (gmLevel >= currentGMLevel && gmLevel > 0) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Cannot set GM level higher than or equal to your own level',
      })
    }

    const { getAuthDbPool } = await import('#server/utils/mysql')
    const pool = await getAuthDbPool()

    // Check if account exists
    const { findAccountById } = await import('#server/services/account')
    const account = await findAccountById(accountId)

    if (!account) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Account not found',
      })
    }

    // Check if account already has access entry for this realm
    const [existingRows] = await pool.query(
      'SELECT * FROM account_access WHERE id = ? AND RealmID = ?',
      [accountId, targetRealmId]
    )

    if (gmLevel === 0) {
      // Remove GM access
      if ((existingRows as any[]).length > 0) {
        await pool.query(
          'DELETE FROM account_access WHERE id = ? AND RealmID = ?',
          [accountId, targetRealmId]
        )
        console.log(`[✓] Removed GM access for account ${account.username} (ID: ${accountId})`)
      }
    } else {
      // Add or update GM access
      if ((existingRows as any[]).length > 0) {
        // Update existing
        await pool.query(
          'UPDATE account_access SET gmlevel = ?, comment = ? WHERE id = ? AND RealmID = ?',
          [gmLevel, comment || null, accountId, targetRealmId]
        )
        console.log(`[✓] Updated GM level to ${gmLevel} for account ${account.username} (ID: ${accountId})`)
      } else {
        // Insert new
        await pool.query(
          'INSERT INTO account_access (id, gmlevel, RealmID, comment) VALUES (?, ?, ?, ?)',
          [accountId, gmLevel, targetRealmId, comment || null]
        )
        console.log(`[✓] Set GM level to ${gmLevel} for account ${account.username} (ID: ${accountId})`)
      }
    }

    return {
      success: true,
      message: gmLevel === 0
        ? 'GM access removed successfully'
        : `GM level set to ${gmLevel} successfully`,
      accountId,
      gmLevel,
      realmId: targetRealmId,
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      throw error
    }

    console.error('Error setting GM level:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to set GM level',
    })
  }
})
