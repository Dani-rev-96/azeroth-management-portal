<script setup lang="ts">
/**
 * AdminBackupTab - Database backup and restore interface
 * Allows GM to create mysqldump backups & restore from SQL files
 */
import UiButton from '~/components/ui/UiButton.vue'
import UiMessage from '~/components/ui/UiMessage.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'

export interface DatabaseInfo {
  type: 'auth' | 'characters'
  name: string
  realmId?: string
  realmName?: string
  host: string
  sizeBytes?: number
}

export interface Props {
  realms: Array<{ id: number | string; name: string }>
}

defineProps<Props>()

// State
const databases = ref<DatabaseInfo[]>([])
const loadingDatabases = ref(false)
const selectedBackupDbs = ref<Set<string>>(new Set())
const backupRealmId = ref('')
const creatingBackup = ref(false)
const backupError = ref('')
const backupSuccess = ref('')

// Restore state
const restoreDatabase = ref<'auth' | 'characters'>('auth')
const restoreRealmId = ref('')
const restoreFile = ref<File | null>(null)
const restoring = ref(false)
const restoreError = ref('')
const restoreSuccess = ref('')
const restoreConfirm = ref(false)

// Load databases on mount
onMounted(async () => {
  await loadDatabases()
})

async function loadDatabases() {
  loadingDatabases.value = true
  try {
    const data = await $fetch<{ databases: DatabaseInfo[] }>('/api/admin/backup/list')
    databases.value = data.databases || []
  } catch (error) {
    console.error('Failed to load databases:', error)
  } finally {
    loadingDatabases.value = false
  }
}

function toggleBackupDb(db: string) {
  if (selectedBackupDbs.value.has(db)) {
    selectedBackupDbs.value.delete(db)
  } else {
    selectedBackupDbs.value.add(db)
  }
  // Trigger reactivity
  selectedBackupDbs.value = new Set(selectedBackupDbs.value)
}

const needsRealmForBackup = computed(() => selectedBackupDbs.value.has('characters'))
const canCreateBackup = computed(() => {
  if (selectedBackupDbs.value.size === 0) return false
  if (needsRealmForBackup.value && !backupRealmId.value) return false
  return true
})

async function createBackup() {
  if (!canCreateBackup.value) return

  creatingBackup.value = true
  backupError.value = ''
  backupSuccess.value = ''

  try {
    const dbs = Array.from(selectedBackupDbs.value)
    const response = await $fetch('/api/admin/backup/create', {
      method: 'POST',
      body: {
        databases: dbs,
        realmId: needsRealmForBackup.value ? backupRealmId.value : undefined,
      },
      responseType: 'blob',
    })

    // Trigger download
    const blob = response as unknown as Blob
    const url = URL.createObjectURL(blob)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `backup-${timestamp}-${dbs.join('-')}.sql`

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    backupSuccess.value = `Backup downloaded: ${filename}`
  } catch (error: any) {
    backupError.value = error.data?.statusMessage || error.message || 'Failed to create backup'
  } finally {
    creatingBackup.value = false
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    if (!file.name.endsWith('.sql')) {
      restoreError.value = 'Only .sql files are accepted'
      restoreFile.value = null
      return
    }
    restoreFile.value = file
    restoreError.value = ''
  }
}

const canRestore = computed(() => {
  if (!restoreFile.value) return false
  if (restoreDatabase.value === 'characters' && !restoreRealmId.value) return false
  return restoreConfirm.value
})

async function handleRestore() {
  if (!canRestore.value || !restoreFile.value) return

  restoring.value = true
  restoreError.value = ''
  restoreSuccess.value = ''

  try {
    const sql = await restoreFile.value.text()

    const response = await $fetch<{ message: string }>('/api/admin/backup/restore', {
      method: 'POST',
      body: {
        sql,
        database: restoreDatabase.value,
        realmId: restoreDatabase.value === 'characters' ? restoreRealmId.value : undefined,
      },
    })

    restoreSuccess.value = response.message
    restoreFile.value = null
    restoreConfirm.value = false

    // Reset file input
    const fileInput = document.getElementById('restore-file') as HTMLInputElement
    if (fileInput) fileInput.value = ''

    // Reload database info
    await loadDatabases()
  } catch (error: any) {
    restoreError.value = error.data?.statusMessage || error.message || 'Failed to restore backup'
  } finally {
    restoring.value = false
  }
}

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return 'Unknown'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

