<script setup lang="ts">
/**
 * AdminLinkAccountsTab - Admin interface to link/unlink accounts
 * Allows GMs to manage account mappings without requiring user credentials
 */
import { formatDate } from '~/utils/wow'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
import UiFormGroup from '~/components/ui/UiFormGroup.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiMessage from '~/components/ui/UiMessage.vue'

export interface Mapping {
  id: number
  external_id: string
  display_name: string
  email: string | null
  wow_account_username: string
  wow_account_id: number
  created_at: string
  last_used: string | null
}

export interface WoWAccount {
  id: number
  username: string
  email: string | null
}

export interface Props {
  mappings: Mapping[]
  accounts: WoWAccount[]
  loading?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  refresh: []
}>()

// Form state
const linkForm = reactive({
  externalId: '',
  displayName: '',
  email: '',
  wowAccountId: null as number | null,
})

// Account search state
const accountSearchQuery = ref('')
const showAccountDropdown = ref(false)
const selectedAccountDisplay = ref('')

// Filter out bot accounts (RNDBOT) and search
const availableAccounts = computed(() => {
  return props.accounts.filter(acc => !acc.username.toUpperCase().startsWith('RNDBOT'))
})

const filteredAccountOptions = computed(() => {
  if (!accountSearchQuery.value) return availableAccounts.value.slice(0, 20)

  const query = accountSearchQuery.value.toLowerCase()
  return availableAccounts.value
    .filter(acc =>
      acc.username.toLowerCase().includes(query) ||
      acc.id.toString().includes(query)
    )
    .slice(0, 20)
})

function selectAccount(account: WoWAccount) {
  linkForm.wowAccountId = account.id
  selectedAccountDisplay.value = `${account.username} (ID: ${account.id})`
  accountSearchQuery.value = ''
  showAccountDropdown.value = false
}

function clearAccountSelection() {
  linkForm.wowAccountId = null
  selectedAccountDisplay.value = ''
  accountSearchQuery.value = ''
}

function handleAccountInputFocus() {
  showAccountDropdown.value = true
}

function handleAccountInputBlur() {
  // Delay to allow click on dropdown item
  setTimeout(() => {
    showAccountDropdown.value = false
  }, 200)
}

const linkLoading = ref(false)
const linkError = ref('')
const linkSuccess = ref('')

const unlinkLoading = ref<number | null>(null)
const unlinkError = ref('')
const unlinkSuccess = ref('')

// Search/filter state
const searchQuery = ref('')

const filteredMappings = computed(() => {
  if (!searchQuery.value) return props.mappings

  const query = searchQuery.value.toLowerCase()
  return props.mappings.filter(mapping =>
    mapping.display_name.toLowerCase().includes(query) ||
    mapping.external_id.toLowerCase().includes(query) ||
    mapping.wow_account_username.toLowerCase().includes(query) ||
    mapping.wow_account_id.toString().includes(query)
  )
})

async function handleLink() {
  if (!linkForm.externalId || !linkForm.displayName || !linkForm.wowAccountId) {
    linkError.value = 'External ID, Display Name, and WoW Account ID are required'
    return
  }

  linkLoading.value = true
  linkError.value = ''
  linkSuccess.value = ''

  try {
    const response = await $fetch<{ message: string }>('/api/admin/account-mappings', {
      method: 'POST',
      body: {
        externalId: linkForm.externalId,
        displayName: linkForm.displayName,
        email: linkForm.email || undefined,
        wowAccountId: linkForm.wowAccountId,
      },
    })

    linkSuccess.value = response.message
    // Reset form
    linkForm.externalId = ''
    linkForm.displayName = ''
    linkForm.email = ''
    linkForm.wowAccountId = null
    selectedAccountDisplay.value = ''
    // Refresh mappings list
    emit('refresh')
  } catch (error: any) {
    linkError.value = error.data?.statusMessage || error.message || 'Failed to link account'
  } finally {
    linkLoading.value = false
  }
}

async function handleUnlink(mapping: Mapping) {
  if (!confirm(`Are you sure you want to unlink "${mapping.display_name}" from WoW account "${mapping.wow_account_username}"?`)) {
    return
  }

  unlinkLoading.value = mapping.id
  unlinkError.value = ''
  unlinkSuccess.value = ''

  try {
    const response = await $fetch<{ message: string }>(`/api/admin/account-mappings/${mapping.id}`, {
      method: 'DELETE',
    })

    unlinkSuccess.value = response.message
    // Refresh mappings list
    emit('refresh')
  } catch (error: any) {
    unlinkError.value = error.data?.statusMessage || error.message || 'Failed to unlink account'
  } finally {
    unlinkLoading.value = null
  }
}

const columns = [
  { key: 'display_name', label: 'External User' },
  { key: 'external_id', label: 'External ID' },
  { key: 'wow_account_username', label: 'WoW Account' },
  { key: 'wow_account_id', label: 'WoW ID', width: '100px' },
  { key: 'created_at', label: 'Created' },
  { key: 'actions', label: 'Actions', width: '120px' },
]
</script>

