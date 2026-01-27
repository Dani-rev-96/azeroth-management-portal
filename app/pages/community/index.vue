<template>
  <div class="community-page">
    <header class="page-header">
      <div class="header-content">
        <h1>Community Hub</h1>
      </div>
    </header>

    <!-- Tabs -->
    <nav class="tabs">
      <button
        :class="{ active: activeTab === 'online' }"
        @click="activeTab = 'online'"
      >
        👥 Online Players
      </button>
      <button
        :class="{ active: activeTab === 'stats' }"
        @click="activeTab = 'stats'"
      >
        📊 Player Stats
      </button>
    </nav>

    <!-- Online Players Tab -->
    <main v-if="activeTab === 'online'" class="tab-content">
      <section class="content-section">
        <div class="section-header">
          <h2>Who's Online Right Now</h2>
          <button @click="refreshOnlinePlayers" class="refresh-btn" :disabled="loading">
            🔄 Refresh
          </button>
        </div>

        <div v-if="loading" class="loading">
          <p>Loading online players...</p>
        </div>

        <div v-else-if="onlinePlayers.length === 0" class="empty-state">
          <p>No players are currently online</p>
        </div>

        <div v-else class="players-grid">
          <NuxtLink
            v-for="player in onlinePlayers"
            :key="`${player.realm}-${player.characterName}`"
            :to="`/character/${player.guid}/${player.realmId}`"
            class="player-card"
          >
            <div class="player-header">
              <h3>{{ player.characterName }}</h3>
              <span class="level-badge">Level {{ player.level }}</span>
            </div>
            <div class="player-info">
              <p class="realm">{{ player.realm }}</p>
              <p class="class-race">{{ getRaceClassName(player.race) }} {{ getClassClassName(player.class) }}</p>
              <p class="zone">{{ getZoneName(player.zone) }}</p>
              <p class="playtime">⏱️ {{ formatPlaytime(player.playtime) }}</p>
            </div>
          </NuxtLink>
        </div>
      </section>
    </main>

    <!-- Stats Tab -->
    <main v-if="activeTab === 'stats'" class="tab-content">
      <!-- Realm Filter -->
      <div class="realm-filter">
        <label for="realm-select">Filter by Realm:</label>
        <select id="realm-select" v-model="selectedRealm" @change="handleRealmChange" class="realm-select">
          <option value="">All Realms</option>
          <option v-for="(realm, id) in realms" :key="id" :value="id">
            {{ realm.name }}
          </option>
        </select>
      </div>

      <!-- General Statistics Component -->
      <StatsOverview
        :stats="generalStats"
        :loading="statsLoading"
        @refresh="refreshStats"
      />

      <!-- Class Distribution Component -->
      <DistributionChart
        title="Class Distribution"
        icon="🎯"
        :distribution="generalStats.classDistribution || {}"
        :total-characters="generalStats.characters?.total || 0"
        type="class"
      />

      <!-- Race Distribution Component -->
      <DistributionChart
        title="Race Distribution"
        icon="🌍"
        :distribution="generalStats.raceDistribution || {}"
        :total-characters="generalStats.characters?.total || 0"
        type="race"
      />

      <!-- Top Players Leaderboard Component -->
      <TopPlayersLeaderboard
        :players="topPlayers"
        :loading="topPlayersLoading"
        :selected-metric="selectedMetric"
        :metric-label="getMetricLabel()"
        @change-metric="changeMetric"
      />

      <!-- PvP Statistics Component -->
      <PvPStatistics
        :stats="pvpStats"
        :loading="pvpStatsLoading"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import DistributionChart from '~/components/community/DistributionChart.vue'
import StatsOverview from '~/components/community/StatsOverview.vue'
import TopPlayersLeaderboard from '~/components/community/TopPlayersLeaderboard.vue'
import PvPStatistics from '~/components/community/PvPStatistics.vue'
import { onMounted, onUnmounted, ref, watch } from 'vue'

