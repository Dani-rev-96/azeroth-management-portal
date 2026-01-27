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
          <article v-for="player in onlinePlayers" :key="`${player.realm}-${player.characterName}`" class="player-card">
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
        </article>
        </div>
      </section>
    </main>

    <!-- Stats Tab -->
    <main v-if="activeTab === 'stats'" class="tab-content">
      <!-- General Statistics -->
      <section class="content-section">
        <div class="section-header">
          <h2>📊 Server Statistics</h2>
          <button @click="refreshStats" class="refresh-btn" :disabled="statsLoading">
            🔄 Refresh
          </button>
        </div>

        <div v-if="statsLoading" class="loading">
          <p>Loading statistics...</p>
        </div>

        <div v-else class="stats-grid">
          <!-- Accounts Card -->
          <div class="stat-card">
            <div class="stat-icon">👥</div>
            <div class="stat-content">
              <h3>Total Accounts</h3>
              <p class="stat-value">{{ generalStats.accounts?.total || 0 }}</p>
              <p class="stat-subtext">{{ generalStats.accounts?.online || 0 }} online now</p>
            </div>
          </div>

          <!-- Characters Card -->
          <div class="stat-card">
            <div class="stat-icon">🎭</div>
            <div class="stat-content">
              <h3>Total Characters</h3>
              <p class="stat-value">{{ generalStats.characters?.total || 0 }}</p>
              <p class="stat-subtext">{{ generalStats.characters?.maxLevel || 0 }} at max level</p>
            </div>
          </div>

          <!-- Playtime Card -->
          <div class="stat-card">
            <div class="stat-icon">⏰</div>
            <div class="stat-content">
              <h3>Total Playtime</h3>
              <p class="stat-value">{{ formatLargeNumber(generalStats.playtime?.totalHours || 0) }} hours</p>
              <p class="stat-subtext">{{ generalStats.playtime?.totalDays || 0 }} days</p>
            </div>
          </div>

          <!-- Faction Balance Card -->
          <div class="stat-card">
            <div class="stat-icon">⚔️</div>
            <div class="stat-content">
              <h3>Faction Balance</h3>
              <div class="faction-bars">
                <div class="faction-bar alliance">
                  <span>Alliance</span>
                  <span>{{ getFactionPercentage('alliance') }}%</span>
                </div>
                <div class="faction-bar horde">
                  <span>Horde</span>
                  <span>{{ getFactionPercentage('horde') }}%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Class Distribution -->
      <section class="content-section">
        <h2>🎯 Class Distribution</h2>
        <div class="distribution-grid">
          <div v-for="(count, classId) in generalStats.classDistribution" :key="classId" class="distribution-item">
            <div class="distribution-icon">{{ getClassIcon(Number(classId)) }}</div>
            <div class="distribution-info">
              <span class="distribution-name">{{ getClassClassName(Number(classId)) }}</span>
              <span class="distribution-count">{{ count }} characters</span>
              <div class="distribution-bar">
                <div class="distribution-fill" :style="{ width: getDistributionPercentage(count, generalStats.characters?.total) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Race Distribution -->
      <section class="content-section">
        <h2>🌍 Race Distribution</h2>
        <div class="distribution-grid">
          <div v-for="(count, raceId) in generalStats.raceDistribution" :key="raceId" class="distribution-item">
            <div class="distribution-icon">{{ getRaceIcon(Number(raceId)) }}</div>
            <div class="distribution-info">
              <span class="distribution-name">{{ getRaceClassName(Number(raceId)) }}</span>
              <span class="distribution-count">{{ count }} characters</span>
              <div class="distribution-bar">
                <div class="distribution-fill" :style="{ width: getDistributionPercentage(count, generalStats.characters?.total) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- Top Players Section -->
      <section class="content-section">
        <div class="section-header">
          <h2>🏆 Top Players</h2>
          <div class="metric-selector">
            <button
              v-for="metric in topPlayerMetrics"
              :key="metric.value"
              :class="{ active: selectedMetric === metric.value }"
              @click="changeMetric(metric.value)"
            >
              {{ metric.label }}
            </button>
          </div>
        </div>

        <div v-if="topPlayersLoading" class="loading">
          <p>Loading top players...</p>
        </div>

        <div v-else class="leaderboard">
          <div v-for="(player, index) in topPlayers" :key="`${player.realm}-${player.name}`" class="leaderboard-item">
            <div class="rank">
              <span class="rank-number" :class="{ gold: index === 0, silver: index === 1, bronze: index === 2 }">
                {{ index + 1 }}
              </span>
            </div>
            <div class="player-details">
              <div class="player-name-level">
                <h3>{{ player.name }}</h3>
                <span class="level-badge">{{ player.level }}</span>
              </div>
              <p class="player-class-race">{{ getRaceClassName(player.race) }} {{ getClassClassName(player.class) }}</p>
              <p class="player-realm">{{ player.realm }}</p>
            </div>
            <div class="player-metric">
              <span class="metric-value">{{ formatMetricValue(player) }}</span>
              <span class="metric-label">{{ getMetricLabel() }}</span>
            </div>
          </div>
        </div>
      </section>

      <!-- PvP Statistics -->
      <section class="content-section">
        <h2>⚔️ PvP Statistics</h2>

        <div v-if="pvpStatsLoading" class="loading">
          <p>Loading PvP statistics...</p>
        </div>

        <div v-else>
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-icon">🏟️</div>
              <div class="stat-content">
                <h3>Battlegrounds</h3>
                <p class="stat-value">{{ pvpStats.battlegrounds?.total || 0 }}</p>
                <p class="stat-subtext">Total matches played</p>
              </div>
            </div>

            <div class="stat-card">
              <div class="stat-icon">🎯</div>
              <div class="stat-content">
                <h3>Arena Matches</h3>
                <p class="stat-value">{{ pvpStats.arenas?.total || 0 }}</p>
                <p class="stat-subtext">Total arena fights</p>
              </div>
            </div>
          </div>

          <h3 style="margin-top: 2rem; margin-bottom: 1rem;">🏅 Top PvP Players</h3>
          <div class="leaderboard">
            <div v-for="(player, index) in pvpStats.topPlayers" :key="`${player.realm}-${player.name}`" class="leaderboard-item">
              <div class="rank">
                <span class="rank-number" :class="{ gold: index === 0, silver: index === 1, bronze: index === 2 }">
                  {{ index + 1 }}
                </span>
              </div>
              <div class="player-details">
                <div class="player-name-level">
                  <h3>{{ player.name }}</h3>
                  <span class="level-badge">{{ player.level }}</span>
                </div>
                <p class="player-class-race">{{ getRaceClassName(player.race) }} {{ getClassClassName(player.class) }}</p>
              </div>
              <div class="player-metric">
                <span class="metric-value">{{ formatLargeNumber(player.honorPoints) }}</span>
                <span class="metric-label">Honor Points</span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
