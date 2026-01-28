<template>
  <div class="admin-panel">
    <header class="page-header">
      <div class="header-content">
        <h1>🛡️ GM Admin Panel</h1>
        <p v-if="gmLevel > 0" class="gm-badge">GM Level {{ gmLevel }}</p>
      </div>
    </header>

    <section v-if="!isGM" class="access-denied">
      <h2>Access Denied</h2>
      <p>You need GM privileges to access this page.</p>
      <NuxtLink to="/" class="btn-primary">Return Home</NuxtLink>
    </section>

    <div v-else class="admin-content">
      <!-- Tabs -->
      <nav class="tabs">
        <button
          :class="{ active: activeTab === 'accounts' }"
          @click="activeTab = 'accounts'"
        >
          👥 All Accounts
        </button>
        <button
          :class="{ active: activeTab === 'mappings' }"
          @click="activeTab = 'mappings'"
        >
          🔗 Account Mappings
        </button>
        <button
          :class="{ active: activeTab === 'gms' }"
          @click="activeTab = 'gms'"
        >
          🛡️ GM Management
        </button>
        <button
          :class="{ active: activeTab === 'files' }"
          @click="activeTab = 'files'"
        >
          📁 File Management
        </button>
      </nav>

      <!-- Accounts Tab -->
      <main v-if="activeTab === 'accounts'" class="tab-content">
        <section class="content-section">
          <div class="section-header">
            <h2>All WoW Accounts</h2>
            <div class="controls">
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search accounts..."
              class="search-input"
            />
          </div>
        </div>

        <div v-if="loadingAccounts" class="loading">
          <p>Loading accounts...</p>
        </div>

        <div v-else class="accounts-table-container">
          <table class="accounts-table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Username</th>
                <th>Email</th>
                <th>Status</th>
                <th>GM Level</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="account in filteredAccounts" :key="account.id">
                <td>{{ account.id }}</td>
                <td>
                  <span class="username">{{ account.username }}</span>
                  <span v-if="account.isGM" class="gm-badge-small">GM</span>
                </td>
                <td>{{ account.email || '-' }}</td>
                <td>
                  <span :class="['status-badge', account.online ? 'online' : 'offline']">
                    {{ account.online ? 'Online' : 'Offline' }}
                  </span>
                </td>
                <td>{{ account.gmLevel || '-' }}</td>
                <td>{{ formatDate(account.last_login) }}</td>
                <td>
                  <button @click="viewAccount(account)" class="btn-small">View</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </section>
      </main>

      <!-- Mappings Tab -->
      <main v-if="activeTab === 'mappings'" class="tab-content">
        <section class="content-section">
          <div class="section-header">
            <h2>Account Mappings</h2>
            <p class="subtitle">Keycloak User → WoW Account Mappings</p>
          </div>

        <div v-if="loadingMappings" class="loading">
          <p>Loading mappings...</p>
        </div>

        <div v-else class="mappings-table-container">
          <table class="accounts-table">
            <thead>
              <tr>
                <th>Keycloak User</th>
                <th>WoW Account</th>
                <th>WoW Account ID</th>
                <th>Created</th>
                <th>Last Used</th>
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
        </div>
        </section>
      </main>

      <!-- GM Management Tab -->
      <main v-if="activeTab === 'gms'" class="tab-content">
        <section class="content-section">
          <h2>GM Management</h2>

          <!-- Set GM Level Section -->
          <div class="gm-section">
            <h3>Set GM Access Level</h3>
            <form @submit.prevent="setGMLevel" class="gm-form">
              <div class="form-row">
                <div class="form-group">
                  <label for="gmAccountId">Account ID</label>
                  <input
                    id="gmAccountId"
                    v-model.number="gmForm.accountId"
                    type="number"
                    placeholder="Enter account ID"
                    class="form-input"
                    required
                  />
                </div>
                <div class="form-group">
                  <label for="gmLevel">GM Level (0-10)</label>
                  <input
                    id="gmLevel"
                    v-model.number="gmForm.gmLevel"
                    type="number"
                    min="0"
                    max="10"
                    placeholder="0"
                    class="form-input"
                    required
                  />
                  <small class="form-hint">0 = Remove GM access, 1-3 = Standard levels</small>
                </div>
                <div class="form-group">
                  <label for="gmRealmId">Realm</label>
                  <select
                    id="gmRealmId"
                    v-model.number="gmForm.realmId"
                    class="form-input"
                  >
                    <option :value="-1">All Realms</option>
                    <option v-for="realm in realmsList" :key="realm.realmId" :value="realm.realmId">
                      {{ realm.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="form-group">
                <label for="gmComment">Comment (Optional)</label>
                <input
                  id="gmComment"
                  v-model="gmForm.comment"
                  type="text"
                  placeholder="Reason for GM access"
                  class="form-input"
                />
              </div>
              <button
                type="submit"
                :disabled="settingGMLevel"
                class="btn-primary"
              >
                {{ settingGMLevel ? '⏳ Setting...' : '🛡️ Set GM Level' }}
              </button>
              <p v-if="gmError" class="error-message">{{ gmError }}</p>
              <p v-if="gmSuccess" class="success-message">{{ gmSuccess }}</p>
            </form>
          </div>

          <!-- Send Item via Mail Section -->
          <div class="gm-section">
            <h3>Send Item via Mail</h3>
            <form @submit.prevent="sendItemMail" class="gm-form">
              <div class="form-row">
                <div class="form-group">
                  <label for="mailCharacterName">Character Name</label>
                  <input
                    id="mailCharacterName"
                    v-model="mailForm.characterName"
                    type="text"
                    placeholder="Enter character name"
                    class="form-input"
                    required
                  />
                </div>
                <div class="form-group">
                  <label for="mailRealmId">Realm</label>
                  <select
                    id="mailRealmId"
                    v-model="mailForm.realmId"
                    class="form-input"
                    required
                  >
                    <option value="">Select realm</option>
                    <option v-for="realm in realmsList" :key="realm.id" :value="realm.id">
                      {{ realm.name }}
                    </option>
                  </select>
                </div>
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label for="mailItemId">Item ID</label>
                  <input
                    id="mailItemId"
                    v-model.number="mailForm.itemId"
                    type="number"
                    placeholder="e.g., 25 for Worn Shortsword"
                    class="form-input"
                    required
                  />
                  <small class="form-hint">Enter the item entry ID from item_template</small>
                </div>
                <div class="form-group">
                  <label for="mailItemCount">Item Count</label>
                  <input
                    id="mailItemCount"
                    v-model.number="mailForm.itemCount"
                    type="number"
                    min="1"
                    max="1000"
                    placeholder="1"
                    class="form-input"
                    required
                  />
                </div>
              </div>
              <div class="form-group">
                <label for="mailSubject">Mail Subject</label>
                <input
                  id="mailSubject"
                  v-model="mailForm.subject"
                  type="text"
                  placeholder="GM Mail"
                  maxlength="128"
                  class="form-input"
                />
              </div>
              <div class="form-group">
                <label for="mailBody">Mail Body</label>
                <textarea
                  id="mailBody"
                  v-model="mailForm.body"
                  placeholder="Message to player..."
                  maxlength="8000"
                  rows="4"
                  class="form-input"
                ></textarea>
              </div>
              <button
                type="submit"
                :disabled="sendingMail"
                class="btn-primary"
              >
                {{ sendingMail ? '⏳ Sending...' : '📧 Send Item' }}
              </button>
              <p v-if="mailError" class="error-message">{{ mailError }}</p>
              <p v-if="mailSuccess" class="success-message">{{ mailSuccess }}</p>
            </form>
          </div>
        </section>
      </main>

      <!-- File Management Tab -->
      <main v-if="activeTab === 'files'" class="tab-content">
        <section class="content-section">
          <div class="section-header">
            <h2>File Management</h2>
            <p class="subtitle">Manage public download files</p>
          </div>

          <div class="file-upload-section">
            <h3>Upload New File</h3>
            <form @submit.prevent="uploadFile" class="upload-form">
              <input
                ref="fileInput"
                type="file"
                @change="handleFileSelect"
                class="file-input"
              />
              <div v-if="selectedFile" class="selected-file">
                <span>📎 {{ selectedFile.name }}</span>
                <span class="file-size">{{ formatFileSize(selectedFile.size) }}</span>
              </div>
              <button
                type="submit"
                :disabled="!selectedFile || uploading"
                class="btn-upload"
              >
                {{ uploading ? '⏳ Uploading...' : '📤 Upload File' }}
              </button>
              <div v-if="uploading" class="progress-bar">
                <div class="progress-fill" :style="{ width: `${uploadProgress}%` }"></div>
                <span class="progress-text">{{ uploadProgress }}%</span>
              </div>
              <p v-if="uploadError" class="error-message">{{ uploadError }}</p>
              <p v-if="uploadSuccess" class="success-message">{{ uploadSuccess }}</p>
            </form>
          </div>

          <div class="files-list-section">
            <h3>Current Files</h3>
            <div v-if="loadingFiles" class="loading">
              <p>Loading files...</p>
            </div>

            <div v-else-if="publicFiles.length === 0" class="empty-state">
              <p>No files available</p>
            </div>

            <div v-else class="files-table-container">
              <table class="accounts-table">
                <thead>
                  <tr>
                    <th>Filename</th>
                    <th>Size</th>
                    <th>Last Modified</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="file in publicFiles" :key="file.name">
                    <td>
                      <span class="filename">{{ file.name }}</span>
                    </td>
                    <td>{{ formatFileSize(file.size) }}</td>
                    <td>{{ formatDate(file.modified) }}</td>
                    <td>
                      <div class="file-actions">
                        <a
                          :href="`/api/downloads/${encodeURIComponent(file.name)}`"
                          class="btn-small"
                          :download="file.name"
                        >
                          ⬇️ Download
                        </a>
                        <button
                          @click="deleteFile(file.name)"
                          class="btn-small btn-danger"
                          :disabled="deleting === file.name"
                        >
                          {{ deleting === file.name ? '⏳' : '🗑️' }} Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()

const isGM = computed(() => authStore.user?.isGM || false)
const gmLevel = computed(() => authStore.user?.gmLevel || 0)
const activeTab = ref('accounts')
const searchQuery = ref('')

const loadingAccounts = ref(false)
const loadingMappings = ref(false)

const accounts = ref<any[]>([])
const mappings = ref<any[]>([])
const publicFiles = ref<any[]>([])

const loadingFiles = ref(false)
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadError = ref('')
const uploadSuccess = ref('')
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const deleting = ref('')

// GM Management
const settingGMLevel = ref(false)
const gmError = ref('')
const gmSuccess = ref('')
const gmForm = ref({
  accountId: null as number | null,
  gmLevel: 0,
  realmId: -1,
  comment: '',
})

// Mail System
const sendingMail = ref(false)
const mailError = ref('')
const mailSuccess = ref('')
const mailForm = ref({
  characterName: '',
  itemId: null as number | null,
  itemCount: 1,
  subject: 'GM Mail',
  body: '',
  realmId: '',
})

// Realms list
const realmsList = ref<any[]>([])

// Load data when authenticated as GM
watchEffect(async () => {
  if (authStore.isAuthenticated && isGM.value) {
    await Promise.all([
      fetchAccounts(),
      fetchMappings(),
      fetchFiles(),
      loadRealms()
    ])
  } else if (authStore.isAuthenticated && !isGM.value) {
    // Not a GM, redirect
    navigateTo('/')
  }
})

async function loadRealms() {
  try {
    const { data } = await useFetch('/api/realms')
    if (data.value) {
      realmsList.value = Object.values(data.value)
    }
  } catch (error) {
    console.error('Failed to load realms:', error)
  }
}

async function fetchAccounts() {
  loadingAccounts.value = true
  try {
    const { data } = await useFetch('/api/admin/accounts')
    accounts.value = data.value || []
  } catch (error) {
    console.error('Failed to fetch accounts:', error)
  } finally {
    loadingAccounts.value = false
  }
}

async function fetchMappings() {
  loadingMappings.value = true
  try {
    const { data } = await useFetch('/api/admin/account-mappings')
    mappings.value = data.value || []
  } catch (error) {
    console.error('Failed to fetch mappings:', error)
  } finally {
    loadingMappings.value = false
  }
}

const filteredAccounts = computed(() => {
  if (!searchQuery.value) return accounts.value

  const query = searchQuery.value.toLowerCase()
  return accounts.value.filter(account =>
    account.username.toLowerCase().includes(query) ||
    account.email?.toLowerCase().includes(query) ||
    account.id.toString().includes(query)
  )
})

function viewAccount(account: any) {
  // Navigate to account detail page
  navigateTo(`/account/${account.id}`)
}
async function fetchFiles() {
  loadingFiles.value = true
  try {
    const { data } = await useFetch('/api/downloads/list')
    publicFiles.value = data.value || []
  } catch (error) {
    console.error('Failed to fetch files:', error)
  } finally {
    loadingFiles.value = false
  }
}

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0] || null
    uploadError.value = ''
    uploadSuccess.value = ''
  }
}