<template>
  <section class="admin-link-accounts-tab">
    <!-- Link Account Form -->
    <div class="link-form-section">
      <h3 class="link-form-section__title">Link External User to WoW Account</h3>
      <p class="link-form-section__description">
        Create a mapping between an external identity (e.g., OAuth/Keycloak user) and a WoW account without requiring the user's credentials.
      </p>

      <form class="link-form" @submit.prevent="handleLink">
        <div class="form-row">
          <UiFormGroup label="External ID" html-for="link-external-id" required hint="Unique identifier from OAuth provider (UUID or username)">
            <UiInput
              id="link-external-id"
              v-model="linkForm.externalId"
              type="text"
              placeholder="e.g., 1d75c34b-ef27-41bc-849a-ae6b5747c66a"
              required
            />
          </UiFormGroup>

          <UiFormGroup label="Display Name" html-for="link-display-name" required hint="Username to display in the UI">
            <UiInput
              id="link-display-name"
              v-model="linkForm.displayName"
              type="text"
              placeholder="e.g., daniel"
              required
            />
          </UiFormGroup>
        </div>

        <div class="form-row">
          <UiFormGroup label="Email" html-for="link-email" hint="Optional email address">
            <UiInput
              id="link-email"
              v-model="linkForm.email"
              type="email"
              placeholder="user@example.com"
            />
          </UiFormGroup>

          <UiFormGroup label="WoW Account" html-for="link-wow-account" required hint="Search by account name or ID">
            <div class="account-search">
              <div v-if="linkForm.wowAccountId" class="selected-account">
                <span>{{ selectedAccountDisplay }}</span>
                <button type="button" class="clear-btn" @click="clearAccountSelection">×</button>
              </div>
              <template v-else>
                <UiInput
                  id="link-wow-account"
                  v-model="accountSearchQuery"
                  type="text"
                  placeholder="Search account name or ID..."
                  autocomplete="off"
                  @focus="handleAccountInputFocus"
                  @blur="handleAccountInputBlur"
                />
                <div v-if="showAccountDropdown && filteredAccountOptions.length > 0" class="account-dropdown">
                  <div
                    v-for="account in filteredAccountOptions"
                    :key="account.id"
                    class="account-option"
                    @mousedown.prevent="selectAccount(account)"
                  >
                    <span class="account-name">{{ account.username }}</span>
                    <span class="account-id">ID: {{ account.id }}</span>
                  </div>
                </div>
                <div v-else-if="showAccountDropdown && accountSearchQuery && filteredAccountOptions.length === 0" class="account-dropdown">
                  <div class="no-results">No accounts found</div>
                </div>
              </template>
            </div>
          </UiFormGroup>
        </div>

        <div class="link-form__actions">
          <UiButton type="submit" :loading="linkLoading" :disabled="!linkForm.externalId || !linkForm.displayName || !linkForm.wowAccountId">
            🔗 Link Account
          </UiButton>
        </div>

        <UiMessage v-if="linkError" variant="error">{{ linkError }}</UiMessage>
        <UiMessage v-if="linkSuccess" variant="success">{{ linkSuccess }}</UiMessage>
      </form>
    </div>

    <!-- Existing Mappings -->
    <UiSectionHeader title="Existing Mappings" subtitle="Manage linked accounts">
      <template #actions>
        <UiInput
          v-model="searchQuery"
          type="search"
          placeholder="Search mappings..."
          class="search-input"
        />
      </template>
    </UiSectionHeader>

    <UiMessage v-if="unlinkError" variant="error" class="unlink-message">{{ unlinkError }}</UiMessage>
    <UiMessage v-if="unlinkSuccess" variant="success" class="unlink-message">{{ unlinkSuccess }}</UiMessage>

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
          <tr v-for="mapping in filteredMappings" :key="mapping.id">
            <td class="display-name">{{ mapping.display_name }}</td>
            <td class="external-id">{{ mapping.external_id }}</td>
            <td>{{ mapping.wow_account_username }}</td>
            <td>{{ mapping.wow_account_id }}</td>
            <td>{{ formatDate(mapping.created_at) }}</td>
            <td>
              <UiButton
                size="sm"
                variant="danger"
                :loading="unlinkLoading === mapping.id"
                @click="handleUnlink(mapping)"
              >
                Unlink
              </UiButton>
            </td>
          </tr>
        </tbody>
      </table>

      <UiEmptyState
        v-if="filteredMappings.length === 0"
        :message="searchQuery ? 'No mappings match your search' : 'No account mappings found'"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.link-form-section {
  @include card-base;
  margin-bottom: $spacing-8;

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin: 0 0 $spacing-2;
  }

  &__description {
    font-size: $font-size-sm;
    color: $text-muted;
    margin: 0 0 $spacing-6;
  }
}

.link-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;

  &__actions {
    margin-top: $spacing-2;
  }
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: $spacing-4;
}

.search-input {
  min-width: 250px;
}

.unlink-message {
  margin-bottom: $spacing-4;
}

.mappings-table-container {
  @include table-container;
}

.mappings-table {
  @include table-base;
}

.display-name {
  font-weight: $font-weight-semibold;
  color: $blue-light;
}

.external-id {
  font-family: monospace;
  font-size: $font-size-sm;
  color: $text-muted;
}

.account-search {
  position: relative;
}

.selected-account {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: $spacing-3 $spacing-4;
  background: rgba($blue-light, 0.1);
  border: 1px solid rgba($blue-light, 0.3);
  border-radius: $radius-md;
  color: $text-primary;
  font-weight: $font-weight-medium;

  .clear-btn {
    background: none;
    border: none;
    color: $text-muted;
    cursor: pointer;
    font-size: $font-size-lg;
    padding: 0 $spacing-2;
    line-height: 1;

    &:hover {
      color: $error-light;
    }
  }
}

.account-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 100;
  max-height: 250px;
  overflow-y: auto;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: $radius-md;
  margin-top: $spacing-1;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.account-option {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-3 $spacing-4;
  cursor: pointer;
  transition: background-color 0.15s ease;

  &:hover {
    background: rgba($blue-light, 0.1);
  }

  .account-name {
    font-weight: $font-weight-medium;
    color: $blue-light;
  }

  .account-id {
    font-size: $font-size-sm;
    color: $text-muted;
  }
}

.no-results {
  padding: $spacing-4;
  text-align: center;
  color: $text-muted;
  font-size: $font-size-sm;
}
</style>
