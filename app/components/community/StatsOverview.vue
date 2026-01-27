<template>
  <section class="content-section">
    <div class="section-header">
      <h2>📊 Server Statistics</h2>
    </div>

    <div v-if="loading" class="loading">
      <p>Loading statistics...</p>
    </div>

    <div v-else class="stats-grid">
      <!-- Accounts Card -->
      <div class="stat-card">
        <div class="stat-icon">👥</div>
        <div class="stat-content">
          <h3>Total Accounts</h3>
          <p class="stat-value">{{ stats.accounts?.total || 0 }}</p>
          <p class="stat-subtext">{{ stats.accounts?.online || 0 }} online now</p>
        </div>
      </div>

      <!-- Characters Card -->
      <div class="stat-card">
        <div class="stat-icon">🎭</div>
        <div class="stat-content">
          <h3>Total Characters</h3>
          <p class="stat-value">{{ stats.characters?.total || 0 }}</p>
          <p class="stat-subtext">{{ stats.characters?.maxLevel || 0 }} at max level</p>
        </div>
      </div>

      <!-- Playtime Card -->
      <div class="stat-card">
        <div class="stat-icon">⏰</div>
        <div class="stat-content">
          <h3>Total Playtime</h3>
          <p class="stat-value">{{ formatLargeNumber(stats.playtime?.totalHours || 0) }} hours</p>
          <p class="stat-subtext">{{ stats.playtime?.totalDays || 0 }} days</p>
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
</template>

<script setup lang="ts">
interface GeneralStats {
  accounts?: { total: number; online: number }
  characters?: { total: number; maxLevel: number }
  playtime?: { totalSeconds: number; totalHours: number; totalDays: number }
  factions?: { alliance: number; horde: number }
}

const props = defineProps<{
  stats: GeneralStats
  loading: boolean
}>()

defineEmits<{
  refresh: []
}>()

function getFactionPercentage(faction: 'alliance' | 'horde'): string {
  const factions = props.stats.factions
  if (!factions) return '0'

  const total = factions.alliance + factions.horde
  if (total === 0) return '0'

  return (factions[faction] / total * 100).toFixed(1)
}

function formatLargeNumber(num: number): string {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return num.toString()
}
</script>

<style scoped>
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

.loading {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
}
</style>
