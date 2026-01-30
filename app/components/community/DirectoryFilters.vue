<script setup lang="ts">
/**
 * DirectoryFilters - Collapsible filter panel for Player Directory
 */
import { getClassName, getRaceName, getClassIcon, getRaceIcon } from '~/utils/wow'
import type { ZoneInfo } from '~/stores/community'

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

const ALLIANCE_RACES = [
  { id: 1, name: 'Human' },
  { id: 3, name: 'Dwarf' },
  { id: 4, name: 'Night Elf' },
  { id: 7, name: 'Gnome' },
  { id: 11, name: 'Draenei' },
]

const HORDE_RACES = [
  { id: 2, name: 'Orc' },
  { id: 5, name: 'Undead' },
  { id: 6, name: 'Tauren' },
  { id: 8, name: 'Troll' },
  { id: 10, name: 'Blood Elf' },
]

const LEVEL_PRESETS = [
  { label: 'All', min: 1, max: 80 },
  { label: '1-19', min: 1, max: 19 },
  { label: '20-39', min: 20, max: 39 },
  { label: '40-59', min: 40, max: 59 },
  { label: '60-69', min: 60, max: 69 },
  { label: '70-79', min: 70, max: 79 },
  { label: '80', min: 80, max: 80 },
]

export interface Props {
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
  'update:classFilter': [value: number | null]
  'update:raceFilter': [value: number | null]
  'update:zoneFilter': [value: number | null]
  'update:levelRange': [min: number, max: number]
  'update:onlineOnly': [value: boolean]
  'clear-filters': []
}>()

// Panel state
const isExpanded = ref(true)

// Local state for level range
const localMinLevel = ref(props.minLevel)
const localMaxLevel = ref(props.maxLevel)

// Zone state
const zoneSearchQuery = ref('')
const showZoneDropdown = ref(false)

// Sync level values
watch(() => props.minLevel, (val) => { localMinLevel.value = val })
watch(() => props.maxLevel, (val) => { localMaxLevel.value = val })

const filteredZones = computed(() => {
  const search = zoneSearchQuery.value.toLowerCase()
  const zones = search
    ? props.availableZones.filter(z => z.name.toLowerCase().includes(search))
    : props.availableZones
  return zones.slice(0, 15)
})

const selectedZoneName = computed(() => {
  if (!props.zoneFilter) return null
  return props.availableZones.find(z => z.id === props.zoneFilter)?.name || `Zone ${props.zoneFilter}`
})

const activeFilterCount = computed(() => {
  let count = 0
  if (props.searchQuery) count++
  if (props.classFilter !== null) count++
  if (props.raceFilter !== null) count++
  if (props.zoneFilter !== null) count++
  if (props.minLevel > 1 || props.maxLevel < 80) count++
  if (props.onlineOnly) count++
  return count
})

const hasActiveFilters = computed(() => activeFilterCount.value > 0)

function handleSearchInput(event: Event) {
  emit('update:searchQuery', (event.target as HTMLInputElement).value)
}

function toggleClass(classId: number) {
  emit('update:classFilter', props.classFilter === classId ? null : classId)
}

function toggleRace(raceId: number) {
  emit('update:raceFilter', props.raceFilter === raceId ? null : raceId)
}

function selectZone(zoneId: number | null) {
  emit('update:zoneFilter', zoneId)
  showZoneDropdown.value = false
  zoneSearchQuery.value = ''
}

function applyLevelRange() {
  const min = Math.max(1, Math.min(localMinLevel.value, 80))
  const max = Math.max(1, Math.min(localMaxLevel.value, 80))
  emit('update:levelRange', Math.min(min, max), Math.max(min, max))
}

function setLevelPreset(min: number, max: number) {
  localMinLevel.value = min
  localMaxLevel.value = max
  emit('update:levelRange', min, max)
}

function isLevelPresetActive(min: number, max: number) {
  return props.minLevel === min && props.maxLevel === max
}

// Close zone dropdown on outside click
function handleClickOutside(event: MouseEvent) {
  if (!(event.target as HTMLElement).closest('.zone-select')) {
    showZoneDropdown.value = false
  }
}

onMounted(() => document.addEventListener('click', handleClickOutside))
onUnmounted(() => document.removeEventListener('click', handleClickOutside))
</script>

