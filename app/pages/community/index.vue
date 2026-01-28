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
      />

      <DistributionChart
        title="Race Distribution"
        icon="🌍"
        :distribution="communityStore.generalStats.raceDistribution || {}"
        :total-characters="communityStore.generalStats.characters?.total || 0"
        type="race"
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
  padding-block: $spacing-8;
}
</style>