const realmOptions = computed(() =>
  databases.value
    .filter((db: DatabaseInfo) => db.type === 'characters' && db.realmId)
    .map((db: DatabaseInfo) => ({
      value: db.realmId!,
      label: `${db.realmName} (${db.realmId})`,
    }))
)
</script>

<template>
  <div class="backup-tab">
    <!-- Backup Section -->
    <UiSectionHeader title="Create Backup" subtitle="Download a MySQL dump of auth and/or character databases" />

    <UiLoadingState v-if="loadingDatabases" message="Loading database info..." />

    <template v-else>
      <!-- Database Selection -->
      <div class="backup-section">
        <h4 class="section-label">Select Databases</h4>
        <div class="database-grid">
          <div
            v-for="db in databases"
            :key="`${db.type}-${db.realmId || 'auth'}`"
            :class="[
              'database-card',
              { 'database-card--selected': selectedBackupDbs.has(db.type) }
            ]"
            @click="toggleBackupDb(db.type)"
          >
            <div class="database-card__icon">
              {{ db.type === 'auth' ? '🔐' : '⚔️' }}
            </div>
            <div class="database-card__info">
              <span class="database-card__name">{{ db.name }}</span>
              <span v-if="db.realmName" class="database-card__realm">{{ db.realmName }}</span>
              <span class="database-card__meta">
                {{ db.host }} · {{ formatBytes(db.sizeBytes || 0) }}
              </span>
            </div>
            <div class="database-card__check">
              {{ selectedBackupDbs.has(db.type) ? '✓' : '' }}
            </div>
          </div>
        </div>

        <!-- Realm selector for characters -->
        <div v-if="needsRealmForBackup && realmOptions.length > 1" class="realm-select">
          <UiSelect
            v-model="backupRealmId"
            :options="realmOptions"
            placeholder="Select realm for character backup"
          />
        </div>

        <div class="backup-actions">
          <UiButton
            :loading="creatingBackup"
            :disabled="!canCreateBackup"
            @click="createBackup"
          >
            💾 Download Backup
          </UiButton>
        </div>

        <UiMessage v-if="backupError" variant="error" dismissible @dismiss="backupError = ''">
          {{ backupError }}
        </UiMessage>
        <UiMessage v-if="backupSuccess" variant="success" dismissible @dismiss="backupSuccess = ''">
          {{ backupSuccess }}
        </UiMessage>
      </div>
    </template>

    <!-- Restore Section -->
    <UiSectionHeader
      title="Restore Backup"
      subtitle="Upload a .sql file to restore a database. This is a destructive operation!"
    />

    <div class="restore-section">
      <div class="restore-form">
        <div class="form-row">
          <div class="form-field">
            <label class="form-label" for="restore-db">Target Database</label>
            <UiSelect
              id="restore-db"
              v-model="restoreDatabase"
              :options="[
                { value: 'auth', label: 'Auth (acore_auth)' },
                { value: 'characters', label: 'Characters (acore_characters)' },
              ]"
            />
          </div>

          <div v-if="restoreDatabase === 'characters'" class="form-field">
            <label class="form-label" for="restore-realm">Target Realm</label>
            <UiSelect
              id="restore-realm"
              v-model="restoreRealmId"
              :options="realmOptions"
              placeholder="Select realm"
            />
          </div>
        </div>

        <div class="form-field">
          <label class="form-label" for="restore-file">SQL File</label>
          <input
            id="restore-file"
            type="file"
            accept=".sql"
            class="file-input"
            @change="handleFileSelect"
          />
          <span v-if="restoreFile" class="file-info">
            {{ restoreFile.name }} ({{ formatBytes(restoreFile.size) }})
          </span>
        </div>

        <div class="danger-confirm">
          <label class="confirm-label">
            <input
              v-model="restoreConfirm"
              type="checkbox"
              class="confirm-checkbox"
            />
            <span class="confirm-text">
              ⚠️ I understand this will <strong>overwrite</strong> the existing database. This cannot be undone.
            </span>
          </label>
        </div>

        <div class="restore-actions">
          <UiButton
            variant="danger"
            :loading="restoring"
            :disabled="!canRestore"
            @click="handleRestore"
          >
            ⚠️ Restore Database
          </UiButton>
        </div>

        <UiMessage v-if="restoreError" variant="error" dismissible @dismiss="restoreError = ''">
          {{ restoreError }}
        </UiMessage>
        <UiMessage v-if="restoreSuccess" variant="success" dismissible @dismiss="restoreSuccess = ''">
          {{ restoreSuccess }}
        </UiMessage>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.backup-tab {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.backup-section,
.restore-section {
  @include card-base;
  margin-bottom: $spacing-6;
}

.section-label {
  font-size: $font-size-base;
  font-weight: $font-weight-semibold;
  color: $text-secondary;
  margin: 0 0 $spacing-4;
}

// Database Cards
.database-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: $spacing-3;
  margin-bottom: $spacing-4;
}

