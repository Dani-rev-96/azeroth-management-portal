<script setup lang="ts">
/**
 * Admin Panel Page
 * GM-only administration interface with URL-synced tabs
 */
import { useUrlTab } from '~/composables/useUrlTab'
import UiTabs from '~/components/ui/UiTabs.vue'
import UiTabPanel from '~/components/ui/UiTabPanel.vue'
import UiPageHeader from '~/components/ui/UiPageHeader.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import AdminAccountsTab, { type AccountRow } from '~/components/admin/AdminAccountsTab.vue'
import AdminMappingsTab, { type Mapping } from '~/components/admin/AdminMappingsTab.vue'
import AdminLinkAccountsTab from '~/components/admin/AdminLinkAccountsTab.vue'
import AdminGMForm, { type GMFormData, type RealmOption } from '~/components/admin/AdminGMForm.vue'
import AdminMailForm, { type MailFormData } from '~/components/admin/AdminMailForm.vue'
import AdminFilesTab, { type FileInfo } from '~/components/admin/AdminFilesTab.vue'
import AdminBackupTab from '~/components/admin/AdminBackupTab.vue'
import AdminDressingRoomTab from '~/components/admin/AdminDressingRoomTab.vue'
import AdminFeatureGrantsTab from '~/components/admin/AdminFeatureGrantsTab.vue'
import AdminPortalConfigTab from '~/components/admin/AdminPortalConfigTab.vue'
import { useAuthStore } from '~/stores/auth'
import { ref, computed, watchEffect, watch } from 'vue'

// Auth check
const authStore = useAuthStore()
const isGM = computed(() => authStore.user?.isGM || false)
const gmLevel = computed(() => authStore.user?.gmLevel || 0)

// Feature grants from the auth store (fetched during initializeAuth)
const hasAnyAccess = computed(() => authStore.hasAdminAccess)

// Feature-ID → tab-ID mapping
const FEATURE_TAB_MAP: Record<string, string[]> = {
  'admin.accounts': ['accounts'],
  'admin.mappings': ['mappings'],
  'admin.link-accounts': ['link-accounts'],
  'admin.gm': ['gms'],
  'admin.mail': ['gms'],
  'admin.files': ['files'],
  'admin.backup': ['backup'],
  'admin.dressingroom': ['dressingroom'],
  'admin.export': ['mappings'],
  'admin.portal-config': ['portal-config'],
}

// Tab configuration
const allTabs = [
  { id: 'accounts', label: 'All Accounts', icon: '👥' },
  { id: 'mappings', label: 'Account Mappings', icon: '🔗' },
  { id: 'link-accounts', label: 'Link Accounts', icon: '🔧' },
  { id: 'gms', label: 'GM Management', icon: '🛡️' },
  { id: 'files', label: 'File Management', icon: '📁' },
  { id: 'backup', label: 'Backup & Restore', icon: '💾' },
  { id: 'dressingroom', label: 'Dressing Room', icon: '👗' },
  { id: 'feature-grants', label: 'Feature Grants', icon: '🔓' },
  { id: 'portal-config', label: 'Portal Config', icon: '⚙️' },
]

const tabs = computed(() => {
  if (isGM.value) return allTabs
  // Non-GM users only see tabs matching their active feature grants
  const allowedTabIds = new Set<string>()
  for (const featureId of authStore.featureGrants) {
    const tabIds = FEATURE_TAB_MAP[featureId]
    if (tabIds) tabIds.forEach(id => allowedTabIds.add(id))
  }
  return allTabs.filter(t => allowedTabIds.has(t.id))
})

/** Check if the current user can access a specific tab */
function canAccessTab(tabId: string): boolean {
  if (isGM.value) return true
  return tabs.value.some(t => t.id === tabId)
}

// URL-synced tab state
const { activeTab } = useUrlTab('accounts')

// Enforce tab access: redirect to first allowed tab if current tab is not permitted
watch([activeTab, tabs], ([currentTab, availableTabs]) => {
  if (isGM.value) return
  if (availableTabs.length === 0) return
  const isAllowed = availableTabs.some(t => t.id === currentTab)
  if (!isAllowed) {
    activeTab.value = availableTabs[0].id
  }
}, { immediate: true })

// Data state
const accounts = ref<AccountRow[]>([])
const mappings = ref<Mapping[]>([])
const publicFiles = ref<FileInfo[]>([])
const realmsList = ref<RealmOption[]>([])

