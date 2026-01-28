<template>
  <section class="leaderboard-section">
    <div class="section-header">
      <UiSectionHeader title="🏆 Top Players" />
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

    <UiLoadingState v-if="loading" text="Loading top players..." />

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
            <UiBadge variant="info" size="sm">{{ player.level }}</UiBadge>
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
import { getRaceName, getClassName, formatPlaytime } from '~/utils/wow'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiBadge from '~/components/ui/UiBadge.vue'

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

<style scoped lang="scss">
@use "~/styles/variables" as *;
@use "~/styles/mixins" as *;

.leaderboard-section {
  @include section-container;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: $spacing-md;
}

.metric-selector {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-sm;

  button {
    @include button-base;
    padding: $spacing-sm $spacing-md;
    background: rgba($color-info, 0.1);
    border-color: $border-primary;
    color: $text-secondary;
    font-size: $font-sm;
    white-space: nowrap;

    &:hover {
      border-color: $color-info;
      color: $color-info;
    }

    &.active {
      background: rgba($color-info, 0.2);
      border-color: $color-info;
      color: $color-info;
    }
  }
}

.leaderboard {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  margin-top: $spacing-lg;
}

.leaderboard-item {
  @include card-base;
  display: flex;
  align-items: center;
  gap: $spacing-lg;
  text-decoration: none;
  color: inherit;
  cursor: pointer;

  &:hover {
    border-color: $color-info;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba($color-info, 0.2);
  }
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
  color: $text-muted;

  &.gold {
    color: $color-warning;
    font-size: 2rem;
  }

  &.silver {
    color: #cbd5e1;
    font-size: 1.75rem;
  }

  &.bronze {
    color: #fb923c;
    font-size: 1.75rem;
  }
}

.player-details {
  flex: 1;
  min-width: 0;
}

.player-name-level {
  display: flex;
  align-items: center;
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;

  h3 {
    color: $color-info;
    font-size: $font-xl;
    margin: 0;
  }
}

.player-class-race {
  color: $text-secondary;
  font-size: $font-sm;
  margin: $spacing-xs 0;
}

.player-realm {
  color: $text-muted;
  font-size: $font-xs;
  margin: 0;
}

.player-metric {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: $spacing-xs;
}

.metric-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: $color-accent;
}

.metric-label {
  @include stat-label;
}

// Tablet and below (max-width: 768px)
@media (max-width: $breakpoint-md) {
  .leaderboard-item {
    flex-wrap: wrap;
    gap: $spacing-md;
    padding: $spacing-md;
  }

  .rank {
    min-width: 2.5rem;
  }

  .player-details {
    flex: 1 1 0;
    min-width: 120px;
  }

  .player-name-level {
    flex-wrap: wrap;

    h3 {
      font-size: $font-lg;
    }
  }

  .player-metric {
    flex: 0 0 auto;
    align-items: flex-end;
  }

  .metric-value {
    font-size: 1.25rem;
  }
}

// Mobile (max-width: 640px)
@media (max-width: $breakpoint-xs) {
  .section-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .metric-selector {
    width: 100%;
    justify-content: flex-start;
  }

  .leaderboard-item {
    flex-wrap: wrap;
    gap: $spacing-sm;
    padding: $spacing-sm $spacing-md;
  }

  .rank {
    min-width: 2rem;
  }

  .rank-number {
    font-size: 1.25rem;

    &.gold {
      font-size: 1.5rem;
    }

    &.silver,
    &.bronze {
      font-size: 1.35rem;
    }
  }

  .player-details {
    flex: 1 1 0;
    min-width: 0;
  }

  .player-name-level {
    flex-wrap: wrap;
    gap: $spacing-xs;

    h3 {
      font-size: $font-md;
    }
  }

  .player-metric {
    flex: 0 0 100%;
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    margin-top: $spacing-xs;
    padding-top: $spacing-sm;
    border-top: 1px solid $border-primary;
  }

  .metric-value {
    font-size: 1.1rem;
  }
}
</style>
