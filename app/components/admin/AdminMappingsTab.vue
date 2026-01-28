<script setup lang="ts">
/**
 * AdminMappingsTab - Account mappings management
 */
import { formatDate } from '~/utils/format'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'

export interface Mapping {
  id: number
  keycloak_username: string
  wow_account_username: string
  wow_account_id: number
  created_at: string
  last_used: string | null
}

export interface Props {
  mappings: Mapping[]
  loading?: boolean
}

defineProps<Props>()

const columns = [
  { key: 'keycloak_username', label: 'Keycloak User' },
  { key: 'wow_account_username', label: 'WoW Account' },
  { key: 'wow_account_id', label: 'WoW Account ID', width: '140px' },
  { key: 'created_at', label: 'Created' },
  { key: 'last_used', label: 'Last Used' },
]
</script>

<template>
  <section class="admin-mappings-tab">
    <UiSectionHeader
      title="Account Mappings"
      subtitle="Keycloak User → WoW Account Mappings"
    />

    <UiLoadingState v-if="loading" message="Loading mappings..." />

    <div v-else class="mappings-table-container">
      <table class="mappings-table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" :style="{ width: col.width }">
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="mapping in mappings" :key="mapping.id">
            <td>{{ mapping.keycloak_username }}</td>
            <td>{{ mapping.wow_account_username }}</td>
            <td>{{ mapping.wow_account_id }}</td>
            <td>{{ formatDate(mapping.created_at) }}</td>
            <td>{{ mapping.last_used ? formatDate(mapping.last_used) : 'Never' }}</td>
          </tr>
        </tbody>
      </table>

      <UiEmptyState
        v-if="mappings.length === 0"
        message="No account mappings found"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.mappings-table-container {
  @include table-container;
}

.mappings-table {
  @include table-base;
}
</style>
