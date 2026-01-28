<template>
  <section class="pvp-section">
    <UiSectionHeader title="⚔️ PvP Statistics" />

    <UiLoadingState v-if="loading" text="Loading PvP statistics..." />

    <div v-else>
      <div class="stats-grid">
        <UiStatCard
          icon="🏟️"
          label="Battlegrounds"
          :value="stats.battlegrounds?.total || 0"
          subtitle="Total matches played"
        />

        <UiStatCard
          icon="🎯"
          label="Arena Matches"
          :value="stats.arenas?.total || 0"
          subtitle="Total arena fights"
        />
      </div>

      <UiSectionHeader title="🏅 Top PvP Players" class="mt-lg" />

      <div class="leaderboard">
        <div v-for="(player, index) in stats.topPlayers" :key="`${player.realm}-${player.name}`" class="leaderboard-item">
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
          </div>
          <div class="player-metric">
            <span class="metric-value">{{ formatNumber(player.honorPoints) }}</span>
            <span class="metric-label">Honor Points</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { getRaceName, getClassName } from '~/utils/wow'
import { formatNumber } from '~/utils/format'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'

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

defineProps<{
  stats: PvPStats
  loading: boolean
}>()
</script>

<style scoped lang="scss">
@use "~/styles/variables" as *;
@use "~/styles/mixins" as *;

.pvp-section {
  @include section-container;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: $spacing-lg;
  margin-top: $spacing-lg;
}

.mt-lg {
  margin-top: $spacing-xl;
}

.leaderboard {
  display: flex;
  flex-direction: column;
  gap: $spacing-md;
  margin-top: $spacing-md;
}

.leaderboard-item {
  @include card-base;
  display: flex;
  align-items: center;
  gap: $spacing-lg;

  &:hover {
    @include card-hover;
    transform: translateX(4px);
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

@include respond-to('tablet') {
  .stats-grid {
    grid-template-columns: 1fr;
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