// Loading states
const loadingAccounts = ref(false)
const loadingMappings = ref(false)
const loadingFiles = ref(false)

// Search
const searchQuery = ref('')

// GM Management state
const settingGMLevel = ref(false)
const gmError = ref('')
const gmSuccess = ref('')

// Mail state
const sendingMail = ref(false)
const mailError = ref('')
const mailSuccess = ref('')

// File upload state
const uploading = ref(false)
const uploadProgress = ref(0)
const uploadError = ref('')
const uploadSuccess = ref('')
const deletingFile = ref('')

// Load data when authenticated
watchEffect(async () => {
  if (!authStore.isAuthenticated) return

  // Ensure feature grants are loaded (may already be from auth init)
  if (!isGM.value && authStore.featureGrants.size === 0) {
    await authStore.fetchFeatureGrants()

    // If still no access, redirect
    if (!authStore.hasAdminAccess) {
      navigateTo('/')
      return
    }
  }

  // Load data (GM gets everything, feature-grant users get what they access)
  await Promise.all([
    fetchAccounts(),
    fetchMappings(),
    fetchFiles(),
    loadRealms()
  ])
})

async function loadRealms() {
  try {
    const data = await $fetch<Record<string, { id: number; name: string }>>('/api/realms')
    if (data) {
      realmsList.value = Object.entries(data).map(([_id, realm]) => ({
        id: realm.id,
        name: realm.name,
      }))
    }
  } catch (error) {
    console.error('Failed to load realms:', error)
  }
}

async function fetchAccounts() {
  loadingAccounts.value = true
  try {
    const data = await $fetch<AccountRow[]>('/api/admin/accounts')
    accounts.value = data || []
  } catch (error) {
    console.error('Failed to fetch accounts:', error)
  } finally {
    loadingAccounts.value = false
  }
}

async function fetchMappings() {
  loadingMappings.value = true
  try {
    const data = await $fetch<Mapping[]>('/api/admin/account-mappings')
    mappings.value = data || []
  } catch (error) {
    console.error('Failed to fetch mappings:', error)
  } finally {
    loadingMappings.value = false
  }
}

async function fetchFiles() {
  loadingFiles.value = true
  try {
    const data = await $fetch<FileInfo[]>('/api/downloads/list')
    publicFiles.value = data || []
  } catch (error) {
    console.error('Failed to fetch files:', error)
  } finally {
    loadingFiles.value = false
  }
}

function viewAccount(account: AccountRow) {
  navigateTo(`/account/${account.id}`)
}

async function handleSetGMLevel(data: GMFormData) {
  settingGMLevel.value = true
  gmError.value = ''
  gmSuccess.value = ''

  try {
    const response = await $fetch<{ message: string }>('/api/admin/gm/set-level', {
      method: 'POST',
      body: {
        accountId: data.accountId,
        gmLevel: data.gmLevel,
        realmId: data.realmId,
        comment: data.comment || null,
      },
    })

    gmSuccess.value = response.message
    await fetchAccounts()
  } catch (error: any) {
    gmError.value = error.data?.statusMessage || error.message || 'Failed to set GM level'
  } finally {
    settingGMLevel.value = false
  }
}

async function handleSendMail(data: MailFormData) {
  sendingMail.value = true
  mailError.value = ''
  mailSuccess.value = ''

  try {
    const response = await $fetch<{ message: string }>('/api/admin/mail/send-item', {
      method: 'POST',
      body: data,
    })

    mailSuccess.value = response.message
  } catch (error: any) {
    mailError.value = error.data?.detail || error.data?.statusMessage || error.message || 'Failed to send mail'
  } finally {
    sendingMail.value = false
  }
}

async function handleFileUpload(file: File) {
  uploading.value = true
  uploadProgress.value = 0
  uploadError.value = ''
  uploadSuccess.value = ''

  try {
    const formData = new FormData()
    formData.append('file', file)

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

    uploadSuccess.value = `Successfully uploaded ${file.name}`
    await fetchFiles()
  } catch (error: any) {
    try {
      const errorData = JSON.parse(error.message)
      uploadError.value = errorData.data?.detail || errorData.statusMessage || 'Upload failed'
    } catch {
      uploadError.value = error.message || 'Failed to upload file'
    }
  } finally {
    uploading.value = false
    uploadProgress.value = 0
  }
}

