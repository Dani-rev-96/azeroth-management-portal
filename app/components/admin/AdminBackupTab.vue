<script setup lang="ts">
/**
 * AdminBackupTab - Database backup and restore interface
 * Allows GM to create mysqldump backups & restore from SQL files
 * Also supports portal SQLite database backup & restore
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

export interface PortalDbInfo {
  key: string
  name: string
  path: string
  sizeBytes: number
  exists: boolean
}

export interface Props {
  realms: Array<{ id: number | string; name: string }>
}

defineProps<Props>()

// ─── MySQL Backup State ─────────────────────────────────────────────────────────

const databases = ref<DatabaseInfo[]>([])
const loadingDatabases = ref(false)
/** Set of unique keys: 'auth' or 'characters-<realmId>' */
const selectedBackupDbs = ref<Set<string>>(new Set())
const creatingBackup = ref(false)
const backupError = ref('')
const backupSuccess = ref('')

// MySQL Restore state
const restoreDatabase = ref<'auth' | 'characters'>('auth')
const restoreRealmId = ref('')
const restoreFile = ref<File | null>(null)
const restoring = ref(false)
const restoreError = ref('')
const restoreSuccess = ref('')
const restoreConfirm = ref(false)

// ─── Portal (SQLite) Backup State ───────────────────────────────────────────────

const portalDatabases = ref<PortalDbInfo[]>([])
const loadingPortalDbs = ref(false)
const portalBackupLoading = ref<Record<string, boolean>>({})
const portalBackupError = ref('')
const portalBackupSuccess = ref('')

const portalRestoreDb = ref('')
const portalRestoreFile = ref<File | null>(null)
const portalRestoring = ref(false)
const portalRestoreError = ref('')
const portalRestoreSuccess = ref('')
const portalRestoreConfirm = ref(false)

// ─── Lifecycle ──────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadDatabases(), loadPortalDatabases()])
})

// ─── MySQL Backup Logic ─────────────────────────────────────────────────────────

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

/** Unique key per database entry (auth is unique, characters are per-realm) */
function dbKey(db: DatabaseInfo): string {
  return db.type === 'auth' ? 'auth' : `characters-${db.realmId}`
}

function toggleBackupDb(key: string) {
  if (selectedBackupDbs.value.has(key)) {
    selectedBackupDbs.value.delete(key)
  } else {
    selectedBackupDbs.value.add(key)
  }
  // Trigger reactivity
  selectedBackupDbs.value = new Set(selectedBackupDbs.value)
}

const canCreateBackup = computed(() => selectedBackupDbs.value.size > 0)

