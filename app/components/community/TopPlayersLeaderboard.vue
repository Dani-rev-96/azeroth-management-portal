<template>
  <section class="content-section">
    <div class="section-header">
      <h2>🏆 Top Players</h2>
      <div class="metric-selector">
        <button
          v-for="metric in metrics"
          :key="metric.value"
          :class="{ active: selectedMetric === metric.value }"
          @click="$emit('change-metric', metric.value)"
        >
          {{ metric.label }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="loading">
      <p>Loading top players...</p>
    </div>

    <div v-else class="leaderboard">
      <NuxtLink
        v-for="(player, index) in players"
        :key="`${player.realm}-${player.guid}`"
        :to="`/character/${player.guid}/${player.realmId}`"
        class="leaderboard-item"
      >
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
          <p class="player-class-race">{{ getRaceName(player.race) }} {{ getClassName(player.class) }}</p>
          <p class="player-realm">{{ player.realm }}</p>
        </div>
        <div class="player-metric">
          <span class="metric-value">{{ formatMetricValue(player) }}</span>
          <span class="metric-label">{{ metricLabel }}</span>
        </div>
      </NuxtLink>
    </div>
  </section>
</template>

<script setup lang="ts">
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

const props = defineProps<{
  players: TopPlayer[]
  loading: boolean
  selectedMetric: string
  metricLabel: string
}>()

defineEmits<{
  'change-metric': [metric: string]
}>()

const metrics = [
  { label: '🎖️ Level', value: 'level' },
  { label: '⏱️ Playtime', value: 'playtime' },
  { label: '🏆 Achievements', value: 'achievements' },
]

function getRaceName(raceId: number): string {
  const races: Record<number, string> = {
    1: 'Human', 2: 'Orc', 3: 'Dwarf', 4: 'Night Elf',
    5: 'Undead', 6: 'Tauren', 7: 'Gnome', 8: 'Troll',
    10: 'Blood Elf', 11: 'Draenei'
  }
  return races[raceId] || `Race ${raceId}`
}

function getClassName(classId: number): string {
  const classes: Record<number, string> = {
    1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue',
    5: 'Priest', 6: 'Death Knight', 7: 'Shaman', 8: 'Mage',
    9: 'Warlock', 11: 'Druid'
  }
  return classes[classId] || `Class ${classId}`
}

function formatPlaytime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const days = Math.floor(hours / 24)
  if (days > 0) return `${days}d ${hours % 24}h`
  return `${hours}h`
}

function formatMetricValue(player: TopPlayer): string {
  switch (props.selectedMetric) {
    case 'playtime':
      return formatPlaytime(player.playtime)
    case 'achievements':
      return player.achievementCount.toString()
    case 'level':
    default:
      return `Level ${player.level}`
  }
}
</script>

<style scoped>
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
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}

.leaderboard-item:hover {
  border-color: #3b82f6;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
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

.loading {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
}

@media (max-width: 768px) {
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
