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
          <p>Coming soon: Manage GM access levels and permissions</p>
        </section>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()

const isGM = ref(false)
const gmLevel = ref(0)
const activeTab = ref('accounts')
const searchQuery = ref('')

const loadingAccounts = ref(false)
const loadingMappings = ref(false)

const accounts = ref<any[]>([])
const mappings = ref<any[]>([])

// Check GM status
onMounted(async () => {
  try {
    const { data } = await useFetch('/api/auth/me')
    isGM.value = data.value?.isGM || false
    gmLevel.value = data.value?.gmLevel || 0

    if (isGM.value) {
      await Promise.all([
        fetchAccounts(),
        fetchMappings()
      ])
    }
  } catch (error) {
    console.error('Failed to check GM status:', error)
    navigateTo('/')
  }
})

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

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleDateString()
}
</script>

<style scoped>
.admin-panel {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.page-header h1 {
  font-size: 2.5rem;
  margin: 0;
  background: linear-gradient(to right, #f59e0b, #d97706);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.gm-badge {
  padding: 0.5rem 1rem;
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid #f59e0b;
  border-radius: 0.5rem;
  color: #f59e0b;
  font-weight: 600;
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

.tabs {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  border-bottom: 2px solid #334155;
}

.tabs button {
  padding: 1rem 2rem;
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: all 0.2s;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.tabs button:hover {
  color: #e2e8f0;
}

.tabs button.active {
  color: #f59e0b;
  border-bottom-color: #f59e0b;
}

.tab-content {
  animation: fadeIn 0.3s;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.content-section {
  /* Content wrapper for consistent spacing */
}

.section-header {
  margin-bottom: 2rem;
}

.section-header h2 {
  color: #e2e8f0;
  font-size: 1.5rem;
  margin-bottom: 0.5rem;
}

.subtitle {
  color: #94a3b8;
  font-size: 0.9rem;
}

.controls {
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  padding: 0.75rem 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.5rem;
  color: #e2e8f0;
  font-size: 1rem;
  min-width: 300px;
}

.search-input:focus {
  outline: none;
  border-color: #f59e0b;
}

.loading {
  text-align: center;
  padding: 4rem 2rem;
  color: #94a3b8;
}

.accounts-table-container,
.mappings-table-container {
  overflow-x: auto;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
}

.accounts-table {
  width: 100%;
  border-collapse: collapse;
}

.accounts-table th {
  padding: 1rem;
  text-align: left;
  background: #0f172a;
  color: #94a3b8;
  font-weight: 600;
  border-bottom: 1px solid #334155;
}

.accounts-table td {
  padding: 1rem;
  border-bottom: 1px solid #334155;
  color: #e2e8f0;
}

.accounts-table tbody tr:hover {
  background: rgba(148, 163, 184, 0.05);
}

.username {
  font-weight: 600;
  color: #60a5fa;
}

.gm-badge-small {
  margin-left: 0.5rem;
  padding: 0.125rem 0.5rem;
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid #f59e0b;
  border-radius: 0.25rem;
  color: #f59e0b;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.875rem;
  font-weight: 600;
}

.status-badge.online {
  background: rgba(34, 197, 94, 0.2);
  color: #22c55e;
}

.status-badge.offline {
  background: rgba(148, 163, 184, 0.2);
  color: #94a3b8;
}

.btn-small {
  padding: 0.5rem 1rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid #3b82f6;
  color: #60a5fa;
  border-radius: 0.375rem;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-small:hover {
  background: rgba(59, 130, 246, 0.2);
}

.btn-primary {
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  text-decoration: none;
  border-radius: 0.5rem;
  font-weight: 600;
  display: inline-block;
}

.btn-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}
</style>
