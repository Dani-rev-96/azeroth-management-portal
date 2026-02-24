import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Stub useAuthStore for characters store dependency
vi.stubGlobal('useAuthStore', () => ({
  user: { sub: 'test-user' },
}))

// Import stores after globals are set
const { useCommunityStore } = await import('../../../../app/stores/community')
const { useCharactersStore } = await import('../../../../app/stores/characters')

describe('Community Store', () => {
  let store: ReturnType<typeof useCommunityStore>
  let charStore: ReturnType<typeof useCharactersStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked($fetch).mockReset()
    charStore = useCharactersStore()
    store = useCommunityStore()
  })

  // ─── Initial State ──────────────────────────────────────────────────────────

  describe('initial state', () => {
    it('starts with empty stats', () => {
      expect(store.generalStats).toEqual({})
    })

    it('starts with empty top players', () => {
      expect(store.topPlayers).toEqual([])
    })

    it('starts with default metric "level"', () => {
      expect(store.selectedMetric).toBe('level')
    })

    it('starts with empty realm filter', () => {
      expect(store.selectedRealm).toBe('')
    })

    it('starts with null class/race filters', () => {
      expect(store.selectedClass).toBeNull()
      expect(store.selectedRace).toBeNull()
    })

    it('hasStatsData is false initially', () => {
      expect(store.hasStatsData).toBe(false)
    })
  })

  // ─── Online Players Filtering ───────────────────────────────────────────────

  describe('filteredOnlinePlayers', () => {
    beforeEach(() => {
      // Populate the characters store with online players
      charStore.onlinePlayers = [
        { guid: 1, characterName: 'Arthas', zoneName: 'Icecrown', realm: 'Lordaeron', realmId: 'r1' },
        { guid: 2, characterName: 'Thrall', zoneName: 'Orgrimmar', realm: 'Lordaeron', realmId: 'r1' },
        { guid: 3, characterName: 'Jaina', zoneName: 'Dalaran', realm: 'Icecrown', realmId: 'r2' },
      ] as any
    })

    it('returns all players when no search', () => {
      expect(store.onlinePlayersFilteredCount).toBe(3)
    })

    it('filters by character name', () => {
      store.setOnlinePlayersSearch('arthas')
      expect(store.onlinePlayersFilteredCount).toBe(1)
    })

    it('filters by zone name', () => {
      store.setOnlinePlayersSearch('dalaran')
      expect(store.onlinePlayersFilteredCount).toBe(1)
    })

    it('filters by realm name', () => {
      store.setOnlinePlayersSearch('icecrown')
      expect(store.onlinePlayersFilteredCount).toBe(2)
    })

    it('filters by guid', () => {
      store.setOnlinePlayersSearch('2')
      expect(store.onlinePlayersFilteredCount).toBe(1)
    })

    it('returns empty for non-matching search', () => {
      store.setOnlinePlayersSearch('nonexistent')
      expect(store.onlinePlayersFilteredCount).toBe(0)
    })

    it('is case insensitive', () => {
      store.setOnlinePlayersSearch('THRALL')
      expect(store.onlinePlayersFilteredCount).toBe(1)
    })
  })

  // ─── Online Players Pagination ──────────────────────────────────────────────

  describe('online players pagination', () => {
    beforeEach(() => {
      // Create 50 online players
      const players = Array.from({ length: 50 }, (_, i) => ({
        guid: i + 1,
        characterName: `Player${i + 1}`,
        zoneName: 'Zone',
        realm: 'Realm',
        realmId: 'r1',
      }))
      charStore.onlinePlayers = players as any
    })

    it('returns correct page size', () => {
      expect(store.onlinePlayers).toHaveLength(24) // default perPage
    })

    it('calculates total pages', () => {
      expect(store.onlinePlayersTotalPages).toBe(3) // 50 / 24 = 2.08 → 3
    })

    it('returns second page content', () => {
      store.setOnlinePlayersPage(2)
      expect(store.onlinePlayers).toHaveLength(24)
    })

    it('returns partial last page', () => {
      store.setOnlinePlayersPage(3)
      expect(store.onlinePlayers).toHaveLength(2) // 50 - 48 = 2
    })

    it('resets page to 1 on search', () => {
      store.setOnlinePlayersPage(2)
      store.setOnlinePlayersSearch('Player1')
      expect(store.onlinePlayersPage).toBe(1)
    })

    it('reports correct total counts', () => {
      expect(store.onlinePlayersTotalCount).toBe(50)
      expect(store.onlinePlayersFilteredCount).toBe(50)
    })
  })

  // ─── Filter Actions ─────────────────────────────────────────────────────────

  describe('filter actions', () => {
    it('setRealm updates selected realm', () => {
      store.setRealm('realm1')
      expect(store.selectedRealm).toBe('realm1')
    })

    it('setClass updates selected class', () => {
      store.setClass(5)
      expect(store.selectedClass).toBe(5)
    })

    it('setRace updates selected race', () => {
      store.setRace(3)
      expect(store.selectedRace).toBe(3)
    })

    it('resetOnlinePlayersFilters clears search and page', () => {
      store.setOnlinePlayersSearch('test')
      store.setOnlinePlayersPage(3)

      store.resetOnlinePlayersFilters()

      expect(store.onlinePlayersSearch).toBe('')
      expect(store.onlinePlayersPage).toBe(1)
    })
  })

  // ─── isLoading ──────────────────────────────────────────────────────────────

  describe('isLoading', () => {
    it('returns true when stats loading', () => {
      store.statsLoading = true
      expect(store.isLoading).toBe(true)
    })

    it('returns true when top players loading', () => {
      store.topPlayersLoading = true
      expect(store.isLoading).toBe(true)
    })

    it('returns true when pvp stats loading', () => {
      store.pvpStatsLoading = true
      expect(store.isLoading).toBe(true)
    })

    it('returns false when nothing is loading', () => {
      expect(store.isLoading).toBe(false)
    })
  })

  // ─── hasStatsData ───────────────────────────────────────────────────────────

  describe('hasStatsData', () => {
    it('returns true when generalStats has data', () => {
      store.generalStats = { accounts: { total: 10, online: 5 } }
      expect(store.hasStatsData).toBe(true)
    })
  })

  // ─── Directory Filters ──────────────────────────────────────────────────────

  describe('directory filters', () => {
    beforeEach(() => {
      vi.mocked($fetch).mockResolvedValue({ players: [], pagination: { page: 1, limit: 24, total: 0, totalPages: 0 } })
    })

    it('clearDirectoryFilters resets all filters', () => {
      store.directorySearch = 'test'
      store.directoryClassFilter = 5
      store.directoryRaceFilter = 2
      store.directoryZoneFilter = 100
      store.directoryMinLevel = 20
      store.directoryMaxLevel = 60
      store.directoryOnlineOnly = true
      store.directoryPage = 3

      store.clearDirectoryFilters()

      expect(store.directorySearch).toBe('')
      expect(store.directoryClassFilter).toBeNull()
      expect(store.directoryRaceFilter).toBeNull()
      expect(store.directoryZoneFilter).toBeNull()
      expect(store.directoryMinLevel).toBe(1)
      expect(store.directoryMaxLevel).toBe(80)
      expect(store.directoryOnlineOnly).toBe(false)
      expect(store.directoryPage).toBe(1)
    })
  })

  // ─── $reset ─────────────────────────────────────────────────────────────────

  describe('$reset', () => {
    it('resets all community state', () => {
      store.generalStats = { accounts: { total: 10, online: 5 } }
      store.topPlayers = [{ name: 'test' }] as any
      store.selectedRealm = 'r1'
      store.selectedClass = 5
      store.selectedRace = 3
      store.selectedMetric = 'playtime'
      store.onlinePlayersSearch = 'q'
      store.onlinePlayersPage = 3

      store.$reset()

      expect(store.generalStats).toEqual({})
      expect(store.topPlayers).toEqual([])
      expect(store.selectedRealm).toBe('')
      expect(store.selectedClass).toBeNull()
      expect(store.selectedRace).toBeNull()
      expect(store.selectedMetric).toBe('level')
      expect(store.onlinePlayersSearch).toBe('')
      expect(store.onlinePlayersPage).toBe(1)
    })
  })
})
