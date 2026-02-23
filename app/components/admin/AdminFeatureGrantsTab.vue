<script setup lang="ts">
/**
 * AdminFeatureGrantsTab - Manage time-limited feature access for users
 * Allows GMs to grant non-GM users temporary access to admin features.
 */
import { formatDate } from '~/utils/wow'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiAutocomplete from '~/components/ui/UiAutocomplete.vue'
import type { AutocompleteItem } from '~/components/ui/UiAutocomplete.vue'
import { ref, computed, onMounted, watch } from 'vue'

interface Feature {
  id: string
  label: string
  description: string
  icon: string
}

interface FeatureGrant {
  id: number
  user_id: string
  username: string
  feature_id: string
  start_time: string
  end_time: string
  granted_by: string
  reason: string | null
  created_at: string
  featureLabel: string
  isActive: boolean
  isExpired: boolean
  isUpcoming: boolean
  ownAccountOnly: boolean
}

// State
const loading = ref(false)
const grants = ref<FeatureGrant[]>([])
const features = ref<Feature[]>([])
const error = ref('')
const success = ref('')
const deleting = ref<number | null>(null)

// Filter
const filterStatus = ref<'all' | 'active' | 'expired' | 'upcoming'>('all')

// Form state
const showForm = ref(false)
const formLoading = ref(false)
const form = ref({
  userId: '',
  username: '',
  featureId: '',
  startTime: '',
  endTime: '',
  reason: '',
  ownAccountOnly: false,
})

// User autocomplete
const userSearchResults = ref<AutocompleteItem[]>([])
const userSearchLoading = ref(false)
let userSearchTimeout: ReturnType<typeof setTimeout> | null = null

function handleUserSearch(query: string) {
  if (userSearchTimeout) clearTimeout(userSearchTimeout)
  if (query.length < 2) {
    userSearchResults.value = []
    return
  }
  userSearchTimeout = setTimeout(() => fetchUserSuggestions(query), 250)
}

async function fetchUserSuggestions(query: string) {
  userSearchLoading.value = true
  try {
    const data = await $fetch<{ users: Array<{ userId: string; username: string }> }>('/api/admin/feature-grants/users', {
      params: { q: query },
    })
    userSearchResults.value = (data.users || []).map(u => ({
      label: u.username,
      description: `ID: ${u.userId}`,
      value: u,
    }))
  } catch {
    userSearchResults.value = []
  } finally {
    userSearchLoading.value = false
  }
}

function handleUserSelect(item: AutocompleteItem) {
  const user = item.value as { userId: string; username: string }
  selectedFromAutocomplete = true
  form.value.userId = user.userId
  form.value.username = user.username
}

// Track whether the username was set via autocomplete selection
let selectedFromAutocomplete = false

watch(() => form.value.username, () => {
  if (selectedFromAutocomplete) {
    selectedFromAutocomplete = false
    return
  }
  // User typed manually — clear the auto-filled userId so they must re-select
  form.value.userId = ''
})

// Computed
const filteredGrants = computed(() => {
  if (filterStatus.value === 'all') return grants.value
  return grants.value.filter(g => {
    if (filterStatus.value === 'active') return g.isActive
    if (filterStatus.value === 'expired') return g.isExpired
    if (filterStatus.value === 'upcoming') return g.isUpcoming
    return true
  })
})

const activeCount = computed(() => grants.value.filter(g => g.isActive).length)
const expiredCount = computed(() => grants.value.filter(g => g.isExpired).length)
const upcomingCount = computed(() => grants.value.filter(g => g.isUpcoming).length)

const columns = [
  { key: 'username', label: 'User' },
  { key: 'feature', label: 'Feature' },
  { key: 'status', label: 'Status', width: '110px' },
  { key: 'start_time', label: 'Start' },
  { key: 'end_time', label: 'End' },
  { key: 'granted_by', label: 'Granted By' },
  { key: 'reason', label: 'Reason' },
  { key: 'actions', label: '', width: '80px' },
]

// Methods
async function fetchGrants() {
  loading.value = true
  try {
    const data = await $fetch<{ grants: FeatureGrant[] }>('/api/admin/feature-grants')
    grants.value = data.grants || []
  } catch (err: any) {
    console.error('Failed to fetch feature grants:', err)
    error.value = err.data?.statusMessage || 'Failed to load feature grants'
  } finally {
    loading.value = false
  }
}

