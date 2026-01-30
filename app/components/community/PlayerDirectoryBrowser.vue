<script setup lang="ts">
/**
 * PlayerDirectoryBrowser - Search and browse all players with filters
 */
import { getClassName, getRaceName, formatPlaytime, getClassIcon, getRaceIcon } from '~/utils/wow'
import type { DirectoryPlayer, DirectoryPagination } from '~/stores/community'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiBadge from '~/components/ui/UiBadge.vue'

const WOW_CLASSES = [
  { id: 1, name: 'Warrior' },
  { id: 2, name: 'Paladin' },
  { id: 3, name: 'Hunter' },
  { id: 4, name: 'Rogue' },
  { id: 5, name: 'Priest' },
  { id: 6, name: 'Death Knight' },
  { id: 7, name: 'Shaman' },
  { id: 8, name: 'Mage' },
  { id: 9, name: 'Warlock' },
  { id: 11, name: 'Druid' },
]

const WOW_RACES = [
  { id: 1, name: 'Human', faction: 'alliance' },
  { id: 2, name: 'Orc', faction: 'horde' },
  { id: 3, name: 'Dwarf', faction: 'alliance' },
  { id: 4, name: 'Night Elf', faction: 'alliance' },
  { id: 5, name: 'Undead', faction: 'horde' },
  { id: 6, name: 'Tauren', faction: 'horde' },
  { id: 7, name: 'Gnome', faction: 'alliance' },
  { id: 8, name: 'Troll', faction: 'horde' },
  { id: 10, name: 'Blood Elf', faction: 'horde' },
  { id: 11, name: 'Draenei', faction: 'alliance' },
]

export interface Props {
  players: DirectoryPlayer[]
  loading?: boolean
  pagination: DirectoryPagination
  searchQuery?: string
  classFilter?: number | null
  raceFilter?: number | null
}

const props = withDefaults(defineProps<Props>(), {
  searchQuery: '',
  classFilter: null,
  raceFilter: null,
})

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  'update:page': [value: number]
  'update:classFilter': [value: number | null]
  'update:raceFilter': [value: number | null]
  'clear-filters': []
  'refresh': []
}>()

function handleSearchInput(event: Event) {
  const target = event.target as HTMLInputElement
  emit('update:searchQuery', target.value)
}

function goToPage(page: number) {
  if (page >= 1 && page <= props.pagination.totalPages) {
    emit('update:page', page)
  }
}

function toggleClassFilter(classId: number) {
  emit('update:classFilter', props.classFilter === classId ? null : classId)
}

function toggleRaceFilter(raceId: number) {
  emit('update:raceFilter', props.raceFilter === raceId ? null : raceId)
}

const hasActiveFilters = computed(() =>
  props.searchQuery || props.classFilter !== null || props.raceFilter !== null
)
</script>

<template>
  <section class="player-directory-section">
    <UiSectionHeader title="📚 Player Directory">
      <template #actions>
        <span v-if="pagination.total > 0" class="player-count">
          {{ pagination.total.toLocaleString() }} players
        </span>
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="loading"
          @click="emit('refresh')"
        >
          🔄 Refresh
        </UiButton>
      </template>
    </UiSectionHeader>

    <!-- Search Controls -->
    <div class="search-controls">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input
          type="text"
          :value="searchQuery"
          placeholder="Search by character name..."
          @input="handleSearchInput"
        />
        <button
          v-if="searchQuery"
          class="clear-btn"
          @click="emit('update:searchQuery', '')"
        >
          ×
        </button>
      </div>
    </div>

    <!-- Class Filter -->
    <div class="filter-section">
      <h4 class="filter-title">🎯 Filter by Class</h4>
      <div class="filter-chips">
        <button
          v-for="cls in WOW_CLASSES"
          :key="cls.id"
          class="filter-chip"
          :class="{ active: classFilter === cls.id }"
          @click="toggleClassFilter(cls.id)"
        >
          {{ getClassIcon(cls.id) }} {{ cls.name }}
        </button>
      </div>
    </div>

    <!-- Race Filter -->
    <div class="filter-section">
      <h4 class="filter-title">🌍 Filter by Race</h4>
      <div class="filter-chips">
        <button
          v-for="race in WOW_RACES"
          :key="race.id"
          class="filter-chip"
          :class="{ active: raceFilter === race.id, [race.faction]: true }"
          @click="toggleRaceFilter(race.id)"
        >
          {{ getRaceIcon(race.id) }} {{ race.name }}
        </button>
      </div>
    </div>

    <!-- Active Filters Summary -->
    <div v-if="hasActiveFilters" class="active-filters">
      <span class="filter-label">Active filters:</span>
      <span v-if="searchQuery" class="filter-tag">
        "{{ searchQuery }}"
        <button @click="emit('update:searchQuery', '')">×</button>
      </span>
      <span v-if="classFilter" class="filter-tag">
        {{ getClassName(classFilter) }}
        <button @click="emit('update:classFilter', null)">×</button>
      </span>
      <span v-if="raceFilter" class="filter-tag">
        {{ getRaceName(raceFilter) }}
        <button @click="emit('update:raceFilter', null)">×</button>
      </span>
      <button class="clear-all-btn" @click="emit('clear-filters')">Clear all</button>
    </div>

    <UiLoadingState v-if="loading" message="Loading players..." />

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
            <UiBadge variant="level" outline>Level {{ player.level }}</UiBadge>
          </header>

          <dl class="player-card__info">
            <div class="player-card__row">
              <dt class="sr-only">Realm</dt>
              <dd class="player-card__realm">{{ player.realm }}</dd>
            </div>
            <div class="player-card__row">
              <dt class="sr-only">Race and Class</dt>
              <dd class="player-card__class-race">
                {{ getRaceIcon(player.race) }} {{ getRaceName(player.race) }}
                {{ getClassIcon(player.class) }} {{ getClassName(player.class) }}
              </dd>
            </div>
            <div class="player-card__stats">
              <span class="stat">⏱️ {{ formatPlaytime(player.playtime) }}</span>
              <span class="stat">🏆 {{ player.achievementCount }}</span>
              <span class="stat">⚔️ {{ player.totalKills }}</span>
            </div>
          </dl>
        </NuxtLink>
      </div>

      <!-- Pagination -->
      <div v-if="pagination.totalPages > 1" class="pagination">
        <button
          class="page-btn"
          :disabled="pagination.page <= 1"
          @click="goToPage(pagination.page - 1)"
        >
          ← Prev
        </button>
        <span class="page-info">
          Page {{ pagination.page }} of {{ pagination.totalPages }}
        </span>
        <button
          class="page-btn"
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

