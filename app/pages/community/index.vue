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
      <section class="content-section">
        <h2>Coming Soon: Player Statistics</h2>
        <p>Playtime tracking, progression stats, and more...</p>
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

const activeTab = ref('online')
const loading = ref(false)
const onlinePlayers = ref<OnlinePlayer[]>([])

// Fetch online players
async function fetchOnlinePlayers() {
  loading.value = true
  try {
    const { data } = await useFetch('/api/community/online')
    onlinePlayers.value = data.value || []
  } catch (error) {
    console.error('Failed to fetch online players:', error)
  } finally {
    loading.value = false
  }
}

function refreshOnlinePlayers() {
  fetchOnlinePlayers()
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

onMounted(() => {
  fetchOnlinePlayers()

  // Auto-refresh every 30 seconds
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
</style>