<template>
  <div class="directory-filters" :class="{ expanded: isExpanded }">
    <!-- Filter Header -->
    <button class="filter-header" @click="isExpanded = !isExpanded">
      <span class="filter-header__title">
        <span class="filter-header__icon">🔍</span>
        Search & Filters
        <span v-if="activeFilterCount > 0" class="filter-badge">{{ activeFilterCount }}</span>
      </span>
      <span class="filter-header__toggle">{{ isExpanded ? '▼' : '▶' }}</span>
    </button>

    <!-- Filter Content -->
    <div v-show="isExpanded" class="filter-content">
      <!-- Row 1: Search + Online Toggle -->
      <div class="filter-row filter-row--primary">
        <div class="search-input">
          <span class="search-input__icon">🔍</span>
          <input
            type="text"
            :value="searchQuery"
            placeholder="Search players..."
            @input="handleSearchInput"
          />
          <button v-if="searchQuery" class="search-input__clear" @click="emit('update:searchQuery', '')">×</button>
        </div>
        <button
          class="online-toggle"
          :class="{ active: onlineOnly }"
          @click="emit('update:onlineOnly', !onlineOnly)"
        >
          <span class="online-toggle__dot" :class="{ active: onlineOnly }"></span>
          {{ onlineOnly ? 'Online' : 'All' }}
        </button>
      </div>

      <!-- Row 2: Class Filter -->
      <div class="filter-row">
        <span class="filter-row__label">Class</span>
        <div class="chip-group">
          <button
            v-for="cls in WOW_CLASSES"
            :key="cls.id"
            class="chip"
            :class="{ active: classFilter === cls.id }"
            :title="cls.name"
            @click="toggleClass(cls.id)"
          >
            <span class="chip__icon">{{ getClassIcon(cls.id) }}</span>
            <span class="chip__label">{{ cls.name }}</span>
          </button>
        </div>
      </div>

      <!-- Row 3: Race Filter -->
      <div class="filter-row">
        <span class="filter-row__label">Race</span>
        <div class="race-groups">
          <div class="race-group race-group--alliance">
            <button
              v-for="race in ALLIANCE_RACES"
              :key="race.id"
              class="chip chip--alliance"
              :class="{ active: raceFilter === race.id }"
              :title="race.name"
              @click="toggleRace(race.id)"
            >
              <span class="chip__icon">{{ getRaceIcon(race.id) }}</span>
              <span class="chip__label">{{ race.name }}</span>
            </button>
          </div>
          <div class="race-group race-group--horde">
            <button
              v-for="race in HORDE_RACES"
              :key="race.id"
              class="chip chip--horde"
              :class="{ active: raceFilter === race.id }"
              :title="race.name"
              @click="toggleRace(race.id)"
            >
              <span class="chip__icon">{{ getRaceIcon(race.id) }}</span>
              <span class="chip__label">{{ race.name }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Row 4: Zone + Level -->
      <div class="filter-row filter-row--split">
        <!-- Zone Select -->
        <div class="zone-select">
          <span class="filter-row__label">Zone</span>
          <div class="zone-select__wrapper">
            <input
              v-model="zoneSearchQuery"
              type="text"
              class="zone-select__input"
              :placeholder="selectedZoneName || 'Any zone'"
              @focus="showZoneDropdown = true"
            />
            <button v-if="zoneFilter" class="zone-select__clear" @click.stop="selectZone(null)">×</button>
            <div v-if="showZoneDropdown" class="zone-select__dropdown">
              <div v-if="zonesLoading" class="zone-select__loading">Loading...</div>
              <template v-else>
                <button
                  v-for="zone in filteredZones"
                  :key="zone.id"
                  class="zone-select__option"
                  :class="{ active: zoneFilter === zone.id }"
                  @click="selectZone(zone.id)"
                >
                  {{ zone.name }}
                  <span class="zone-select__count">{{ zone.playerCount }}</span>
                </button>
                <div v-if="filteredZones.length === 0" class="zone-select__empty">No zones found</div>
              </template>
            </div>
          </div>
        </div>

        <!-- Level Range -->
        <div class="level-filter">
          <span class="filter-row__label">Level</span>
          <div class="level-filter__controls">
            <div class="level-filter__inputs">
              <input
                v-model.number="localMinLevel"
                type="number"
                min="1"
                max="80"
                class="level-filter__input"
                @change="applyLevelRange"
              />
              <span class="level-filter__sep">–</span>
              <input
                v-model.number="localMaxLevel"
                type="number"
                min="1"
                max="80"
                class="level-filter__input"
                @change="applyLevelRange"
              />
            </div>
            <div class="level-filter__presets">
              <button
                v-for="preset in LEVEL_PRESETS"
                :key="preset.label"
                class="level-preset"
                :class="{ active: isLevelPresetActive(preset.min, preset.max) }"
                @click="setLevelPreset(preset.min, preset.max)"
              >
                {{ preset.label }}
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Active Filters Summary -->
      <div v-if="hasActiveFilters" class="active-filters">
        <div class="active-filters__tags">
          <span v-if="searchQuery" class="tag">
            "{{ searchQuery }}" <button @click="emit('update:searchQuery', '')">×</button>
          </span>
          <span v-if="classFilter" class="tag">
            {{ getClassIcon(classFilter) }} {{ getClassName(classFilter) }}
            <button @click="emit('update:classFilter', null)">×</button>
          </span>
          <span v-if="raceFilter" class="tag">
            {{ getRaceIcon(raceFilter) }} {{ getRaceName(raceFilter) }}
            <button @click="emit('update:raceFilter', null)">×</button>
          </span>
          <span v-if="zoneFilter" class="tag">
            📍 {{ selectedZoneName }}
            <button @click="emit('update:zoneFilter', null)">×</button>
          </span>
          <span v-if="minLevel > 1 || maxLevel < 80" class="tag">
            Lvl {{ minLevel }}-{{ maxLevel }}
            <button @click="emit('update:levelRange', 1, 80)">×</button>
          </span>
          <span v-if="onlineOnly" class="tag tag--online">
            🟢 Online
            <button @click="emit('update:onlineOnly', false)">×</button>
          </span>
        </div>
        <button class="clear-all" @click="emit('clear-filters')">Clear all</button>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.directory-filters {
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: $radius-lg;
  margin-bottom: $spacing-6;
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: $spacing-4;
  background: $bg-tertiary;
  border: none;
  border-radius: $radius-lg $radius-lg 0 0;
  color: $text-primary;
  cursor: pointer;
  transition: background 0.15s;

  .directory-filters:not(.expanded) & {
    border-radius: $radius-lg;
  }

  &:hover {
    background: lighten($bg-tertiary, 3%);
  }

  &__title {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    font-weight: $font-weight-semibold;
  }

  &__icon {
    font-size: $font-size-lg;
  }

  &__toggle {
    color: $text-muted;
    font-size: $font-size-sm;
  }
}

.filter-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 $spacing-2;
  background: $blue-primary;
  color: white;
  border-radius: $radius-full;
  font-size: $font-size-xs;
  font-weight: $font-weight-bold;
}