.database-card {
  display: flex;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-4;
  background: $bg-primary;
  border: 2px solid $border-primary;
  border-radius: $radius-lg;
  cursor: pointer;
  transition: all $transition-base;

  &:hover {
    border-color: $blue-light;
    background: rgba($blue-light, 0.05);
  }

  &--selected {
    border-color: $blue-primary;
    background: rgba($blue-primary, 0.1);
  }

  &__icon {
    font-size: $font-size-2xl;
    flex-shrink: 0;
  }

  &__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: $spacing-1;
    min-width: 0;
  }

  &__name {
    font-weight: $font-weight-semibold;
    color: $text-primary;
    font-size: $font-size-sm;
    font-family: monospace;
  }

  &__realm {
    color: $text-secondary;
    font-size: $font-size-xs;
  }

  &__meta {
    color: $text-muted;
    font-size: $font-size-xs;
  }

  &__check {
    font-size: $font-size-xl;
    color: $blue-primary;
    font-weight: $font-weight-bold;
    width: 24px;
    text-align: center;
  }
}

.realm-select {
  margin-bottom: $spacing-4;
  max-width: 400px;
}

.backup-actions,
.restore-actions {
  margin-top: $spacing-4;
}

// Restore Form
.restore-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: $spacing-4;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.form-label {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $text-secondary;
}

.file-input {
  padding: $spacing-3 $spacing-4;
  background: $bg-primary;
  border: 1px solid $border-primary;
  border-radius: $radius-lg;
  color: $text-primary;
  font-size: $font-size-sm;
  cursor: pointer;

  &::file-selector-button {
    padding: $spacing-2 $spacing-4;
    background: $bg-tertiary;
    border: 1px solid $border-primary;
    border-radius: $radius-md;
    color: $text-primary;
    cursor: pointer;
    margin-right: $spacing-3;
  }
}

.file-info {
  font-size: $font-size-xs;
  color: $text-muted;
}

.danger-confirm {
  padding: $spacing-4;
  background: rgba($error, 0.08);
  border: 1px solid rgba($error, 0.3);
  border-radius: $radius-lg;
}

.confirm-label {
  display: flex;
  align-items: flex-start;
  gap: $spacing-3;
  cursor: pointer;
}

.confirm-checkbox {
  margin-top: 3px;
  flex-shrink: 0;
  accent-color: $error;
}

.confirm-text {
  font-size: $font-size-sm;
  color: $text-secondary;
  line-height: 1.5;

  strong {
    color: $error-light;
  }
}
</style>
