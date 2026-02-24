import { describe, it, expect } from 'vitest'

// ─── getPrimaryRealm (pure function from realm.ts) ──────────────────────────────

// Recreated for isolated testing since the module imports from mysql/config

interface RealmConfig {
  id: string
  name: string
  description: string
  dbHost: string
  dbPort: number
  dbUser: string
  dbPassword: string
}

interface WoWCharacter {
  guid: number
  name: string
  level: number
  [key: string]: any
}

interface RealmCharacterData {
  realm: RealmConfig
  characters: WoWCharacter[]
}

function getPrimaryRealm(realmData: RealmCharacterData[]): RealmConfig | null {
  if (realmData.length === 0) {
    return null
  }

  const sorted = [...realmData].sort((a, b) => {
    if (b.characters.length !== a.characters.length) {
      return b.characters.length - a.characters.length
    }

    const maxLevelA = Math.max(...a.characters.map(c => c.level))
    const maxLevelB = Math.max(...b.characters.map(c => c.level))
    return maxLevelB - maxLevelA
  })

  return sorted[0].realm
}

const makeRealm = (id: string, name: string): RealmConfig => ({
  id, name, description: '', dbHost: 'localhost', dbPort: 3306, dbUser: 'acore', dbPassword: 'acore',
})

const makeChar = (name: string, level: number): WoWCharacter => ({
  guid: Math.random() * 10000 | 0, name, level, race: 1, class: 1, gender: 0, xp: 0, money: 0,
  skin: 0, face: 0, hairStyle: 0, hairColor: 0, facialStyle: 0, flags: 0,
})

describe('getPrimaryRealm', () => {
  it('returns null for empty data', () => {
    expect(getPrimaryRealm([])).toBeNull()
  })

  it('returns the only realm when single realm', () => {
    const realm = makeRealm('1', 'Test Realm')
    const data: RealmCharacterData[] = [
      { realm, characters: [makeChar('Hero', 80)] },
    ]
    expect(getPrimaryRealm(data)).toBe(realm)
  })

  it('prefers realm with more characters', () => {
    const realm1 = makeRealm('1', 'Realm One')
    const realm2 = makeRealm('2', 'Realm Two')
    const data: RealmCharacterData[] = [
      { realm: realm1, characters: [makeChar('A', 80)] },
      { realm: realm2, characters: [makeChar('B', 60), makeChar('C', 40), makeChar('D', 20)] },
    ]
    expect(getPrimaryRealm(data)!.id).toBe('2')
  })

  it('breaks tie by highest level character', () => {
    const realm1 = makeRealm('1', 'Realm One')
    const realm2 = makeRealm('2', 'Realm Two')
    const data: RealmCharacterData[] = [
      { realm: realm1, characters: [makeChar('A', 40)] },
      { realm: realm2, characters: [makeChar('B', 80)] },
    ]
    // Same number of characters (1 each), realm2 has higher max level
    expect(getPrimaryRealm(data)!.id).toBe('2')
  })

  it('handles three realms', () => {
    const realm1 = makeRealm('1', 'Low')
    const realm2 = makeRealm('2', 'Medium')
    const realm3 = makeRealm('3', 'Main')
    const data: RealmCharacterData[] = [
      { realm: realm1, characters: [makeChar('A', 20)] },
      { realm: realm2, characters: [makeChar('B', 50), makeChar('C', 45)] },
      { realm: realm3, characters: [makeChar('D', 80), makeChar('E', 70), makeChar('F', 60)] },
    ]
    expect(getPrimaryRealm(data)!.id).toBe('3')
  })

  it('does not mutate input array', () => {
    const realm1 = makeRealm('1', 'First')
    const realm2 = makeRealm('2', 'Second')
    const data: RealmCharacterData[] = [
      { realm: realm1, characters: [makeChar('A', 10)] },
      { realm: realm2, characters: [makeChar('B', 80), makeChar('C', 70)] },
    ]
    const original = [...data]
    getPrimaryRealm(data)
    expect(data).toEqual(original)
  })
})