.filter-content {
  padding: $spacing-4;
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.filter-row {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;

  &__label {
    font-size: $font-size-xs;
    color: $text-muted;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  &--primary {
    flex-direction: row;
    align-items: center;
    gap: $spacing-3;

    @media (max-width: 480px) {
      flex-direction: column;
      align-items: stretch;
    }
  }

  &--split {
    @media (min-width: 768px) {
      flex-direction: row;
      gap: $spacing-6;

      > * {
        flex: 1;
      }
    }
  }
}

// Search Input
.search-input {
  flex: 1;
  position: relative;
	padding: 0;

  &__icon {
    position: absolute;
    left: $spacing-3;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
    color: $text-muted;
    font-size: $font-size-sm;
    line-height: 1;
  }

  input {
    width: 100%;
    height: 40px;
    padding: 0 $spacing-10 0 $spacing-10;
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

  &__clear {
    position: absolute;
    right: $spacing-3;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: $text-muted;
    font-size: $font-size-lg;
    cursor: pointer;
    padding: $spacing-1;
    line-height: 1;

    &:hover {
      color: $text-primary;
    }
  }
}

// Online Toggle
.online-toggle {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  height: 40px;
  padding: 0 $spacing-4;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: $radius-md;
  color: $text-secondary;
  font-size: $font-size-sm;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    border-color: $border-secondary;
    color: $text-primary;
  }

  &.active {
    border-color: $success;
    background: rgba($success, 0.15);
    color: $success;
  }

  &__dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $text-muted;
    transition: all 0.15s;

    &.active {
      background: $success;
      box-shadow: 0 0 8px rgba($success, 0.6);
    }
  }
}

// Chip Group
.chip-group {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-1;
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: $spacing-1;
  padding: $spacing-2 $spacing-3;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: $radius-md;
  color: $text-secondary;
  font-size: $font-size-xs;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: $border-secondary;
    color: $text-primary;
  }

  &.active {
    background: rgba($blue-primary, 0.2);
    border-color: $blue-primary;
    color: $blue-light;
  }

  &--alliance.active {
    background: rgba($faction-alliance, 0.15);
    border-color: $faction-alliance;
    color: lighten($faction-alliance, 25%);
  }

  &--horde.active {
    background: rgba($faction-horde, 0.12);
    border-color: lighten($faction-horde, 10%);
    color: lighten($faction-horde, 35%);
  }

  &__icon {
    font-size: $font-size-sm;
    line-height: 1;
  }

  &__label {
    @media (max-width: 640px) {
      display: none;
    }
  }
}

