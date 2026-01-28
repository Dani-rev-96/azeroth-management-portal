<template>
  <section class="stats-overview">
    <UiSectionHeader title="📊 Server Statistics" />

    <UiLoadingState v-if="loading" text="Loading statistics..." />

    <div v-else class="stats-grid">
      <UiStatCard
        icon="👥"
        label="Total Accounts"
        :value="stats.accounts?.total || 0"
        :subtitle="`${stats.accounts?.online || 0} online now`"
      />

      <UiStatCard
        icon="🎭"
        label="Total Characters"
        :value="stats.characters?.total || 0"
        :subtitle="`${stats.characters?.maxLevel || 0} at max level`"
      />

      <UiStatCard
        icon="⏰"
        label="Total Playtime"
        :value="formatNumber(stats.playtime?.totalHours || 0) + ' hours'"
        :subtitle="`${stats.playtime?.totalDays || 0} days`"
      />

      <!-- Faction Balance Card -->
      <div class="stat-card faction-card">
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
import { formatNumber } from '~/utils/format'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiStatCard from '~/components/ui/UiStatCard.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'

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
</script>

<style scoped lang="scss">
@use "~/styles/variables" as *;
@use "~/styles/mixins" as *;

.stats-overview {
  @include section-container;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: $spacing-lg;
  margin-top: $spacing-lg;
}

.stat-card {
  @include card-base;
  display: flex;
  align-items: center;
  gap: $spacing-md;

  &:hover {
    @include card-hover;
    transform: translateY(-2px);
  }
}

.faction-card {
  .stat-icon {
    font-size: 2.5rem;
    opacity: 0.8;
  }

  .stat-content {
    flex: 1;

    h3 {
      @include stat-label;
      margin: 0 0 $spacing-sm 0;
    }
  }
}

.faction-bars {
  display: flex;
  flex-direction: column;
  gap: $spacing-sm;
}

.faction-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-sm;
  border-radius: $radius-sm;
  font-size: $font-sm;
  font-weight: 600;

  &.alliance {
    background: rgba($color-info, 0.2);
    color: lighten($color-info, 10%);
  }

  &.horde {
    background: rgba($color-danger, 0.2);
    color: lighten($color-danger, 10%);
  }
}
</style>
