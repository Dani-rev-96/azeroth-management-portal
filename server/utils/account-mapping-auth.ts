/**
 * Authorization rules for the account mapping endpoints
 * (POST /api/accounts/map, DELETE /api/accounts/map/:externalId/:wowAccountId).
 * Pure functions so they can be unit-tested without h3/Nitro.
 */

export interface MappingDeleteCheck {
  /** Authenticated user id (getAuthenticatedUser().id) */
  userId: string
  isGM: boolean
  /** external_id of the mapping to delete */
  externalId: string
}

/** Owners may delete their own mappings; GMs may delete any mapping. */
export function canDeleteMapping({ userId, isGM, externalId }: MappingDeleteCheck): boolean {
  if (isGM) return true
  return userId !== '' && externalId === userId
}

/**
 * Resolves the external id a new mapping is created for: always the
 * authenticated user. Returns null when the body asks for someone else.
 */
export function resolveMappingExternalId(userId: string, requestedExternalId: unknown): string | null {
  if (requestedExternalId === undefined || requestedExternalId === null || requestedExternalId === '') {
    return userId
  }
  return requestedExternalId === userId ? userId : null
}
