<script setup lang="ts">
/**
 * AdminBackupTab - Database backup and restore interface
 * - MySQL: one gzipped dump per database (Download button per card)
 * - Portal SQLite databases: snapshot download
 * - Restore (MySQL + portal) only when the server has BACKUP_RESTORE_ENABLED=true;
 *   uploads are multipart with progress and need the typed database name as confirmation
 */
import UiButton from '~/components/ui/UiButton.vue'
import UiMessage from '~/components/ui/UiMessage.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiProgressBar from '~/components/ui/UiProgressBar.vue'

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
const restoreEnabled = ref(false)
/** Loading flag per database card key ('auth' or 'characters-<realmId>') */
const backupLoading = ref<Record<string, boolean>>({})
const backupError = ref('')
const backupSuccess = ref('')

// MySQL Restore state
const restoreDatabase = ref<'auth' | 'characters'>('auth')
const restoreRealmId = ref('')
const restoreFile = ref<File | null>(null)
const restoring = ref(false)
const restoreProgress = ref(0)
const restoreError = ref('')
const restoreSuccess = ref('')
const restoreConfirmText = ref('')

// ─── Portal (SQLite) Backup State ───────────────────────────────────────────────

const portalDatabases = ref<PortalDbInfo[]>([])
const loadingPortalDbs = ref(false)
const portalRestoreEnabled = ref(false)
const portalBackupLoading = ref<Record<string, boolean>>({})
const portalBackupError = ref('')
const portalBackupSuccess = ref('')

const portalRestoreDb = ref('')
const portalRestoreFile = ref<File | null>(null)
const portalRestoring = ref(false)
const portalRestoreProgress = ref(0)
const portalRestoreError = ref('')
const portalRestoreSuccess = ref('')
const portalRestoreConfirmText = ref('')

// ─── Lifecycle ──────────────────────────────────────────────────────────────────

onMounted(async () => {
  await Promise.all([loadDatabases(), loadPortalDatabases()])
})

// ─── HTTP helpers ───────────────────────────────────────────────────────────────

/** Error text from an h3 error body ({ statusMessage, message }) or the HTTP status. */
function errorMessageFromBody(text: string, status: number, statusText: string): string {
  try {
    const data = JSON.parse(text) as { statusMessage?: string; message?: string }
    if (data.statusMessage || data.message) return (data.statusMessage || data.message)!
  } catch {
    // not JSON
  }
  return text.trim().slice(0, 300) || `${status} ${statusText}`.trim()
}

function filenameFromContentDisposition(header: string | null): string | null {
  if (!header) return null
  const encoded = /filename\*=UTF-8''([^;]+)/i.exec(header)
  if (encoded?.[1]) return decodeURIComponent(encoded[1])
  const plain = /filename="?([^";]+)"?/i.exec(header)
  return plain?.[1] ?? null
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** POSTs JSON, saves the response as a file named by the server's Content-Disposition. */
async function downloadFromPost(url: string, body: Record<string, unknown>, fallbackFilename: string) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    credentials: 'same-origin',
  })
  if (!response.ok) {
    throw new Error(errorMessageFromBody(await response.text(), response.status, response.statusText))
  }
  const filename = filenameFromContentDisposition(response.headers.get('content-disposition')) || fallbackFilename
  const blob = await response.blob()
  saveBlob(blob, filename)
  return { filename, size: blob.size }
}

/** multipart POST via XHR so upload progress (0..100) can be shown. */
function uploadWithProgress<T>(url: string, form: FormData, onProgress: (percent: number) => void): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    xhr.withCredentials = true
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T)
        } catch {
          reject(new Error('Unexpected response from server'))
        }
      } else {
        reject(new Error(errorMessageFromBody(xhr.responseText, xhr.status, xhr.statusText)))
      }
    }
    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.send(form)
  })
}

function errorText(error: unknown, fallback: string): string {
  const e = error as { data?: { statusMessage?: string }; message?: string }
  return e?.data?.statusMessage || e?.message || fallback
}

// ─── MySQL Backup Logic ─────────────────────────────────────────────────────────

