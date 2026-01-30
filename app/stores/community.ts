import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCharactersStore, type OnlinePlayer } from './characters'

export interface GeneralStats {
  accounts?: { total: number; online: number }
  characters?: { total: number; maxLevel: number }
  playtime?: { totalSeconds: number; totalHours: number; totalDays: number }
  factions?: { alliance: number; horde: number }
  classDistribution?: Record<number, number>
  raceDistribution?: Record<number, number>
}

export interface TopPlayer {
  guid: number
  name: string
  level: number
  race: number
  class: number
  playtime: number
  achievementCount: number
  totalKills: number
  realm: string
  realmId: string
}

export interface PvPStats {
  battlegrounds?: { total: number }
  arenas?: { total: number }
  topPlayers?: Array<{
    guid?: number
    name: string
    level: number
    race: number
    class: number
    honorPoints: number
    totalKills: number
    arenaPoints: number
    realm: string
    realmId: string
  }>
}

export interface DirectoryPlayer {
  guid: number
  name: string
  level: number
  race: number
  class: number
  playtime: number
  achievementCount: number
  totalKills: number
  online: boolean
  realm: string
  realmId: string
}

export interface DirectoryPagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export type LeaderboardMetric = 'level' | 'playtime' | 'achievements'

/**
 * Community Store
 *
 * Feature store for community page functionality.
 * Uses the characters store as single source of truth for online players.
 */