async function fetchFeatures() {
  try {
    const data = await $fetch<{ features: Feature[] }>('/api/admin/features')
    features.value = data.features || []
  } catch (err: any) {
    console.error('Failed to fetch features:', err)
  }
}

function openForm() {
  error.value = ''
  success.value = ''
  userSearchResults.value = []
  form.value = {
    userId: '',
    username: '',
    featureId: features.value[0]?.id || '',
    startTime: toLocalDatetime(new Date()),
    endTime: toLocalDatetime(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
    reason: '',
    ownAccountOnly: false,
  }
  showForm.value = true
}

function closeForm() {
  showForm.value = false
}

function toLocalDatetime(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

async function handleSubmit() {
  error.value = ''
  success.value = ''

  // Validation
  if (!form.value.username.trim()) {
    error.value = 'Please select a user or enter a username'
    return
  }
  if (!form.value.userId.trim()) {
    error.value = 'User ID is required — select a user from the autocomplete suggestions'
    return
  }
  if (!form.value.featureId) {
    error.value = 'Please select a feature'
    return
  }
  if (!form.value.startTime || !form.value.endTime) {
    error.value = 'Start and end times are required'
    return
  }

  const startISO = new Date(form.value.startTime).toISOString()
  const endISO = new Date(form.value.endTime).toISOString()

  if (endISO <= startISO) {
    error.value = 'End time must be after start time'
    return
  }

  formLoading.value = true
  try {
    await $fetch('/api/admin/feature-grants', {
      method: 'POST',
      body: {
        userId: form.value.userId.trim(),
        username: form.value.username.trim(),
        featureId: form.value.featureId,
        startTime: startISO,
        endTime: endISO,
        reason: form.value.reason.trim() || undefined,
        ownAccountOnly: form.value.ownAccountOnly,
      },
    })

    success.value = `Granted "${features.value.find(f => f.id === form.value.featureId)?.label || form.value.featureId}" to ${form.value.username}`
    showForm.value = false
    await fetchGrants()
  } catch (err: any) {
    error.value = err.data?.statusMessage || err.message || 'Failed to create grant'
  } finally {
    formLoading.value = false
  }
}

async function handleDelete(grant: FeatureGrant) {
  if (!confirm(`Revoke "${grant.featureLabel}" access for ${grant.username}?`)) return

  deleting.value = grant.id
  error.value = ''

  try {
    await $fetch(`/api/admin/feature-grants/${grant.id}`, { method: 'DELETE' })
    success.value = `Revoked "${grant.featureLabel}" from ${grant.username}`
    await fetchGrants()
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Failed to revoke grant'
  } finally {
    deleting.value = null
  }
}

function getStatusVariant(grant: FeatureGrant): 'success' | 'error' | 'warning' {
  if (grant.isActive) return 'success'
  if (grant.isUpcoming) return 'warning'
  return 'error'
}

function getStatusLabel(grant: FeatureGrant): string {
  if (grant.isActive) return 'Active'
  if (grant.isUpcoming) return 'Upcoming'
  return 'Expired'
}

onMounted(() => {
  fetchFeatures()
  fetchGrants()
})
</script>

<template>
  <section class="feature-grants-tab">
    <UiSectionHeader title="Feature Grants" subtitle="Grant time-limited admin feature access to users">
      <template #actions>
        <UiButton variant="admin" size="sm" @click="openForm">
          + New Grant
        </UiButton>
      </template>
    </UiSectionHeader>

    <!-- Status Messages -->
    <div v-if="error" class="message message--error">
      {{ error }}
      <button class="message__close" @click="error = ''">&times;</button>
    </div>
    <div v-if="success" class="message message--success">
      {{ success }}
      <button class="message__close" @click="success = ''">&times;</button>
    </div>

    <!-- Create Grant Form -->
    <div v-if="showForm" class="grant-form">
      <h3 class="grant-form__title">Create Feature Grant</h3>

      <div class="grant-form__grid">
        <div class="grant-form__field grant-form__field--full">
          <label class="grant-form__label">User</label>
          <UiAutocomplete
            v-model="form.username"
            :items="userSearchResults"
            :loading="userSearchLoading"
            :disabled="formLoading"
            :min-chars="2"
            placeholder="Search by username or user ID..."
            no-results-text="No matching users found"
            @search="handleUserSearch"
            @select="handleUserSelect"
          />
          <span v-if="form.userId" class="grant-form__hint">
            User ID: <strong>{{ form.userId }}</strong>
          </span>
          <span v-else class="grant-form__hint">
            Start typing to search known users. User ID will be filled automatically.
          </span>
        </div>

        <div class="grant-form__field">
          <label class="grant-form__label">Feature</label>
          <select
            v-model="form.featureId"
            class="grant-form__select"
            :disabled="formLoading"
          >
            <option v-for="feature in features" :key="feature.id" :value="feature.id">
              {{ feature.icon }} {{ feature.label }}
            </option>
          </select>
        </div>

        <div class="grant-form__field">
          <label class="grant-form__label">Reason (optional)</label>
          <UiInput
            v-model="form.reason"
            placeholder="Why is access being granted?"
            :disabled="formLoading"
          />
        </div>

        <div class="grant-form__field grant-form__field--checkbox">
          <label class="grant-form__checkbox-label">
            <input
              v-model="form.ownAccountOnly"
              type="checkbox"
              class="grant-form__checkbox"
              :disabled="formLoading"
            />
            <span>Own account only</span>
          </label>
          <span class="grant-form__hint">If checked, user can only edit characters on their own linked WoW account</span>
        </div>

        <div class="grant-form__field">
          <label class="grant-form__label">Start Time</label>
          <input
            v-model="form.startTime"
            type="datetime-local"
            class="grant-form__datetime"
            :disabled="formLoading"
          />
        </div>

        <div class="grant-form__field">
          <label class="grant-form__label">End Time</label>
          <input
            v-model="form.endTime"
            type="datetime-local"
            class="grant-form__datetime"
            :disabled="formLoading"
          />
        </div>
      </div>

      <div class="grant-form__actions">
        <UiButton variant="ghost" size="sm" :disabled="formLoading" @click="closeForm">
          Cancel
        </UiButton>
        <UiButton variant="admin" size="sm" :disabled="formLoading" @click="handleSubmit">
          {{ formLoading ? 'Creating...' : 'Create Grant' }}
        </UiButton>
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="filter-bar">
      <button
        class="filter-btn"
        :class="{ 'filter-btn--active': filterStatus === 'all' }"
        @click="filterStatus = 'all'"
      >
        All ({{ grants.length }})
      </button>
      <button
        class="filter-btn filter-btn--success"
        :class="{ 'filter-btn--active': filterStatus === 'active' }"
        @click="filterStatus = 'active'"
      >
        Active ({{ activeCount }})
      </button>
      <button
        class="filter-btn filter-btn--warning"
        :class="{ 'filter-btn--active': filterStatus === 'upcoming' }"
        @click="filterStatus = 'upcoming'"
      >
        Upcoming ({{ upcomingCount }})
      </button>
      <button
        class="filter-btn filter-btn--error"
        :class="{ 'filter-btn--active': filterStatus === 'expired' }"
        @click="filterStatus = 'expired'"
      >
        Expired ({{ expiredCount }})
      </button>
    </div>

    <!-- Grants Table -->
    <UiLoadingState v-if="loading" message="Loading feature grants..." />

    <div v-else class="grants-table-container">
      <table class="grants-table">
        <thead>
          <tr>
            <th v-for="col in columns" :key="col.key" :style="{ width: col.width }">
              {{ col.label }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="grant in filteredGrants" :key="grant.id" :class="{ 'row--expired': grant.isExpired }">
            <td>
              <span class="username">{{ grant.username }}</span>
              <span class="user-id">{{ grant.user_id }}</span>
            </td>
            <td>
              {{ grant.featureLabel }}
              <span v-if="grant.ownAccountOnly" class="own-account-badge" title="Own account characters only">🔒 Own</span>
            </td>
            <td>
              <UiBadge :variant="getStatusVariant(grant)" size="sm">
                {{ getStatusLabel(grant) }}
              </UiBadge>
            </td>
            <td>{{ formatDate(grant.start_time) }}</td>
            <td>{{ formatDate(grant.end_time) }}</td>
            <td>{{ grant.granted_by }}</td>
            <td>
              <span class="reason">{{ grant.reason || '-' }}</span>
            </td>
            <td>
              <UiButton
                variant="danger"
                size="sm"
                :disabled="deleting === grant.id"
                @click="handleDelete(grant)"
              >
                {{ deleting === grant.id ? '...' : 'Revoke' }}
              </UiButton>
            </td>
          </tr>
        </tbody>
      </table>

      <UiEmptyState
        v-if="filteredGrants.length === 0 && !loading"
        icon="🔓"
        :message="filterStatus === 'all' ? 'No feature grants yet' : `No ${filterStatus} grants`"
      />
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

// Messages
.message {
  padding: $spacing-3 $spacing-4;
  border-radius: $radius-md;
  margin-bottom: $spacing-4;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: $font-size-sm;

  &--error {
    background: $error-bg;
    color: $error-light;
    border: 1px solid rgba($error, 0.3);
  }

  &--success {
    background: $success-bg;
    color: $success-light;
    border: 1px solid rgba($success, 0.3);
  }

  &__close {
    background: none;
    border: none;
    color: inherit;
    cursor: pointer;
    font-size: $font-size-lg;
    padding: 0 $spacing-1;
    opacity: 0.7;

    &:hover {
      opacity: 1;
    }
  }
}

// Grant Form
.grant-form {
  @include card-base;
  padding: $spacing-6;
  margin-bottom: $spacing-6;
  border: 1px solid rgba($orange-primary, 0.2);

  &__title {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin-bottom: $spacing-4;
  }

  &__grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: $spacing-4;
    margin-bottom: $spacing-4;

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  }

  &__field {
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
  }

  &__label {
    font-size: $font-size-sm;
    font-weight: $font-weight-medium;
    color: $text-secondary;
  }

  &__select,
  &__datetime {
    width: 100%;
    padding: $spacing-2 $spacing-3;
    background: $bg-tertiary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    color: $text-primary;
    font-size: $font-size-sm;
    font-family: inherit;
    transition: border-color 0.2s;

    &:focus {
      outline: none;
      border-color: $orange-primary;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: $spacing-2;
    padding-top: $spacing-2;
    border-top: 1px solid $border-primary;
  }

  &__field--checkbox {
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
    justify-content: center;
  }

  &__field--full {
    grid-column: 1 / -1;
  }

  &__checkbox-label {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    cursor: pointer;
    font-size: $font-size-sm;
    color: $text-primary;
  }

  &__checkbox {
    width: 16px;
    height: 16px;
    accent-color: $orange-primary;
    cursor: pointer;
  }

  &__hint {
    font-size: $font-size-xs;
    color: $text-muted;
  }
}

.own-account-badge {
  display: inline-block;
  margin-left: $spacing-1;
  padding: 1px $spacing-1;
  font-size: 10px;
  background: rgba($warning, 0.15);
  color: $warning;
  border-radius: $radius-sm;
  font-weight: $font-weight-semibold;
  vertical-align: middle;
}

// Filter Bar
.filter-bar {
  display: flex;
  gap: $spacing-2;
  margin-bottom: $spacing-4;
  flex-wrap: wrap;
}

.filter-btn {
  padding: $spacing-1 $spacing-3;
  border-radius: $radius-full;
  border: 1px solid $border-primary;
  background: transparent;
  color: $text-secondary;
  font-size: $font-size-xs;
  cursor: pointer;
  transition: all 0.2s;

  &:hover {
    border-color: $text-secondary;
    color: $text-primary;
  }

  &--active {
    background: rgba($text-primary, 0.1);
    border-color: $text-primary;
    color: $text-primary;
  }

  &--success.filter-btn--active {
    background: $success-bg;
    border-color: $success;
    color: $success-light;
  }

  &--warning.filter-btn--active {
    background: $warning-bg;
    border-color: $warning;
    color: $warning-light;
  }

  &--error.filter-btn--active {
    background: $error-bg;
    border-color: $error;
    color: $error-light;
  }
}

// Table
.grants-table-container {
  @include table-container;
}

.grants-table {
  @include table-base;
}

.username {
  font-weight: $font-weight-semibold;
  color: $blue-light;
  display: block;
}

.user-id {
  font-size: $font-size-xs;
  color: $text-muted;
}

.reason {
  font-size: $font-size-xs;
  color: $text-secondary;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
}

.row--expired {
  opacity: 0.5;
}
</style>