.player-directory-section {
  .player-count {
    color: $text-muted;
    font-size: $font-size-sm;
    margin-right: $spacing-3;
  }
}

.search-controls {
  margin-bottom: $spacing-4;
}

.search-box {
  position: relative;
  max-width: 400px;

  .search-icon {
    position: absolute;
    left: $spacing-3;
    top: 50%;
    transform: translateY(-50%);
    font-size: $font-size-base;
    pointer-events: none;
  }

  input {
    width: 100%;
    padding: $spacing-3 $spacing-10;
    padding-right: $spacing-10;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    color: $text-primary;
    font-size: $font-size-sm;

    &:focus {
      outline: none;
      border-color: $blue-primary;
    }

    &::placeholder {
      color: $text-muted;
    }
  }

  .clear-btn {
    position: absolute;
    right: $spacing-3;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: $text-muted;
    font-size: $font-size-xl;
    cursor: pointer;
    padding: 0;
    line-height: 1;

    &:hover {
      color: $text-primary;
    }
  }
}

.filter-section {
  margin-bottom: $spacing-4;
}

.filter-title {
  font-size: $font-size-sm;
  color: $text-secondary;
  margin-bottom: $spacing-2;
}

.filter-chips {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-2;
}

.filter-chip {
  padding: $spacing-1 $spacing-3;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: $radius-full;
  color: $text-secondary;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: $blue-primary;
    color: $text-primary;
  }

  &.active {
    background: rgba($blue-primary, 0.2);
    border-color: $blue-primary;
    color: $blue-primary;
  }

  &.alliance.active {
    background: rgba(#0078ff, 0.2);
    border-color: #0078ff;
    color: #0078ff;
  }

  &.horde.active {
    background: rgba(#b30000, 0.2);
    border-color: #b30000;
    color: #ff4444;
  }
}

.active-filters {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-3 $spacing-4;
  background: rgba($blue-primary, 0.1);
  border: 1px solid rgba($blue-primary, 0.3);
  border-radius: $radius-md;
  margin-bottom: $spacing-4;
  flex-wrap: wrap;
}

.filter-label {
  font-size: $font-size-sm;
  color: $text-secondary;
}

.filter-tag {
  display: inline-flex;
  align-items: center;
  gap: $spacing-2;
  padding: $spacing-1 $spacing-3;
  background: $blue-primary;
  color: white;
  border-radius: $radius-full;
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;

  button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: $font-size-base;
    line-height: 1;
    opacity: 0.7;
    padding: 0;

    &:hover {
      opacity: 1;
    }
  }
}

.clear-all-btn {
  background: none;
  border: 1px solid $text-muted;
  border-radius: $radius-md;
  color: $text-secondary;
  padding: $spacing-1 $spacing-3;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all $transition-fast;
  margin-left: auto;

  &:hover {
    border-color: $text-primary;
    color: $text-primary;
  }
}

.players-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: $spacing-6;
}

.player-card {
  @include card-base;
  display: block;
  text-decoration: none;
  color: inherit;

  &:hover {
    border-color: $blue-primary;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba($blue-primary, 0.2);
  }

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-4;
    padding-bottom: $spacing-4;
    border-bottom: 1px solid $border-primary;
  }

  &__name {
    color: $blue-light;
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    margin: 0;
    display: flex;
    align-items: center;
    gap: $spacing-2;
  }

  .online-indicator {
    font-size: $font-size-sm;
  }

  &__info {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
    margin: 0;
  }

  &__row {
    margin: 0;
  }

  &__realm {
    font-weight: $font-weight-semibold;
    color: $text-primary;
  }

  &__class-race {
    color: $text-secondary;
  }

  &__stats {
    display: flex;
    gap: $spacing-4;
    margin-top: $spacing-2;

    .stat {
      color: $text-muted;
      font-size: $font-size-sm;
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

  .page-btn {
    padding: $spacing-2 $spacing-4;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    color: $text-secondary;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      border-color: $blue-primary;
      color: $text-primary;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .page-info {
    color: $text-muted;
    font-size: $font-size-sm;
  }
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}
</style>