export const useCommunityStore = defineStore('community', () => {
  // Use characters store for online players data
  const charactersStore = useCharactersStore()

  // ==========================================================================
  // State - Server Config
  // ==========================================================================
  const realms = ref<Record<string, { name: string, id: string }>>({})
  const realmsLoading = ref(false)
  const realmsError = ref<string | undefined>(undefined)

  // ==========================================================================
  // State - General Stats
  // ==========================================================================
  const generalStats = ref<GeneralStats>({})
  const statsLoading = ref(false)
  const statsError = ref<string | undefined>(undefined)

  // ==========================================================================
  // State - Top Players
  // ==========================================================================
  const topPlayers = ref<TopPlayer[]>([])
  const topPlayersLoading = ref(false)
  const topPlayersError = ref<string | undefined>(undefined)
  const selectedMetric = ref<LeaderboardMetric>('level')

  // ==========================================================================
  // State - PvP Stats
  // ==========================================================================
  const pvpStats = ref<PvPStats>({})
  const pvpStatsLoading = ref(false)
  const pvpStatsError = ref<string | undefined>(undefined)

  // ==========================================================================
  // State - Filters
  // ==========================================================================
  const selectedRealm = ref<string>('')
  const selectedClass = ref<number | null>(null)
  const selectedRace = ref<number | null>(null)

  // ==========================================================================
  // State - Online Players Pagination & Search
  // ==========================================================================
  const onlinePlayersSearch = ref('')
  const onlinePlayersPage = ref(1)
  const onlinePlayersPerPage = ref(24) // 4x6 or 3x8 grid

  // ==========================================================================
  // State - Player Directory
  // ==========================================================================
  const directoryPlayers = ref<DirectoryPlayer[]>([])
  const directoryLoading = ref(false)
  const directoryError = ref<string | undefined>(undefined)
  const directorySearch = ref('')
  const directoryPage = ref(1)
  const directoryPerPage = ref(24)
  const directoryPagination = ref<DirectoryPagination>({
    page: 1,
    limit: 24,
    total: 0,
    totalPages: 0
  })
  const directoryClassFilter = ref<number | null>(null)
  const directoryRaceFilter = ref<number | null>(null)

  // ==========================================================================
  // Computed - Delegate to characters store
  // ==========================================================================

  /** All online players from characters store */
  const allOnlinePlayers = computed(() => charactersStore.onlinePlayers)

  /** Filtered online players based on search */
  const filteredOnlinePlayers = computed(() => {
    const search = onlinePlayersSearch.value.toLowerCase().trim()
    if (!search) {
      return allOnlinePlayers.value
    }
    return allOnlinePlayers.value.filter(player =>
      player.characterName.toLowerCase().includes(search) ||
      player.zoneName.toLowerCase().includes(search) ||
      player.guid.toString().includes(search) ||
      player.realm.toLowerCase().includes(search)
    )
  })

  /** Paginated online players for display */
  const onlinePlayers = computed(() => {
    const start = (onlinePlayersPage.value - 1) * onlinePlayersPerPage.value
    return filteredOnlinePlayers.value.slice(start, start + onlinePlayersPerPage.value)
  })

  /** Total pages for online players */
  const onlinePlayersTotalPages = computed(() =>
    Math.ceil(filteredOnlinePlayers.value.length / onlinePlayersPerPage.value)
  )

  /** Total filtered count */
  const onlinePlayersFilteredCount = computed(() => filteredOnlinePlayers.value.length)

  /** Total count */
  const onlinePlayersTotalCount = computed(() => allOnlinePlayers.value.length)

  /** Loading state from characters store */
  const onlinePlayersLoading = computed(() => charactersStore.onlinePlayersLoading)

  /** Error state from characters store */
  const onlinePlayersError = computed(() => charactersStore.onlinePlayersError)

  /** Online count from characters store */
  const onlineCount = computed(() => charactersStore.onlineCount)

  const isLoading = computed(() =>
    onlinePlayersLoading.value ||
    statsLoading.value ||
    topPlayersLoading.value ||
    pvpStatsLoading.value
  )

  const hasStatsData = computed(() => Object.keys(generalStats.value).length > 0)

  // ==========================================================================
  // Actions - Realms
  // ==========================================================================

  async function fetchRealms() {
    realmsLoading.value = true
    realmsError.value = undefined

    try {
      const data = await $fetch<Record<string, { name: string, id: string }>>('/api/realms')
      realms.value = data || {}
    } catch (error) {
      realmsError.value = 'Failed to fetch realms'
      console.error('Failed to fetch realms:', error)
    } finally {
      realmsLoading.value = false
    }
  }

  // ==========================================================================
  // Actions - Online Players (delegate to characters store)
  // ==========================================================================

  /**
   * Fetch online players - delegates to characters store
   */
  async function fetchOnlinePlayers() {
    await charactersStore.fetchOnlinePlayers()
  }

  // ==========================================================================
  // Actions - Stats
  // ==========================================================================

  async function fetchGeneralStats() {
    statsLoading.value = true
    statsError.value = undefined

    try {
      const params = new URLSearchParams()
      if (selectedRealm.value) params.append('realmId', selectedRealm.value)
      if (selectedClass.value) params.append('classId', String(selectedClass.value))
      if (selectedRace.value) params.append('raceId', String(selectedRace.value))

      const url = params.toString() ? `/api/community/stats?${params}` : '/api/community/stats'
      const data = await $fetch<GeneralStats>(url)
      generalStats.value = data || {}
    } catch (error) {
      statsError.value = 'Failed to fetch statistics'
      console.error('Failed to fetch general stats:', error)
    } finally {
      statsLoading.value = false
    }
  }

  async function fetchTopPlayers(metric: LeaderboardMetric = 'level') {
    topPlayersLoading.value = true
    topPlayersError.value = undefined

    try {
      const params = new URLSearchParams({
        metric,
        limit: '10'
      })
      if (selectedRealm.value) params.append('realmId', selectedRealm.value)
      if (selectedClass.value) params.append('classId', String(selectedClass.value))
      if (selectedRace.value) params.append('raceId', String(selectedRace.value))

      const data = await $fetch<TopPlayer[]>(`/api/community/top-players?${params}`)
      topPlayers.value = data || []
      selectedMetric.value = metric
    } catch (error) {
      topPlayersError.value = 'Failed to fetch top players'
      console.error('Failed to fetch top players:', error)
    } finally {
      topPlayersLoading.value = false
    }
  }

  async function fetchPvPStats() {
    pvpStatsLoading.value = true
    pvpStatsError.value = undefined

    try {
      const url = selectedRealm.value
        ? `/api/community/pvp-stats?realmId=${selectedRealm.value}`
        : '/api/community/pvp-stats'

      const data = await $fetch<PvPStats>(url)
      pvpStats.value = data || {}
    } catch (error) {
      pvpStatsError.value = 'Failed to fetch PvP stats'
      console.error('Failed to fetch PvP stats:', error)
    } finally {
      pvpStatsLoading.value = false
    }
  }

  async function fetchAllStats() {
    await Promise.all([
      fetchGeneralStats(),
      fetchTopPlayers(selectedMetric.value),
      fetchPvPStats()
    ])
  }

  function setRealm(realmId: string) {
    selectedRealm.value = realmId
  }

  function setClass(classId: number | null) {
    selectedClass.value = classId
  }

  function setRace(raceId: number | null) {
    selectedRace.value = raceId
  }

  function changeMetric(metric: LeaderboardMetric) {
    fetchTopPlayers(metric)
  }

  // ==========================================================================
  // Actions - Online Players Pagination & Search
  // ==========================================================================

  function setOnlinePlayersSearch(search: string) {
    onlinePlayersSearch.value = search
    onlinePlayersPage.value = 1 // Reset to first page on search
  }

  function setOnlinePlayersPage(page: number) {
    onlinePlayersPage.value = page
  }

  function resetOnlinePlayersFilters() {
    onlinePlayersSearch.value = ''
    onlinePlayersPage.value = 1
  }

  // ==========================================================================
  // Actions - Player Directory
  // ==========================================================================

  async function fetchDirectoryPlayers() {
    directoryLoading.value = true
    directoryError.value = undefined

    try {
      const params = new URLSearchParams()
      params.append('page', String(directoryPage.value))
      params.append('limit', String(directoryPerPage.value))
      if (selectedRealm.value) params.append('realmId', selectedRealm.value)
      if (directoryClassFilter.value) params.append('classId', String(directoryClassFilter.value))
      if (directoryRaceFilter.value) params.append('raceId', String(directoryRaceFilter.value))
      if (directorySearch.value) params.append('search', directorySearch.value)

      const response = await $fetch<{
        players: DirectoryPlayer[]
        pagination: DirectoryPagination
      }>(`/api/community/players?${params}`)

      directoryPlayers.value = response?.players || []
      directoryPagination.value = response?.pagination || {
        page: 1,
        limit: 24,
        total: 0,
        totalPages: 0
      }
    } catch (error) {
      directoryError.value = 'Failed to fetch players'
      console.error('Failed to fetch directory players:', error)
    } finally {
      directoryLoading.value = false
    }
  }

  function setDirectorySearch(search: string) {
    directorySearch.value = search
    directoryPage.value = 1
    fetchDirectoryPlayers()
  }

  function setDirectoryPage(page: number) {
    directoryPage.value = page
    fetchDirectoryPlayers()
  }

  function setDirectoryClassFilter(classId: number | null) {
    directoryClassFilter.value = classId
    directoryPage.value = 1
    fetchDirectoryPlayers()
  }

  function setDirectoryRaceFilter(raceId: number | null) {
    directoryRaceFilter.value = raceId
    directoryPage.value = 1
    fetchDirectoryPlayers()
  }

  function clearDirectoryFilters() {
    directorySearch.value = ''
    directoryClassFilter.value = null
    directoryRaceFilter.value = null
    directoryPage.value = 1
    fetchDirectoryPlayers()
  }

  function $reset() {
    // Reset stats
    generalStats.value = {}
    topPlayers.value = []
    pvpStats.value = {}
    selectedRealm.value = ''
    selectedClass.value = null
    selectedRace.value = null
    selectedMetric.value = 'level'

    // Reset online players pagination
    onlinePlayersSearch.value = ''
    onlinePlayersPage.value = 1

    // Reset directory
    directoryPlayers.value = []
    directorySearch.value = ''
    directoryPage.value = 1
    directoryClassFilter.value = null
    directoryRaceFilter.value = null
    directoryPagination.value = { page: 1, limit: 24, total: 0, totalPages: 0 }
  }

  return {
    // State - Realms
    realms,
    realmsLoading,
    realmsError,

    // State - Online Players (from characters store)
    onlinePlayers,
    onlinePlayersLoading,
    onlinePlayersError,
    onlineCount,
    // Online Players Pagination & Search
    onlinePlayersSearch,
    onlinePlayersPage,
    onlinePlayersPerPage,
    onlinePlayersTotalPages,
    onlinePlayersFilteredCount,
    onlinePlayersTotalCount,

    // State - Player Directory
    directoryPlayers,
    directoryLoading,
    directoryError,
    directorySearch,
    directoryPage,
    directoryPagination,
    directoryClassFilter,
    directoryRaceFilter,

    // State - Stats
    generalStats,
    statsLoading,
    statsError,
    topPlayers,
    topPlayersLoading,
    topPlayersError,
    selectedMetric,
    pvpStats,
    pvpStatsLoading,
    pvpStatsError,

    // State - Filters
    selectedRealm,
    selectedClass,
    selectedRace,

    // Getters
    isLoading,
    hasStatsData,

    // Actions
    fetchRealms,
    fetchOnlinePlayers,
    fetchGeneralStats,
    fetchTopPlayers,
    fetchPvPStats,
    fetchAllStats,
    fetchDirectoryPlayers,
    setRealm,
    setClass,
    setRace,
    changeMetric,
    setOnlinePlayersSearch,
    setOnlinePlayersPage,
    resetOnlinePlayersFilters,
    setDirectorySearch,
    setDirectoryPage,
    setDirectoryClassFilter,
    setDirectoryRaceFilter,
    clearDirectoryFilters,
    $reset,
  }
})
