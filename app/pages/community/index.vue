<script setup lang="ts">
/**
 * Community Hub Page
 * Shows online players and server statistics with URL-synced tabs
 */
import { useCommunityStore } from '~/stores/community'
import { useUrlTab } from '~/composables/useUrlTab'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiTabPanel from '~/components/ui/UiTabPanel.vue'
import UiPageHeader from '~/components/ui/UiPageHeader.vue'
import OnlinePlayersGrid from '~/components/community/OnlinePlayersGrid.vue'
import StatsOverview from '~/components/community/StatsOverview.vue'
import DistributionChart from '~/components/community/DistributionChart.vue'
import TopPlayersLeaderboard from '~/components/community/TopPlayersLeaderboard.vue'
import PvPStatistics from '~/components/community/PvPStatistics.vue'
import RealmFilter from '~/components/community/RealmFilter.vue'
import { getRaceName, getClassName } from '~/utils/wow'
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'

// Tab configuration
const tabs = [
  { id: 'online', label: 'Online Players', icon: '👥' },
  { id: 'stats', label: 'Player Stats', icon: '📊' },
]

// URL-synced tab state
const { activeTab } = useUrlTab('online')

// Community store
const communityStore = useCommunityStore()

// Sync realm filter with store
const selectedRealm = computed({
  get: () => communityStore.selectedRealm,
  set: (value: string) => {
    communityStore.setRealm(value)
    communityStore.fetchAllStats()
  },
})

// Load realms and online players on mount
onMounted(() => {
  communityStore.fetchRealms()
  communityStore.fetchOnlinePlayers()

  // Auto-refresh online players every 30 seconds
  const interval = setInterval(() => {
    communityStore.fetchOnlinePlayers()
  }, 30000)

  onUnmounted(() => clearInterval(interval))
})

// Load stats when switching to stats tab
watch(activeTab, (newTab) => {
  if (newTab === 'stats' && !communityStore.hasStatsData) {
    communityStore.fetchAllStats()
  }
}, { immediate: true })

// Refresh handlers
function refreshOnlinePlayers() {
  communityStore.fetchOnlinePlayers()
}

function refreshStats() {
  communityStore.fetchAllStats()
}

function handleMetricChange(metric: string) {
  communityStore.changeMetric(metric as 'level' | 'playtime' | 'achievements')
}

function handleClassSelect(classId: number | null) {
  communityStore.setClass(classId)
  communityStore.fetchAllStats()
}

function handleRaceSelect(raceId: number | null) {
  communityStore.setRace(raceId)
  communityStore.fetchAllStats()
}

function clearAllFilters() {
  communityStore.setClass(null)
  communityStore.setRace(null)
  communityStore.fetchAllStats()
}

function getMetricLabel(): string {
  switch (communityStore.selectedMetric) {
    case 'playtime': return 'Total Playtime'
    case 'achievements': return 'Achievements'
    default: return ''
  }
}
</script>

<template>
  <div class="community-page">
    <UiPageHeader title="Community Hub" />

    <UiTabs
      v-model="activeTab"
      :tabs="tabs"
    />

    <!-- Online Players Tab -->
    <UiTabPanel id="online" :active="activeTab === 'online'">
      <OnlinePlayersGrid
        :players="communityStore.onlinePlayers"
        :loading="communityStore.onlinePlayersLoading"
        @refresh="refreshOnlinePlayers"
      />
    </UiTabPanel>

    <!-- Stats Tab -->
    <UiTabPanel id="stats" :active="activeTab === 'stats'">
      <RealmFilter
        v-if="communityStore.realms && Object.keys(communityStore.realms).length > 0"
        v-model="selectedRealm"
        :realms="communityStore.realms"
      />

      <!-- Active Filters Indicator -->
      <div v-if="communityStore.selectedClass || communityStore.selectedRace" class="active-filters">
        <span class="filter-label">Active filters:</span>
        <span v-if="communityStore.selectedClass" class="filter-tag">
          {{ getClassName(communityStore.selectedClass) }}
          <button @click="handleClassSelect(null)">×</button>
        </span>
        <span v-if="communityStore.selectedRace" class="filter-tag">
          {{ getRaceName(communityStore.selectedRace) }}
          <button @click="handleRaceSelect(null)">×</button>
        </span>
        <button class="clear-all-btn" @click="clearAllFilters">Clear all</button>
      </div>

      <StatsOverview
        :stats="communityStore.generalStats"
        :loading="communityStore.statsLoading"
        @refresh="refreshStats"
      />

      <DistributionChart
        title="Class Distribution"
        icon="🎯"
        :distribution="communityStore.generalStats.classDistribution || {}"
        :total-characters="communityStore.generalStats.characters?.total || 0"
        type="class"
        :selected-id="communityStore.selectedClass"
        @select="handleClassSelect"
      />

      <DistributionChart
        title="Race Distribution"
        icon="🌍"
        :distribution="communityStore.generalStats.raceDistribution || {}"
        :total-characters="communityStore.generalStats.characters?.total || 0"
        type="race"
        :selected-id="communityStore.selectedRace"
        @select="handleRaceSelect"
      />

      <TopPlayersLeaderboard
        :players="communityStore.topPlayers"
        :loading="communityStore.topPlayersLoading"
        :selected-metric="communityStore.selectedMetric"
        :metric-label="getMetricLabel()"
        @change-metric="handleMetricChange"
      />

      <PvPStatistics
        :stats="communityStore.pvpStats"
        :loading="communityStore.pvpStatsLoading"
      />
    </UiTabPanel>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.community-page {
  @include container;
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
</style>