async function uploadFile() {
  if (!selectedFile.value) return

  uploading.value = true
  uploadProgress.value = 0
  uploadError.value = ''
  uploadSuccess.value = ''

  try {
    const formData = new FormData()
    formData.append('file', selectedFile.value)

    // Use XMLHttpRequest for progress tracking
    await new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          uploadProgress.value = Math.round((e.loaded / e.total) * 100)
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText))
        } else {
          reject(new Error(xhr.responseText || 'Upload failed'))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Upload failed')))
      xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')))

      xhr.open('POST', '/api/admin/files/upload')
      xhr.send(formData)
    })

    uploadSuccess.value = `Successfully uploaded ${selectedFile.value.name}`
    selectedFile.value = null
    if (fileInput.value) {
      fileInput.value.value = ''
    }

    // Refresh file list
    await fetchFiles()
  } catch (error: any) {
    console.error('Failed to upload file:', error)
    const errorData = error.message ? JSON.parse(error.message) : {}
    uploadError.value = errorData.data?.detail || errorData.statusMessage || error.message || 'Failed to upload file'
  } finally {
    uploading.value = false
    uploadProgress.value = 0
  }
}

async function deleteFile(filename: string) {
  if (!confirm(`Are you sure you want to delete ${filename}?`)) {
    return
  }

  deleting.value = filename

  try {
    await $fetch(`/api/admin/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    })

    // Refresh file list
    await fetchFiles()
  } catch (error: any) {
    console.error('Failed to delete file:', error)
    alert(error.data?.message || 'Failed to delete file')
  } finally {
    deleting.value = ''
  }
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}
function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString()
}

async function setGMLevel() {
  if (!gmForm.value.accountId) {
    gmError.value = 'Please enter an account ID'
    return
  }

  settingGMLevel.value = true
  gmError.value = ''
  gmSuccess.value = ''

  try {
    const response = await $fetch('/api/admin/gm/set-level', {
      method: 'POST',
      body: {
        accountId: gmForm.value.accountId,
        gmLevel: gmForm.value.gmLevel,
        realmId: gmForm.value.realmId,
        comment: gmForm.value.comment || null,
      },
    })

    gmSuccess.value = response.message

    // Reset form
    gmForm.value = {
      accountId: null,
      gmLevel: 0,
      realmId: -1,
      comment: '',
    }

    // Refresh accounts list
    await fetchAccounts()
  } catch (error: any) {
    console.error('Failed to set GM level:', error)
    gmError.value = error.data?.statusMessage || error.message || 'Failed to set GM level'
  } finally {
    settingGMLevel.value = false
  }
}

async function sendItemMail() {
  if (!mailForm.value.characterName || !mailForm.value.itemId || !mailForm.value.realmId) {
    mailError.value = 'Please fill in all required fields'
    return
  }

  sendingMail.value = true
  mailError.value = ''
  mailSuccess.value = ''

  try {
    const response = await $fetch('/api/admin/mail/send-item', {
      method: 'POST',
      body: {
        characterName: mailForm.value.characterName,
        itemId: mailForm.value.itemId,
        itemCount: mailForm.value.itemCount,
        subject: mailForm.value.subject,
        body: mailForm.value.body,
        realmId: mailForm.value.realmId,
      },
    })

    mailSuccess.value = response.message

    // Reset form
    mailForm.value = {
      characterName: '',
      itemId: null,
      itemCount: 1,
      subject: 'GM Mail',
      body: '',
      realmId: '',
    }
  } catch (error: any) {
    console.error('Failed to send item via mail:', error)
    mailError.value = error.data?.detail || error.data?.statusMessage || error.message || 'Failed to send item via mail'
  } finally {
    sendingMail.value = false
  }
}
</script>

<style scoped lang="scss">
/* Admin Panel - Page-specific styles only */
/* Shared styles are in ~/assets/css/shared.css */

.admin-panel {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header h1 {
  background: linear-gradient(to right, #f59e0b, #d97706);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}

.access-denied {
  text-align: center;
  padding: 4rem 2rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;
}

.access-denied h2 {
  color: #e2e8f0;
  margin-bottom: 1rem;
}

.access-denied p {
  color: #94a3b8;
  margin-bottom: 2rem;
}

.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.username {
  font-weight: 600;
  color: #60a5fa;
}

.filename {
  font-weight: 600;
  color: #e2e8f0;
}

.file-actions {
  display: flex;
  gap: 0.5rem;
}

/* File Upload Section */
.file-upload-section,
.files-list-section {
  margin-bottom: 2rem;
}

.file-upload-section h3,
.files-list-section h3 {
  color: #e2e8f0;
  font-size: 1.25rem;
  margin-bottom: 1rem;
}

.upload-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.5rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
}

.file-input::-webkit-file-upload-button {
  padding: 0.5rem 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid #3b82f6;
  border-radius: 0.375rem;
  color: #60a5fa;
  cursor: pointer;
  margin-right: 1rem;
}

.selected-file {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  color: #e2e8f0;
}

.selected-file .file-size {
  color: #94a3b8;
  font-size: 0.875rem;
}

/* GM Management Section */
.gm-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
}

.gm-section h3 {
  color: #e2e8f0;
  font-size: 1.25rem;
  margin-bottom: 1.5rem;
}

.gm-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  color: #cbd5e1;
  font-size: 0.875rem;
  font-weight: 500;
}

.form-input {
  padding: 0.625rem 0.875rem;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.375rem;
  color: #e2e8f0;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
}

.form-input::placeholder {
  color: #64748b;
}

.form-hint {
  color: #94a3b8;
  font-size: 0.75rem;
  margin-top: -0.25rem;
}

textarea.form-input {
  resize: vertical;
  min-height: 80px;
  font-family: inherit;
}

</style>
