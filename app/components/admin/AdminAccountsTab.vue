<script setup lang="ts">
/**
 * AdminAccountsTab - All WoW accounts management
 */
import { formatDate } from '~/utils/format'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
import { computed } from 'vue'

export interface AccountRow {
  id: number
  username: string
  email: string | null
  online: boolean
  isGM: boolean
  gmLevel: number | null
  last_login: string | null
}

export interface Props {
  accounts: AccountRow[]
  loading?: boolean
  searchQuery: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:searchQuery': [value: string]
  viewAccount: [account: AccountRow]
}>()

const filteredAccounts = computed(() => {
  if (!props.searchQuery) return props.accounts

  const query = props.searchQuery.toLowerCase()
  return props.accounts.filter(account =>
    account.username.toLowerCase().includes(query) ||
    account.email?.toLowerCase().includes(query) ||
    account.id.toString().includes(query)
  )
})

const columns = [
  { key: 'id', label: 'ID', width: '80px' },
  { key: 'username', label: 'Username' },
  { key: 'email', label: 'Email' },
  { key: 'status', label: 'Status', width: '100px' },
  { key: 'gmLevel', label: 'GM Level', width: '100px' },
  { key: 'last_login', label: 'Last Login' },
  { key: 'actions', label: 'Actions', width: '100px' },
]
</script>

<template>
  <section class="admin-accounts-tab">
    <UiSectionHeader title="All WoW Accounts">
      <template #actions>
        <UiInput
          :model-value="searchQuery"
          type="search"
          placeholder="Search accounts..."
          class="search-input"
          @update:model-value="emit('update:searchQuery', $event as string)"
        />
      </template>
    </UiSectionHeader>

    <UiLoadingState v-if="loading" message="Loading accounts..." />

    <div v-else class="accounts-table-container">
      <table class="accounts-table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" :style="{ width: col.width }">
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="account in filteredAccounts" :key="account.id">
            <td>{{ account.id }}</td>
            <td>
              <span class="username">{{ account.username }}</span>
              <UiBadge v-if="account.isGM" variant="gm" size="sm" class="gm-badge">
                GM
              </UiBadge>
            </td>
            <td>{{ account.email || '-' }}</td>
            <td>
              <UiBadge :variant="account.online ? 'online' : 'offline'">
                {{ account.online ? 'Online' : 'Offline' }}
              </UiBadge>
            </td>
            <td>{{ account.gmLevel || '-' }}</td>
            <td>{{ formatDate(account.last_login) }}</td>
            <td>
              <UiButton size="sm" variant="ghost" @click="emit('viewAccount', account)">
                View
              </UiButton>
            </td>
          </tr>
        </tbody>
      </table>

      <UiEmptyState
        v-if="filteredAccounts.length === 0"
        message="No accounts found"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.search-input {
  min-width: 250px;
}

.accounts-table-container {
  @include table-container;
}

.accounts-table {
  @include table-base;
}

.username {
  font-weight: $font-weight-semibold;
  color: $blue-light;
}

.gm-badge {
  margin-left: $spacing-2;
}
</style>
