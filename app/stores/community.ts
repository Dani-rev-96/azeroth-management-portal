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
  // Computed - Delegate to characters store
  // ==========================================================================

  /** Online players from characters store */
  const onlinePlayers = computed(() => charactersStore.onlinePlayers)

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

  function $reset() {
    generalStats.value = {}
    topPlayers.value = []
    pvpStats.value = {}
    selectedRealm.value = ''
    selectedClass.value = null
    selectedRace.value = null
    selectedMetric.value = 'level'
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
    setRealm,
    setClass,
    setRace,
    changeMetric,
    $reset,
  }
})
