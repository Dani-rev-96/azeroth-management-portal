/**
 * Realm Service
 * Server-side service for finding realms and characters across multiple realms
 */

import type { RealmId, WoWCharacter, RealmCharacterData, RealmConfig } from '~/types'
import { getCharactersByAccountId } from './character'
import { getRealms } from '#server/utils/config'

/**
 * Find all realms that have characters for the given account
 * @param accountId - WoW account ID
 * @returns Array of realm character data, only including realms with characters
 */
export async function findRealmsWithCharacters(accountId: number): Promise<RealmCharacterData[]> {
  const realmsRecord = getRealms()
  const results: RealmCharacterData[] = []

  // Query each realm for characters
  await Promise.all(
    Object.values(realmsRecord).map(async (realm) => {
      try {
        const characters = await getCharactersByAccountId(accountId, realm.id)

        // Only include realms that have characters
        if (characters.length > 0) {
          results.push({
            realm,
            characters,
          })
        }
      } catch (error) {
        console.error(`Failed to query characters for realm ${realm.id}:`, error)
        // Continue with other realms
      }
    })
  )

  return results
}

/**
 * Get the primary realm for an account (the one with most characters or highest level character)
 * @param realmData - Array of realm character data
 * @returns The primary realm config, or null if no characters exist
 */
export function getPrimaryRealm(realmData: RealmCharacterData[]): RealmConfig | null {
  if (realmData.length === 0) {
    return null
  }

  // Sort by number of characters, then by highest level character
  const sorted = [...realmData].sort((a, b) => {
    // First by character count
    if (b.characters.length !== a.characters.length) {
      return b.characters.length - a.characters.length
    }

    // Then by highest level character
    const maxLevelA = Math.max(...a.characters.map(c => c.level))
    const maxLevelB = Math.max(...b.characters.map(c => c.level))
    return maxLevelB - maxLevelA
  })

  return sorted[0].realm
}