async function loadDatabases() {
  loadingDatabases.value = true
  try {
    const data = await $fetch<{ databases: DatabaseInfo[]; restoreEnabled?: boolean }>('/api/admin/backup/list')
    databases.value = data.databases || []
    restoreEnabled.value = data.restoreEnabled === true
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

async function downloadBackup(db: DatabaseInfo) {
  const key = dbKey(db)
  backupLoading.value = { ...backupLoading.value, [key]: true }
  backupError.value = ''
  backupSuccess.value = ''

  try {
    const { filename, size } = await downloadFromPost(
      '/api/admin/backup/create',
      { database: db.type, realmId: db.type === 'characters' ? db.realmId : undefined },
      `${db.name}${db.realmId ? `-realm${db.realmId}` : ''}.sql.gz`
    )
    backupSuccess.value = `Backup downloaded: ${filename} (${formatBytes(size)})`
  } catch (error) {
    backupError.value = `${db.name}${db.realmName ? ` (${db.realmName})` : ''}: ${errorText(error, 'Failed to create backup')}`
  } finally {
    backupLoading.value = { ...backupLoading.value, [key]: false }
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    const name = file.name.toLowerCase()
    if (!name.endsWith('.sql') && !name.endsWith('.sql.gz')) {
      restoreError.value = 'Only .sql and .sql.gz files are accepted'
      restoreFile.value = null
      return
    }
    restoreFile.value = file
    restoreError.value = ''
  }
}

const realmOptions = computed(() =>
  databases.value
    .filter((db: DatabaseInfo) => db.type === 'characters' && db.realmId)
    .map((db: DatabaseInfo) => ({
      value: db.realmId!,
      label: `${db.realmName} (${db.realmId})`,
    }))
)

/** Exact confirmation string the server expects for the MySQL restore */
const restoreTargetName = computed(() => {
  if (restoreDatabase.value === 'auth') return 'acore_auth'
  // The realm is part of the confirmation server-side
  return `acore_characters@realm${restoreRealmId.value}`
})

const canRestore = computed(() => {
  if (!restoreEnabled.value || !restoreFile.value) return false
  if (restoreDatabase.value === 'characters' && !restoreRealmId.value) return false
  return restoreConfirmText.value.trim() === restoreTargetName.value
})

async function handleRestore() {
  if (!canRestore.value || !restoreFile.value) return

  restoring.value = true
  restoreProgress.value = 0
  restoreError.value = ''
  restoreSuccess.value = ''

  try {
    const form = new FormData()
    form.append('database', restoreDatabase.value)
    if (restoreDatabase.value === 'characters') form.append('realmId', restoreRealmId.value)
    form.append('confirm', restoreConfirmText.value.trim())
    form.append('file', restoreFile.value, restoreFile.value.name)

    const response = await uploadWithProgress<{ message: string }>(
      '/api/admin/backup/restore',
      form,
      (percent) => { restoreProgress.value = percent }
    )

    restoreSuccess.value = response.message
    restoreFile.value = null
    restoreConfirmText.value = ''

    const fileInput = document.getElementById('restore-file') as HTMLInputElement
    if (fileInput) fileInput.value = ''

    await loadDatabases()
  } catch (error) {
    restoreError.value = errorText(error, 'Failed to restore backup')
  } finally {
    restoring.value = false
  }
}

// ─── Portal (SQLite) Backup Logic ───────────────────────────────────────────────

async function loadPortalDatabases() {
  loadingPortalDbs.value = true
  try {
    const data = await $fetch<{ databases: PortalDbInfo[]; restoreEnabled?: boolean }>('/api/admin/backup/portal-list')
    portalDatabases.value = data.databases || []
    portalRestoreEnabled.value = data.restoreEnabled === true
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
    const { filename } = await downloadFromPost(
      '/api/admin/backup/portal-create',
      { database: db.key },
      `portal-${db.key}.db`
    )
    portalBackupSuccess.value = `Downloaded: ${filename}`
  } catch (error) {
    portalBackupError.value = errorText(error, 'Failed to download backup')
  } finally {
    portalBackupLoading.value = { ...portalBackupLoading.value, [db.key]: false }
  }
}

function handlePortalFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (file) {
    if (!file.name.toLowerCase().endsWith('.db')) {
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
  if (!portalRestoreEnabled.value || !portalRestoreFile.value) return false
  if (!portalRestoreDb.value) return false
  return portalRestoreConfirmText.value.trim() === portalRestoreDb.value
})

async function handlePortalRestore() {
  if (!canPortalRestore.value || !portalRestoreFile.value) return

  portalRestoring.value = true
  portalRestoreProgress.value = 0
  portalRestoreError.value = ''
  portalRestoreSuccess.value = ''

  try {
    const form = new FormData()
    form.append('database', portalRestoreDb.value)
    form.append('confirm', portalRestoreConfirmText.value.trim())
    form.append('file', portalRestoreFile.value, portalRestoreFile.value.name)

    const response = await uploadWithProgress<{ message: string }>(
      `/api/admin/backup/portal-restore?database=${encodeURIComponent(portalRestoreDb.value)}`,
      form,
      (percent) => { portalRestoreProgress.value = percent }
    )

    portalRestoreSuccess.value = response.message
    portalRestoreFile.value = null
    portalRestoreConfirmText.value = ''

    const fileInput = document.getElementById('portal-restore-file') as HTMLInputElement
    if (fileInput) fileInput.value = ''

    await loadPortalDatabases()
  } catch (error) {
    portalRestoreError.value = errorText(error, 'Failed to restore backup')
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
    <UiSectionHeader title="Create Backup" subtitle="Download a gzipped MySQL dump (.sql.gz) — one file per database" />

    <UiLoadingState v-if="loadingDatabases" message="Loading database info..." />

    <template v-else>
      <div class="backup-section">
        <h4 class="section-label">Databases</h4>
        <div class="database-grid">
          <div
            v-for="db in databases"
            :key="dbKey(db)"
            class="database-card"
            :data-testid="`backup-card-${dbKey(db)}`"
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
            <div class="database-card__action">
              <UiButton
                size="sm"
                :loading="backupLoading[dbKey(db)]"
                @click="downloadBackup(db)"
              >
                💾 Download
              </UiButton>
            </div>
          </div>
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
      subtitle="Upload a .sql or .sql.gz file to restore a database. This is a destructive operation!"
    />

    <div class="restore-section">
      <UiMessage v-if="!restoreEnabled" variant="info" data-testid="restore-disabled">
        Restore is disabled on this server. Set <code>BACKUP_RESTORE_ENABLED=true</code> on the portal
        deployment to enable it (only on non-production or during a planned restore).
      </UiMessage>

      <div v-else class="restore-form">
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
          <label class="form-label" for="restore-file">SQL File (.sql / .sql.gz)</label>
          <input
            id="restore-file"
            type="file"
            accept=".sql,.gz"
            class="file-input"
            @change="handleFileSelect"
          />
          <span v-if="restoreFile" class="file-info">
            {{ restoreFile.name }} ({{ formatBytes(restoreFile.size) }})
          </span>
        </div>

        <div class="danger-confirm">
          <label class="form-label" for="restore-confirm">
            ⚠️ This will <strong>overwrite</strong> <code>{{ restoreTargetName }}</code>. Type <code>{{ restoreTargetName }}</code> to confirm:
          </label>
          <input
            id="restore-confirm"
            v-model="restoreConfirmText"
            type="text"
            class="confirm-input"
            autocomplete="off"
            :placeholder="restoreTargetName"
          />
        </div>

        <UiProgressBar v-if="restoring" :value="restoreProgress" size="sm" />

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
      </div>

      <UiMessage v-if="restoreError" variant="error" dismissible @dismiss="restoreError = ''">
        {{ restoreError }}
      </UiMessage>
      <UiMessage v-if="restoreSuccess" variant="success" dismissible @dismiss="restoreSuccess = ''">
        {{ restoreSuccess }}
      </UiMessage>
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
        <UiMessage v-if="!portalRestoreEnabled" variant="info" data-testid="portal-restore-disabled">
          Restore is disabled on this server. Set <code>BACKUP_RESTORE_ENABLED=true</code> on the portal
          deployment to enable it (only on non-production or during a planned restore).
        </UiMessage>

        <div v-else class="restore-form">
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
            <label class="form-label" for="portal-restore-confirm">
              ⚠️ This will <strong>overwrite</strong> the <code>{{ portalRestoreDb }}</code> portal database
              (the current file is kept as <code>*.pre-restore-*.db</code>). Type <code>{{ portalRestoreDb }}</code> to confirm:
            </label>
            <input
              id="portal-restore-confirm"
              v-model="portalRestoreConfirmText"
              type="text"
              class="confirm-input"
              autocomplete="off"
              :placeholder="portalRestoreDb"
            />
          </div>

          <UiProgressBar v-if="portalRestoring" :value="portalRestoreProgress" size="sm" />

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
        </div>

        <UiMessage v-if="portalRestoreError" variant="error" dismissible @dismiss="portalRestoreError = ''">
          {{ portalRestoreError }}
        </UiMessage>
        <UiMessage v-if="portalRestoreSuccess" variant="success" dismissible @dismiss="portalRestoreSuccess = ''">
          {{ portalRestoreSuccess }}
        </UiMessage>
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
  transition: all $transition-base;

  &:hover {
    border-color: $blue-light;
    background: rgba($blue-light, 0.05);
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

  &__action {
    flex-shrink: 0;
  }
}

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
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  padding: $spacing-4;
  background: rgba($error, 0.08);
  border: 1px solid rgba($error, 0.3);
  border-radius: $radius-lg;

  strong {
    color: $error-light;
  }
}

.confirm-input {
  padding: $spacing-2 $spacing-3;
  background: $bg-primary;
  border: 1px solid rgba($error, 0.4);
  border-radius: $radius-md;
  color: $text-primary;
  font-family: monospace;
  font-size: $font-size-sm;
}
</style>
