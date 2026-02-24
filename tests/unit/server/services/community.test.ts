import { describe, it, expect } from 'vitest'

// ─── Community Service: Aggregation Logic ───────────────────────────────────────

// Test the pure aggregation patterns used in community.ts

describe('Community: Stats Aggregation', () => {
  interface GeneralStats {
    accounts: { total: number; online: number }
    characters: { total: number; maxLevel: number }
    playtime: { totalSeconds: number }
    factions: { alliance: number; horde: number }
  }

  function aggregateStats(realmStats: GeneralStats[]): GeneralStats {
    return realmStats.reduce(
      (acc, stats) => ({
        accounts: {
          total: acc.accounts.total + stats.accounts.total,
          online: acc.accounts.online + stats.accounts.online,
        },
        characters: {
          total: acc.characters.total + stats.characters.total,
          maxLevel: Math.max(acc.characters.maxLevel, stats.characters.maxLevel),
        },
        playtime: {
          totalSeconds: acc.playtime.totalSeconds + stats.playtime.totalSeconds,
        },
        factions: {
          alliance: acc.factions.alliance + stats.factions.alliance,
          horde: acc.factions.horde + stats.factions.horde,
        },
      }),
      {
        accounts: { total: 0, online: 0 },
        characters: { total: 0, maxLevel: 0 },
        playtime: { totalSeconds: 0 },
        factions: { alliance: 0, horde: 0 },
      }
    )
  }

  it('aggregates single realm', () => {
    const result = aggregateStats([
      {
        accounts: { total: 100, online: 10 },
        characters: { total: 200, maxLevel: 80 },
        playtime: { totalSeconds: 5000 },
        factions: { alliance: 120, horde: 80 },
      },
    ])
    expect(result.accounts.total).toBe(100)
    expect(result.characters.total).toBe(200)
    expect(result.factions.alliance).toBe(120)
  })

  it('aggregates multiple realms by summing', () => {
    const result = aggregateStats([
      {
        accounts: { total: 100, online: 5 },
        characters: { total: 200, maxLevel: 80 },
        playtime: { totalSeconds: 5000 },
        factions: { alliance: 120, horde: 80 },
      },
      {
        accounts: { total: 50, online: 3 },
        characters: { total: 100, maxLevel: 70 },
        playtime: { totalSeconds: 3000 },
        factions: { alliance: 60, horde: 40 },
      },
    ])
    expect(result.accounts.total).toBe(150)
    expect(result.accounts.online).toBe(8)
    expect(result.characters.total).toBe(300)
    expect(result.characters.maxLevel).toBe(80) // max, not sum
    expect(result.playtime.totalSeconds).toBe(8000)
    expect(result.factions.alliance).toBe(180)
    expect(result.factions.horde).toBe(120)
  })

  it('returns zeros for empty input', () => {
    const result = aggregateStats([])
    expect(result.accounts.total).toBe(0)
    expect(result.characters.total).toBe(0)
    expect(result.playtime.totalSeconds).toBe(0)
  })
})

// ─── Pagination Logic ───────────────────────────────────────────────────────────

describe('Community: Pagination', () => {
  function paginate<T>(items: T[], page: number, limit: number) {
    const total = items.length
    const totalPages = Math.ceil(total / limit)
    const start = (page - 1) * limit
    const end = start + limit
    return {
      items: items.slice(start, end),
      pagination: { page, limit, total, totalPages },
    }
  }

  it('returns first page', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result = paginate(items, 1, 3)
    expect(result.items).toEqual([1, 2, 3])
    expect(result.pagination.page).toBe(1)
    expect(result.pagination.total).toBe(10)
    expect(result.pagination.totalPages).toBe(4) // ceil(10/3) = 4
  })

  it('returns middle page', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result = paginate(items, 2, 3)
    expect(result.items).toEqual([4, 5, 6])
  })

  it('returns last page (partial)', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const result = paginate(items, 4, 3)
    expect(result.items).toEqual([10])
  })

  it('returns empty for page beyond range', () => {
    const items = [1, 2, 3]
    const result = paginate(items, 5, 3)
    expect(result.items).toEqual([])
  })

  it('handles empty items', () => {
    const result = paginate([], 1, 10)
    expect(result.items).toEqual([])
    expect(result.pagination.total).toBe(0)
    expect(result.pagination.totalPages).toBe(0)
  })

  it('handles limit larger than items', () => {
    const items = [1, 2, 3]
    const result = paginate(items, 1, 100)
    expect(result.items).toEqual([1, 2, 3])
    expect(result.pagination.totalPages).toBe(1)
  })
})

// ─── Search Filtering ───────────────────────────────────────────────────────────

describe('Community: Search Filtering', () => {
  interface Player {
    name: string
    class: number
    race: number
    level: number
  }

  const players: Player[] = [
    { name: 'Arthas', class: 6, race: 1, level: 80 },
    { name: 'Thrall', class: 7, race: 2, level: 80 },
    { name: 'Jaina', class: 8, race: 1, level: 75 },
    { name: 'Sylvanas', class: 3, race: 5, level: 80 },
  ]

  function filterPlayers(players: Player[], search?: string, classId?: number): Player[] {
    let filtered = players
    if (search) {
      const lowerSearch = search.toLowerCase()
      filtered = filtered.filter(p => p.name.toLowerCase().includes(lowerSearch))
    }
    if (classId) {
      filtered = filtered.filter(p => p.class === classId)
    }
    return filtered
  }

  it('returns all players with no filter', () => {
    expect(filterPlayers(players)).toHaveLength(4)
  })

  it('filters by name (case-insensitive)', () => {
    expect(filterPlayers(players, 'arthas')).toHaveLength(1)
    expect(filterPlayers(players, 'ARTHAS')).toHaveLength(1)
  })

  it('filters by class', () => {
    expect(filterPlayers(players, undefined, 8)).toHaveLength(1)
    expect(filterPlayers(players, undefined, 8)[0].name).toBe('Jaina')
  })

  it('filters by both name and class', () => {
    expect(filterPlayers(players, 'a', 6)).toHaveLength(1) // Arthas, DK
    expect(filterPlayers(players, 'a', 8)).toHaveLength(1) // Jaina, Mage
  })

  it('returns empty for no match', () => {
    expect(filterPlayers(players, 'NonExistent')).toHaveLength(0)
  })

  it('handles partial name match', () => {
    expect(filterPlayers(players, 'thr')).toHaveLength(1) // Thrall
  })
})