// Race Groups
.race-groups {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-2;
}

.race-group {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-1;
  padding: $spacing-2;
  border-radius: $radius-md;

  &--alliance {
    background: rgba($faction-alliance, 0.08);
    border: 1px solid rgba($faction-alliance, 0.25);
  }

  &--horde {
    background: rgba($faction-horde, 0.08);
    border: 1px solid rgba($faction-horde, 0.25);
  }
}

// Zone Select
.zone-select {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;

  &__wrapper {
    position: relative;
  }

  &__input {
    width: 100%;
    height: 40px;
    padding: 0 $spacing-10 0 $spacing-3;
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

  &__clear {
    position: absolute;
    right: $spacing-3;
    top: 50%;
    transform: translateY(-50%);
    background: none;
    border: none;
    color: $text-muted;
    font-size: $font-size-lg;
    cursor: pointer;
    line-height: 1;

    &:hover {
      color: $text-primary;
    }
  }

  &__dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 240px;
    overflow-y: auto;
    background: $bg-primary;
    border: 1px solid $border-secondary;
    border-radius: $radius-md;
    z-index: 1000;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  }

  &__option {
    display: flex;
    justify-content: space-between;
    width: 100%;
    padding: $spacing-3;
    background: none;
    border: none;
    border-bottom: 1px solid $border-primary;
    text-align: left;
    color: $text-secondary;
    font-size: $font-size-sm;
    cursor: pointer;
    transition: all 0.1s;

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: rgba($blue-primary, 0.1);
      color: $text-primary;
    }

    &.active {
      background: rgba($blue-primary, 0.15);
      color: $blue-light;
    }
  }

  &__count {
    color: $text-muted;
    font-size: $font-size-xs;
  }

  &__loading, &__empty {
    padding: $spacing-3;
    text-align: center;
    color: $text-muted;
    font-size: $font-size-sm;
  }
}

// Level Filter
.level-filter {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;

  &__controls {
    display: flex;
    flex-direction: column;
    gap: $spacing-2;
  }

  &__inputs {
    display: flex;
    align-items: center;
    gap: $spacing-2;
  }

  &__input {
    width: 64px;
    height: 40px;
    padding: 0 $spacing-2;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    color: $text-primary;
    font-size: $font-size-sm;
    text-align: center;

    &:focus {
      outline: none;
      border-color: $blue-primary;
    }

    // Hide spinners
    &::-webkit-outer-spin-button,
    &::-webkit-inner-spin-button {
      -webkit-appearance: none;
    }
    appearance: textfield;
    -moz-appearance: textfield;
  }

  &__sep {
    color: $text-muted;
  }

  &__presets {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-1;
  }
}

.level-preset {
  padding: $spacing-2 $spacing-3;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: $radius-md;
  color: $text-secondary;
  font-size: $font-size-xs;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: $border-secondary;
    color: $text-primary;
  }

  &.active {
    background: rgba($blue-primary, 0.2);
    border-color: $blue-primary;
    color: $blue-light;
  }
}

// Active Filters
.active-filters {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: $spacing-2;
  padding-top: $spacing-3;
  border-top: 1px solid $border-primary;

  &__tags {
    display: flex;
    flex-wrap: wrap;
    gap: $spacing-2;
    flex: 1;
  }
}

.tag {
  display: inline-flex;
  align-items: center;
  gap: $spacing-1;
  padding: $spacing-1 $spacing-2;
  background: $blue-primary;
  color: white;
  border-radius: $radius-sm;
  font-size: $font-size-xs;

  button {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    opacity: 0.7;
    padding: 0;
    font-size: $font-size-sm;

    &:hover {
      opacity: 1;
    }
  }

  &--online {
    background: #22c55e;
  }
}

.clear-all {
  padding: $spacing-1 $spacing-2;
  background: none;
  border: 1px solid $text-muted;
  border-radius: $radius-sm;
  color: $text-muted;
  font-size: $font-size-xs;
  cursor: pointer;

  &:hover {
    border-color: $text-primary;
    color: $text-primary;
  }
}
</style>
