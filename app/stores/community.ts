import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

// Types
export interface OnlinePlayer {
  guid: number
  characterName: string
  level: number
  race: number
  class: number
  zone: number
  accountName: string
  realm: string
  realmId: string
  playtime: number
}

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

export interface ServerConfig {
  realms: Record<string, { name: string }>
}

export const useCommunityStore = defineStore('community', () => {
  // State - Server Config
  const realms = ref<Record<string, { name: string }>>({})
  const realmsLoading = ref(false)
  const realmsError = ref<string | undefined>(undefined)

  // State - Online Players
  const onlinePlayers = ref<OnlinePlayer[]>([])
  const onlinePlayersLoading = ref(false)
  const onlinePlayersError = ref<string | undefined>(undefined)

  // State - General Stats
  const generalStats = ref<GeneralStats>({})
  const statsLoading = ref(false)
  const statsError = ref<string | undefined>(undefined)

  // State - Top Players
  const topPlayers = ref<TopPlayer[]>([])
  const topPlayersLoading = ref(false)
  const topPlayersError = ref<string | undefined>(undefined)
  const selectedMetric = ref<LeaderboardMetric>('level')

  // State - PvP Stats
  const pvpStats = ref<PvPStats>({})
  const pvpStatsLoading = ref(false)
  const pvpStatsError = ref<string | undefined>(undefined)

  // State - Filters
  const selectedRealm = ref<string>('')

  // Getters
  const onlineCount = computed(() => onlinePlayers.value.length)

  const isLoading = computed(() =>
    onlinePlayersLoading.value ||
    statsLoading.value ||
    topPlayersLoading.value ||
    pvpStatsLoading.value
  )

  const hasStatsData = computed(() => Object.keys(generalStats.value).length > 0)

  // Actions
  async function fetchRealms() {
    realmsLoading.value = true
    realmsError.value = undefined

    try {
      const data = await $fetch<ServerConfig>('/api/realms')
      realms.value = data?.realms || {}
    } catch (error) {
      realmsError.value = 'Failed to fetch realms'
      console.error('Failed to fetch realms:', error)
    } finally {
      realmsLoading.value = false
    }
  }

  async function fetchOnlinePlayers() {
    onlinePlayersLoading.value = true
    onlinePlayersError.value = undefined

    try {
      const data = await $fetch<OnlinePlayer[]>('/api/community/online')
      onlinePlayers.value = data || []
    } catch (error) {
      onlinePlayersError.value = 'Failed to fetch online players'
      console.error('Failed to fetch online players:', error)
    } finally {
      onlinePlayersLoading.value = false
    }
  }

  async function fetchGeneralStats() {
    statsLoading.value = true
    statsError.value = undefined

    try {
      const url = selectedRealm.value
        ? `/api/community/stats?realmId=${selectedRealm.value}`
        : '/api/community/stats'

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
      if (selectedRealm.value) {
        params.append('realmId', selectedRealm.value)
      }

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

  function changeMetric(metric: LeaderboardMetric) {
    fetchTopPlayers(metric)
  }

  function $reset() {
    onlinePlayers.value = []
    generalStats.value = {}
    topPlayers.value = []
    pvpStats.value = {}
    selectedRealm.value = ''
    selectedMetric.value = 'level'
  }

  return {
    // State
    realms,
    realmsLoading,
    realmsError,
    onlinePlayers,
    onlinePlayersLoading,
    onlinePlayersError,
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
    selectedRealm,
    // Getters
    onlineCount,
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
    changeMetric,
    $reset,
  }
})