interface OnlinePlayer {
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

interface GeneralStats {
  accounts?: { total: number; online: number }
  characters?: { total: number; maxLevel: number }
  playtime?: { totalSeconds: number; totalHours: number; totalDays: number }
  factions?: { alliance: number; horde: number }
  classDistribution?: Record<number, number>
  raceDistribution?: Record<number, number>
}

interface TopPlayer {
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

interface PvPStats {
  battlegrounds?: { total: number }
  arenas?: { total: number }
  topPlayers?: Array<{
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

const activeTab = ref('online')
const loading = ref(false)
const onlinePlayers = ref<OnlinePlayer[]>([])

// Stats data
const statsLoading = ref(false)
const generalStats = ref<GeneralStats>({})
const topPlayersLoading = ref(false)
const topPlayers = ref<TopPlayer[]>([])
const selectedMetric = ref('level')
const pvpStatsLoading = ref(false)
const pvpStats = ref<PvPStats>({})

// Realm filtering
const selectedRealm = ref('')
const realms = ref<Record<string, any>>({})

// Load realm configuration
const config = await useServerConfig()
realms.value = config.realms

// Fetch online players (initial load with useFetch)
async function fetchOnlinePlayers() {
  loading.value = true
  try {
    const { data } = await useFetch('/api/community/online')
    onlinePlayers.value = (data.value as any) || []
  } catch (error) {
    console.error('Failed to fetch online players:', error)
  } finally {
    loading.value = false
  }
}

// Refresh online players (client-side with $fetch)
async function refreshOnlinePlayers() {
  loading.value = true
  try {
    const data = await $fetch('/api/community/online')
    onlinePlayers.value = data || []
  } catch (error) {
    console.error('Failed to refresh online players:', error)
  } finally {
    loading.value = false
  }
}

// Fetch general statistics
async function fetchGeneralStats(useClient = false) {
  statsLoading.value = true
  try {
    const url = selectedRealm.value
      ? `/api/community/stats?realmId=${selectedRealm.value}`
      : '/api/community/stats'

    if (useClient) {
      const data = await $fetch(url)
      generalStats.value = data || {}
    } else {
      const { data } = await useFetch(url)
      generalStats.value = (data.value as any) || {}
    }
  } catch (error) {
    console.error('Failed to fetch general stats:', error)
  } finally {
    statsLoading.value = false
  }
}

// Fetch top players
async function fetchTopPlayers(metric: string = 'level', useClient = false) {
  topPlayersLoading.value = true
  try {
    const params = new URLSearchParams({
      metric,
      limit: '10'
    })
    if (selectedRealm.value) {
      params.append('realmId', selectedRealm.value)
    }

    if (useClient) {
      const data = await $fetch<TopPlayer[]>(`/api/community/top-players?${params}`)
      topPlayers.value = data || []
    } else {
      const { data } = await useFetch<TopPlayer[]>(`/api/community/top-players?${params}`)
      topPlayers.value = data.value || []
    }
  } catch (error) {
    console.error('Failed to fetch top players:', error)
  } finally {
    topPlayersLoading.value = false
  }
}

// Fetch PvP statistics
async function fetchPvPStats(useClient = false) {
  pvpStatsLoading.value = true
  try {
    const url = selectedRealm.value
      ? `/api/community/pvp-stats?realmId=${selectedRealm.value}`
      : '/api/community/pvp-stats'

    if (useClient) {
      const data = await $fetch(url)
      pvpStats.value = data || {}
    } else {
      const { data } = await useFetch(url)
      pvpStats.value = (data.value as any) || {}
    }
  } catch (error) {
    console.error('Failed to fetch PvP stats:', error)
  } finally {
    pvpStatsLoading.value = false
  }
}

// Refresh all stats (client-side with $fetch)
function refreshStats() {
  fetchGeneralStats(true)
  fetchTopPlayers(selectedMetric.value, true)
  fetchPvPStats(true)
}

function changeMetric(metric: string) {
  selectedMetric.value = metric
  fetchTopPlayers(metric, true)
}

function handleRealmChange() {
  // Reload all stats when realm filter changes
  refreshStats()
}

// Helper functions
function getRaceClassName(raceId: number): string {
  const races: Record<number, string> = {
    1: 'Human', 2: 'Orc', 3: 'Dwarf', 4: 'Night Elf',
    5: 'Undead', 6: 'Tauren', 7: 'Gnome', 8: 'Troll',
    10: 'Blood Elf', 11: 'Draenei'
  }
  return races[raceId] || `Race ${raceId}`
}

function getClassClassName(classId: number): string {
  const classes: Record<number, string> = {
    1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue',
    5: 'Priest', 6: 'Death Knight', 7: 'Shaman', 8: 'Mage',
    9: 'Warlock', 11: 'Druid'
  }
  return classes[classId] || `Class ${classId}`
}

function getZoneName(zoneId: number): string {
  return `Zone ${zoneId}`
}

function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  return `${hours}h`
}

function getMetricLabel(): string {
  switch (selectedMetric.value) {
    case 'playtime':
      return 'Total Playtime'
    case 'achievements':
      return 'Achievements'
    case 'level':
    default:
      return ''
  }
}

// Load stats when switching to stats tab
watch(activeTab, (newTab) => {
  if (newTab === 'stats') {
    if (Object.keys(generalStats.value).length === 0) {
      fetchGeneralStats()
      fetchTopPlayers(selectedMetric.value)
      fetchPvPStats()
    }
  }
})

onMounted(() => {
  fetchOnlinePlayers()

  // Auto-refresh online players every 30 seconds (using $fetch)
  const interval = setInterval(refreshOnlinePlayers, 30000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<style scoped>
.community-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header h1 {
  background: linear-gradient(to right, #60a5fa, #a78bfa);
  background-clip: text;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.refresh-btn {
  padding: 0.75rem 1.5rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid #3b82f6;
  color: #60a5fa;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 600;
  transition: all 0.2s;
}

.refresh-btn:hover:not(:disabled) {
  background: rgba(59, 130, 246, 0.2);
}

.refresh-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.realm-filter {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding: 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
}

.realm-filter label {
  color: #e2e8f0;
  font-weight: 600;
}

.realm-select {
  padding: 0.5rem 1rem;
  background: #0f172a;
  border: 1px solid #334155;
  color: #e2e8f0;
  border-radius: 0.5rem;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;
}

.realm-select:hover {
  border-color: #3b82f6;
}

.realm-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1.5rem;
}

.player-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
  transition: all 0.2s;
  text-decoration: none;
  display: block;
  color: inherit;
}

.player-card:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #334155;
}

.player-header h3 {
  color: #60a5fa;
  font-size: 1.25rem;
  margin: 0;
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.player-info p {
  margin: 0;
  color: #94a3b8;
  font-size: 0.9rem;
}

.realm {
  font-weight: 600;
  color: #e2e8f0;
}

.class-race {
  color: #94a3b8;
}

.zone {
  color: #94a3b8;
  font-style: italic;
}

.playtime {
  color: #94a3b8;
  font-size: 0.85rem;
}

.loading {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #64748b;
}
</style>