interface OnlinePlayer {
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

const topPlayerMetrics = [
  { label: '🎖️ Level', value: 'level' },
  { label: '⏱️ Playtime', value: 'playtime' },
  { label: '🏆 Achievements', value: 'achievements' },
]

// Fetch online players
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

function refreshOnlinePlayers() {
  fetchOnlinePlayers()
}

// Fetch general statistics
async function fetchGeneralStats() {
  statsLoading.value = true
  try {
    const { data } = await useFetch('/api/community/stats')
    generalStats.value = (data.value as any) || {}
  } catch (error) {
    console.error('Failed to fetch general stats:', error)
  } finally {
    statsLoading.value = false
  }
}

// Fetch top players
async function fetchTopPlayers(metric: string = 'level') {
  topPlayersLoading.value = true
  try {
    const { data } = await useFetch(`/api/community/top-players?metric=${metric}&limit=10`)
    topPlayers.value = (data.value as any) || []
  } catch (error) {
    console.error('Failed to fetch top players:', error)
  } finally {
    topPlayersLoading.value = false
  }
}

// Fetch PvP statistics
async function fetchPvPStats() {
  pvpStatsLoading.value = true
  try {
    const { data } = await useFetch('/api/community/pvp-stats')
    pvpStats.value = (data.value as any) || {}
  } catch (error) {
    console.error('Failed to fetch PvP stats:', error)
  } finally {
    pvpStatsLoading.value = false
  }
}

function refreshStats() {
  fetchGeneralStats()
  fetchTopPlayers(selectedMetric.value)
  fetchPvPStats()
}

function changeMetric(metric: string) {
  selectedMetric.value = metric
  fetchTopPlayers(metric)
}

// Helper functions to convert IDs to names
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
  // Simplified - you can expand this with a full zone map
  return `Zone ${zoneId}`
}

function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const days = Math.floor(hours / 24)

  if (days > 0) {
    return `${days}d ${hours % 24}h`
  }
  return `${hours}h`
}

function getClassIcon(classId: number): string {
  const icons: Record<number, string> = {
    1: '⚔️', 2: '🛡️', 3: '🏹', 4: '🗡️',
    5: '✨', 6: '💀', 7: '⚡', 8: '🔮',
    9: '👿', 11: '🐾'
  }
  return icons[classId] || '❓'
}

function getRaceIcon(raceId: number): string {
  const icons: Record<number, string> = {
    1: '👤', 2: '💪', 3: '⛏️', 4: '🌙',
    5: '☠️', 6: '🐃', 7: '🔧', 8: '🏝️',
    10: '✨', 11: '🔷'
  }
  return icons[raceId] || '❓'
}

