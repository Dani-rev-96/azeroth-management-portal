<script setup lang="ts">
/**
 * PlayerDirectoryBrowser - Browse all players with filters and pagination
 */
import { getClassName, getRaceName, formatPlaytime, getClassIcon, getRaceIcon } from '~/utils/wow'
import type { DirectoryPlayer, DirectoryPagination, ZoneInfo } from '~/stores/community'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import DirectoryFilters from './DirectoryFilters.vue'

export interface Props {
  players: DirectoryPlayer[]
  loading?: boolean
  pagination: DirectoryPagination
  searchQuery?: string
  classFilter?: number | null
  raceFilter?: number | null
  zoneFilter?: number | null
  minLevel?: number
  maxLevel?: number
  onlineOnly?: boolean
  availableZones?: ZoneInfo[]
  zonesLoading?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  classFilter: null,
  raceFilter: null,
  zoneFilter: null,
  minLevel: 1,
  maxLevel: 80,
  onlineOnly: false,
  availableZones: () => [],
  zonesLoading: false,
})

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:page': [value: number]
  'update:classFilter': [value: number | null]
  'update:raceFilter': [value: number | null]
  'update:zoneFilter': [value: number | null]
  'update:levelRange': [min: number, max: number]
  'update:onlineOnly': [value: boolean]
  'clear-filters': []
  'refresh': []
}>()

function goToPage(page: number) {
  if (page >= 1 && page <= props.pagination.totalPages) {
    emit('update:page', page)
  }
}

function handleLevelRangeUpdate(min: number, max: number) {
  emit('update:levelRange', min, max)
}

const hasActiveFilters = computed(() =>
  props.searchQuery ||
  props.classFilter !== null ||
  props.raceFilter !== null ||
  props.zoneFilter !== null ||
  props.minLevel > 1 ||
  props.maxLevel < 80 ||
  props.onlineOnly
)
</script>

<template>
  <section class="player-directory">
    <!-- Header -->
    <UiSectionHeader title="📚 Player Directory">
      <template #actions>
        <span v-if="pagination.total > 0" class="player-count">
          {{ pagination.total.toLocaleString() }} players
        </span>
        <UiButton variant="ghost" size="sm" :disabled="loading" @click="emit('refresh')">
          🔄 Refresh
        </UiButton>
      </template>
    </UiSectionHeader>

    <!-- Filters Panel -->
    <DirectoryFilters
      :search-query="searchQuery"
      :class-filter="classFilter"
      :race-filter="raceFilter"
      :zone-filter="zoneFilter"
      :min-level="minLevel"
      :max-level="maxLevel"
      :online-only="onlineOnly"
      :available-zones="availableZones"
      :zones-loading="zonesLoading"
      @update:search-query="emit('update:searchQuery', $event)"
      @update:class-filter="emit('update:classFilter', $event)"
      @update:race-filter="emit('update:raceFilter', $event)"
      @update:zone-filter="emit('update:zoneFilter', $event)"
      @update:level-range="handleLevelRangeUpdate"
      @update:online-only="emit('update:onlineOnly', $event)"
      @clear-filters="emit('clear-filters')"
    />

    <!-- Loading State -->
    <UiLoadingState v-if="loading" message="Loading players..." />

    <!-- Empty States -->
    <UiEmptyState
      v-else-if="players.length === 0 && !hasActiveFilters"
      icon="👥"
      message="No players found"
    />

    <UiEmptyState
      v-else-if="players.length === 0 && hasActiveFilters"
      icon="🔍"
      message="No players match your search criteria"
    />

    <!-- Player Grid -->
    <template v-else>
      <div class="players-grid">
        <NuxtLink
          v-for="player in players"
          :key="`${player.realmId}-${player.guid}`"
          :to="`/character/${player.guid}/${player.realmId}`"
          class="player-card"
        >
          <header class="player-card__header">
            <h3 class="player-card__name">
              {{ player.name }}
              <span v-if="player.online" class="online-indicator" title="Online">🟢</span>
            </h3>
            <UiBadge variant="level" outline>{{ player.level }}</UiBadge>
          </header>

          <div class="player-card__body">
            <div class="player-card__meta">
              <span class="player-card__realm">{{ player.realm }}</span>
              <span class="player-card__class-race">
                {{ getRaceIcon(player.race) }} {{ getRaceName(player.race) }}
                {{ getClassIcon(player.class) }} {{ getClassName(player.class) }}
              </span>
              <span v-if="player.zoneName" class="player-card__zone">
                📍 {{ player.zoneName }}
              </span>
            </div>
            <div class="player-card__stats">
              <span class="stat" title="Playtime">⏱️ {{ formatPlaytime(player.playtime) }}</span>
              <span class="stat" title="Achievements">🏆 {{ player.achievementCount }}</span>
              <span class="stat" title="Kills">⚔️ {{ player.totalKills }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="pagination">
        <button
          class="pagination__btn"
          :disabled="pagination.page <= 1"
          @click="goToPage(pagination.page - 1)"
        >
          ← Prev
        </button>
        <span class="pagination__info">
          Page {{ pagination.page }} of {{ pagination.totalPages }}
        </span>
        <button
          class="pagination__btn"
          :disabled="pagination.page >= pagination.totalPages"
          @click="goToPage(pagination.page + 1)"
        >
          Next →
        </button>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.player-directory {
  .player-count {
    color: $text-muted;
    font-size: $font-size-sm;
    margin-right: $spacing-3;
  }
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: $spacing-4;

  @media (min-width: 1200px) {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  }
}

.player-card {
  @include card-base;
  display: flex;
  flex-direction: column;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;

  &:hover {
    border-color: $blue-primary;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba($blue-primary, 0.15);
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: $spacing-3;
    margin-bottom: $spacing-3;
    border-bottom: 1px solid $border-primary;
  }

  &__name {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    color: $blue-light;
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    margin: 0;
  }

  .online-indicator {
    font-size: $font-size-xs;
  }

  &__body {
    display: flex;
    flex-direction: column;
    gap: $spacing-3;
  }

  &__meta {
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
  }

  &__realm {
    font-weight: $font-weight-medium;
    color: $text-primary;
    font-size: $font-size-sm;
  }

  &__class-race {
    color: $text-secondary;
    font-size: $font-size-sm;
  }

  &__zone {
    color: $text-muted;
    font-size: $font-size-xs;
  }

  &__stats {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-3;
    padding-top: $spacing-2;
    border-top: 1px solid $border-primary;

    .stat {
      color: $text-muted;
      font-size: $font-size-xs;
    }
  }
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: $spacing-4;
  margin-top: $spacing-6;
  padding-top: $spacing-4;
  border-top: 1px solid $border-primary;

  &__btn {
    padding: $spacing-2 $spacing-4;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    color: $text-secondary;
    font-size: $font-size-sm;
    cursor: pointer;
    transition: all 0.15s;

    &:hover:not(:disabled) {
      border-color: $blue-primary;
      color: $text-primary;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__info {
    color: $text-muted;
    font-size: $font-size-sm;
  }
}
</style>
