/**
 * Dressing Room utility functions
 * Shared helpers for admin dressing room routes
 */
import { AccountMappingDB } from '#server/utils/db'

/**
 * Verify that a character belongs to one of the user's linked WoW accounts.
 * Used when a feature grant has ownAccountOnly=true.
 *
 * @param userId - External user ID (from auth)
 * @param characterAccountId - The WoW account ID that owns the character
 * @throws 403 if the character doesn't belong to the user's accounts
 */
export function verifyCharacterOwnership(userId: string, characterAccountId: number): void {
  const mappings = AccountMappingDB.findByExternalId(userId)
  const userAccountIds = mappings.map(m => m.wow_account_id)

  if (!userAccountIds.includes(characterAccountId)) {
    throw createError({
      statusCode: 403,
      statusMessage: 'Your feature grant only allows editing characters on your own account',
    })
  }
}