function getFactionPercentage(faction: 'alliance' | 'horde'): string {
  const factions = generalStats.value.factions
  if (!factions) return '0'

  const total = factions.alliance + factions.horde
  if (total === 0) return '0'

  const percentage = (factions[faction] / total * 100).toFixed(1)
  return percentage
}

function getDistributionPercentage(count: number, total: number | undefined): number {
  if (!total || total === 0) return 0
  return (count / total * 100)
}

function formatLargeNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

function formatMetricValue(player: TopPlayer): string {
  switch (selectedMetric.value) {
    case 'playtime':
      return formatPlaytime(player.playtime)
    case 'achievements':
      return player.achievementCount.toString()
    case 'level':
    default:
      return `Level ${player.level}`
  }
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

  // Auto-refresh online players every 30 seconds
  const interval = setInterval(fetchOnlinePlayers, 30000)
  onUnmounted(() => clearInterval(interval))
})
</script>

<style scoped>
/* Community Page - Page-specific styles only */
/* Shared styles are in ~/assets/css/shared.css */

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
}

.player-card:hover {
  border-color: #475569;
  transform: translateY(-2px);
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

/* Stats Tab Styles */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}

.stat-card {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
  transition: all 0.2s;
}

.stat-card:hover {
  border-color: #475569;
  transform: translateY(-2px);
}

.stat-icon {
  font-size: 2.5rem;
  opacity: 0.8;
}

.stat-content {
  flex: 1;
}

.stat-content h3 {
  font-size: 0.9rem;
  color: #94a3b8;
  margin: 0 0 0.5rem 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #60a5fa;
  margin: 0;
  line-height: 1;
}

.stat-subtext {
  font-size: 0.85rem;
  color: #64748b;
  margin: 0.5rem 0 0 0;
}

.faction-bars {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.faction-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem;
  border-radius: 0.375rem;
  font-size: 0.9rem;
  font-weight: 600;
}

.faction-bar.alliance {
  background: rgba(59, 130, 246, 0.2);
  color: #60a5fa;
}

.faction-bar.horde {
  background: rgba(239, 68, 68, 0.2);
  color: #f87171;
}

/* Distribution Styles */
.distribution-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 1rem;
  margin-top: 1.5rem;
}

.distribution-item {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  padding: 1rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.distribution-icon {
  font-size: 2rem;
  opacity: 0.8;
}

.distribution-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.distribution-name {
  font-weight: 600;
  color: #e2e8f0;
}

.distribution-count {
  font-size: 0.85rem;
  color: #94a3b8;
}

.distribution-bar {
  height: 6px;
  background: #334155;
  border-radius: 3px;
  overflow: hidden;
  margin-top: 0.25rem;
}

.distribution-fill {
  height: 100%;
  background: linear-gradient(to right, #60a5fa, #a78bfa);
  transition: width 0.5s ease;
}

/* Metric Selector */
.metric-selector {
  display: flex;
  gap: 0.5rem;
}

.metric-selector button {
  padding: 0.5rem 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid #334155;
  color: #94a3b8;
  border-radius: 0.375rem;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.metric-selector button:hover {
  border-color: #3b82f6;
  color: #60a5fa;
}

.metric-selector button.active {
  background: rgba(59, 130, 246, 0.2);
  border-color: #3b82f6;
  color: #60a5fa;
}

/* Leaderboard Styles */
.leaderboard {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 1.5rem;
}

.leaderboard-item {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1.5rem;
  transition: all 0.2s;
}

.leaderboard-item:hover {
  border-color: #475569;
  transform: translateX(4px);
}

.rank {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 3rem;
}

.rank-number {
  font-size: 1.5rem;
  font-weight: 700;
  color: #64748b;
}

.rank-number.gold {
  color: #fbbf24;
  font-size: 2rem;
}

.rank-number.silver {
  color: #cbd5e1;
  font-size: 1.75rem;
}

.rank-number.bronze {
  color: #fb923c;
  font-size: 1.75rem;
}

.player-details {
  flex: 1;
  min-width: 0;
}

.player-name-level {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-bottom: 0.5rem;
}

.player-name-level h3 {
  color: #60a5fa;
  font-size: 1.25rem;
  margin: 0;
}

.player-class-race {
  color: #94a3b8;
  font-size: 0.9rem;
  margin: 0.25rem 0;
}

.player-realm {
  color: #64748b;
  font-size: 0.85rem;
  margin: 0;
}

.player-metric {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #a78bfa;
}

.metric-label {
  font-size: 0.8rem;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Loading State */
.loading {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
}

/* Responsive Design */
@media (max-width: 768px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }

  .distribution-grid {
    grid-template-columns: 1fr;
  }

  .metric-selector {
    flex-direction: column;
  }

  .leaderboard-item {
    flex-direction: column;
    align-items: flex-start;
    text-align: left;
  }

  .player-metric {
    align-items: flex-start;
  }
}
</style>