async function handleFileDelete(filename: string) {
  deletingFile.value = filename

  try {
    await $fetch(`/api/admin/files/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    })
    await fetchFiles()
  } catch (error: any) {
    alert(error.data?.message || 'Failed to delete file')
  } finally {
    deletingFile.value = ''
  }
}
</script>

<template>
  <div class="admin-panel">
    <UiPageHeader title="🛡️ GM Admin Panel" :gradient="false">
      <template #actions>
        <UiBadge v-if="gmLevel > 0" variant="gm" outline>
          GM Level {{ gmLevel }}
        </UiBadge>
      </template>
    </UiPageHeader>

    <!-- Access Denied -->
    <section v-if="!hasAnyAccess" class="access-denied">
      <UiEmptyState
        icon="🚫"
        title="Access Denied"
        message="You need GM privileges or an active feature grant to access this page."
      >
        <template #action>
          <UiButton @click="navigateTo('/')">Return Home</UiButton>
        </template>
      </UiEmptyState>
    </section>

    <!-- Admin Content -->
    <div v-else class="admin-content">
      <UiTabs
        v-model="activeTab"
        :tabs="tabs"
        variant="admin"
      />

      <!-- Accounts Tab -->
      <UiTabPanel v-if="canAccessTab('accounts')" id="accounts" :active="activeTab === 'accounts'">
        <AdminAccountsTab
          :accounts="accounts"
          :loading="loadingAccounts"
          :search-query="searchQuery"
          @update:search-query="searchQuery = $event"
          @view-account="viewAccount"
        />
      </UiTabPanel>

      <!-- Mappings Tab -->
      <UiTabPanel v-if="canAccessTab('mappings')" id="mappings" :active="activeTab === 'mappings'">
        <AdminMappingsTab
          :mappings="mappings"
          :loading="loadingMappings"
        />
      </UiTabPanel>

      <!-- Link Accounts Tab (Admin) -->
      <UiTabPanel v-if="canAccessTab('link-accounts')" id="link-accounts" :active="activeTab === 'link-accounts'">
        <AdminLinkAccountsTab
          :mappings="mappings"
          :accounts="accounts"
          :loading="loadingMappings"
          @refresh="fetchMappings"
        />
      </UiTabPanel>

      <!-- GM Management Tab -->
      <UiTabPanel v-if="canAccessTab('gms')" id="gms" :active="activeTab === 'gms'">
        <UiSectionHeader title="GM Management" />

        <AdminGMForm
          :realms="realmsList"
          :loading="settingGMLevel"
          :error="gmError"
          :success="gmSuccess"
          @submit="handleSetGMLevel"
        />

        <AdminMailForm
          :realms="realmsList"
          :loading="sendingMail"
          :error="mailError"
          :success="mailSuccess"
          @submit="handleSendMail"
        />
      </UiTabPanel>

      <!-- Files Tab -->
      <UiTabPanel v-if="canAccessTab('files')" id="files" :active="activeTab === 'files'">
        <AdminFilesTab
          :files="publicFiles"
          :loading="loadingFiles"
          :uploading="uploading"
          :upload-progress="uploadProgress"
          :upload-error="uploadError"
          :upload-success="uploadSuccess"
          :deleting-file="deletingFile"
          @upload="handleFileUpload"
          @delete="handleFileDelete"
        />
      </UiTabPanel>

      <!-- Backup & Restore Tab -->
      <UiTabPanel v-if="canAccessTab('backup')" id="backup" :active="activeTab === 'backup'">
        <AdminBackupTab :realms="realmsList" />
      </UiTabPanel>

      <!-- Dressing Room Tab -->
      <UiTabPanel v-if="canAccessTab('dressingroom')" id="dressingroom" :active="activeTab === 'dressingroom'">
        <AdminDressingRoomTab :realms="realmsList" />
      </UiTabPanel>

      <!-- Feature Grants Tab -->
      <UiTabPanel v-if="canAccessTab('feature-grants')" id="feature-grants" :active="activeTab === 'feature-grants'">
        <AdminFeatureGrantsTab />
      </UiTabPanel>

      <!-- Portal Config Tab -->
      <UiTabPanel v-if="canAccessTab('portal-config')" id="portal-config" :active="activeTab === 'portal-config'">
        <AdminPortalConfigTab />
      </UiTabPanel>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.admin-panel {
  @include container;
}

:deep(.ui-page-header__title) {
  @include gradient-text($gradient-text-orange);
}

.access-denied {
  @include card-base;
  padding: $spacing-16;
}
</style>