async function createBackup() {
  if (!canCreateBackup.value) return

  creatingBackup.value = true
  backupError.value = ''
  backupSuccess.value = ''

  try {
    // Derive which database types and which realmId from the selected keys
    const selected = Array.from(selectedBackupDbs.value)
    const dbs: ('auth' | 'characters')[] = []
    let realmId: string | undefined

    for (const key of selected) {
      if (key === 'auth') {
        dbs.push('auth')
      } else if (key.startsWith('characters-')) {
        dbs.push('characters')
        realmId = key.replace('characters-', '')
      }
    }

    const response = await $fetch('/api/admin/backup/create', {
      method: 'POST',
      body: { databases: dbs, realmId },
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

const realmOptions = computed(() =>
  databases.value
    .filter((db: DatabaseInfo) => db.type === 'characters' && db.realmId)
    .map((db: DatabaseInfo) => ({
      value: db.realmId!,
      label: `${db.realmName} (${db.realmId})`,
    }))
)

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

// ─── Portal (SQLite) Backup Logic ───────────────────────────────────────────────

async function loadPortalDatabases() {
  loadingPortalDbs.value = true
  try {
    const data = await $fetch<{ databases: PortalDbInfo[] }>('/api/admin/backup/portal-list')
    portalDatabases.value = data.databases || []
    // Default restore target to first DB
    if (portalDatabases.value.length > 0 && !portalRestoreDb.value) {
      portalRestoreDb.value = portalDatabases.value[0]!.key
    }
  } catch (error) {
    console.error('Failed to load portal databases:', error)
  } finally {
    loadingPortalDbs.value = false
  }
}

async function downloadPortalBackup(db: PortalDbInfo) {
  portalBackupLoading.value = { ...portalBackupLoading.value, [db.key]: true }
  portalBackupError.value = ''
  portalBackupSuccess.value = ''

  try {
    const response = await $fetch('/api/admin/backup/portal-create', {
      method: 'POST',
      body: { database: db.key },
      responseType: 'blob',
    })

    const blob = response as unknown as Blob
    const url = URL.createObjectURL(blob)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const filename = `portal-${db.key}-${timestamp}.db`

    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    portalBackupSuccess.value = `Downloaded: ${filename}`
  } catch (error: any) {
    portalBackupError.value = error.data?.statusMessage || error.message || 'Failed to download backup'
  } finally {
    portalBackupLoading.value = { ...portalBackupLoading.value, [db.key]: false }
  }
}

function handlePortalFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    if (!file.name.endsWith('.db')) {
      portalRestoreError.value = 'Only .db (SQLite) files are accepted'
      portalRestoreFile.value = null
      return
    }
    portalRestoreFile.value = file
    portalRestoreError.value = ''
  }
}

const portalRestoreOptions = computed(() =>
  portalDatabases.value.map(db => ({
    value: db.key,
    label: db.name,
  }))
)

const canPortalRestore = computed(() => {
  if (!portalRestoreFile.value) return false
  if (!portalRestoreDb.value) return false
  return portalRestoreConfirm.value
})

async function handlePortalRestore() {
  if (!canPortalRestore.value || !portalRestoreFile.value) return

  portalRestoring.value = true
  portalRestoreError.value = ''
  portalRestoreSuccess.value = ''

  try {
    const arrayBuffer = await portalRestoreFile.value.arrayBuffer()
    const base64 = btoa(
      new Uint8Array(arrayBuffer).reduce((data, byte) => data + String.fromCharCode(byte), '')
    )

    const response = await $fetch<{ message: string }>('/api/admin/backup/portal-restore', {
      method: 'POST',
      body: {
        database: portalRestoreDb.value,
        data: base64,
      },
    })

    portalRestoreSuccess.value = response.message
    portalRestoreFile.value = null
    portalRestoreConfirm.value = false

    // Reset file input
    const fileInput = document.getElementById('portal-restore-file') as HTMLInputElement
    if (fileInput) fileInput.value = ''

    await loadPortalDatabases()
  } catch (error: any) {
    portalRestoreError.value = error.data?.statusMessage || error.message || 'Failed to restore backup'
  } finally {
    portalRestoring.value = false
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return 'Unknown'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}
</script>

<template>
  <div class="backup-tab">
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- MySQL Backup Section                                                  -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <UiSectionHeader title="Create Backup" subtitle="Download a MySQL dump of auth and/or character databases" />

    <UiLoadingState v-if="loadingDatabases" message="Loading database info..." />

    <template v-else>
      <div class="backup-section">
        <h4 class="section-label">Select Databases</h4>
        <div class="database-grid">
          <div
            v-for="db in databases"
            :key="dbKey(db)"
            :class="[
              'database-card',
              { 'database-card--selected': selectedBackupDbs.has(dbKey(db)) }
            ]"
            @click="toggleBackupDb(dbKey(db))"
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
              {{ selectedBackupDbs.has(dbKey(db)) ? '✓' : '' }}
            </div>
          </div>
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

    <!-- MySQL Restore Section -->
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

    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <!-- Portal (SQLite) Backup Section                                        -->
    <!-- ══════════════════════════════════════════════════════════════════════ -->
    <UiSectionHeader
      title="Portal Data Backup"
      subtitle="Download and restore the portal's internal SQLite databases (mappings, settings, config)"
    />

    <UiLoadingState v-if="loadingPortalDbs" message="Loading portal databases..." />

    <template v-else-if="portalDatabases.length > 0">
      <div class="backup-section">
        <h4 class="section-label">Portal Databases</h4>
        <div class="database-grid">
          <div
            v-for="db in portalDatabases"
            :key="db.key"
            class="database-card"
          >
            <div class="database-card__icon">🗄️</div>
            <div class="database-card__info">
              <span class="database-card__name">{{ db.name }}</span>
              <span class="database-card__meta">
                {{ db.exists ? formatBytes(db.sizeBytes) : 'Not created yet' }}
              </span>
            </div>
            <div class="database-card__action">
              <UiButton
                size="sm"
                :loading="portalBackupLoading[db.key]"
                :disabled="!db.exists"
                @click="downloadPortalBackup(db)"
              >
                💾 Download
              </UiButton>
            </div>
          </div>
        </div>

        <UiMessage v-if="portalBackupError" variant="error" dismissible @dismiss="portalBackupError = ''">
          {{ portalBackupError }}
        </UiMessage>
        <UiMessage v-if="portalBackupSuccess" variant="success" dismissible @dismiss="portalBackupSuccess = ''">
          {{ portalBackupSuccess }}
        </UiMessage>
      </div>

      <!-- Portal Restore -->
      <UiSectionHeader
        title="Restore Portal Database"
        subtitle="Upload a .db file to replace a portal database. This is destructive!"
      />

      <div class="restore-section">
        <div class="restore-form">
          <div class="form-row">
            <div class="form-field">
              <label class="form-label" for="portal-restore-db">Target Database</label>
              <UiSelect
                id="portal-restore-db"
                v-model="portalRestoreDb"
                :options="portalRestoreOptions"
                placeholder="Select database"
              />
            </div>
          </div>

          <div class="form-field">
            <label class="form-label" for="portal-restore-file">SQLite File (.db)</label>
            <input
              id="portal-restore-file"
              type="file"
              accept=".db"
              class="file-input"
              @change="handlePortalFileSelect"
            />
            <span v-if="portalRestoreFile" class="file-info">
              {{ portalRestoreFile.name }} ({{ formatBytes(portalRestoreFile.size) }})
            </span>
          </div>

          <div class="danger-confirm">
            <label class="confirm-label">
              <input
                v-model="portalRestoreConfirm"
                type="checkbox"
                class="confirm-checkbox"
              />
              <span class="confirm-text">
                ⚠️ I understand this will <strong>overwrite</strong> the existing portal database. This cannot be undone.
              </span>
            </label>
          </div>

          <div class="restore-actions">
            <UiButton
              variant="danger"
              :loading="portalRestoring"
              :disabled="!canPortalRestore"
              @click="handlePortalRestore"
            >
              ⚠️ Restore Portal Database
            </UiButton>
          </div>

          <UiMessage v-if="portalRestoreError" variant="error" dismissible @dismiss="portalRestoreError = ''">
            {{ portalRestoreError }}
          </UiMessage>
          <UiMessage v-if="portalRestoreSuccess" variant="success" dismissible @dismiss="portalRestoreSuccess = ''">
            {{ portalRestoreSuccess }}
          </UiMessage>
        </div>
      </div>
    </template>
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

  &__action {
    flex-shrink: 0;
  }
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
