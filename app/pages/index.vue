<template>
  <div class="dashboard">
    <div v-if="loading" class="loading">
      <p>Loading accounts...</p>
    </div>

    <div v-else-if="!authStore.isAuthenticated" class="not-authenticated">
      <p>Please log in to continue.</p>
    </div>

    <div v-else class="dashboard-content">
      <!-- Welcome Section -->
      <div class="welcome-section">
        <h1>WoW Management Dashboard</h1>
        <p>Welcome, {{ authStore.user?.preferred_username }}</p>
      </div>

      <!-- Accounts Section -->
      <div class="section accounts-section">
        <h2>Your WoW Accounts</h2>

        <div v-if="accountsStore.hasAccounts" class="accounts-grid">
          <div
            v-for="account in accountsStore.allAccounts"
            :key="account.mapping.wowAccountId"
            class="account-card"
          >
            <div class="account-card-header">
              <h3 @click="selectAccount(account.mapping.wowAccountId)">
                {{ account.mapping.wowAccountName }}
              </h3>
              <button
                @click.stop="handleUnlinkAccount(account)"
                class="unlink-button"
                title="Unlink account"
              >
                ✕
              </button>
            </div>
            
            <div 
              class="account-card-body"
              @click="selectAccount(account.mapping.wowAccountId)"
            >
              <!-- Show all realms with characters -->
              <div v-if="account.realms.length > 0" class="realms-list">
                <div v-for="realmData in account.realms" :key="realmData.realm.id" class="realm-item">
                  <p class="realm-name">{{ realmData.realm.name }}</p>
                  <div class="account-details">
                    <div class="detail-item">
                      <span class="label">Characters:</span>
                      <span class="value">{{ realmData.characters.length }}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div v-else class="no-characters">
                <p>No characters found on any realm</p>
              </div>
              
              <div v-if="account.mapping.lastUsed" class="detail-item last-used">
                <span class="label">Last used:</span>
                <span class="value">{{ new Date(account.mapping.lastUsed).toLocaleDateString() }}</span>
              </div>
            </div>
          </div>
        </div>

        <div v-else class="no-accounts">
          <p>No WoW accounts linked yet. Link your first account to get started!</p>
        </div>
      </div>

      <!-- Add Account Section -->
      <div class="section add-account-section">
        <h2>Link WoW Account</h2>
        <LinkAccountForm @success="onAccountLinked" />
      </div>

      <!-- Create Account Section -->
      <div class="section create-account-section">
        <h2>Create New WoW Account</h2>
        <p class="section-description">
          Don't have a WoW account yet? Create one here and link it to your profile.
        </p>
        <CreateAccountForm @success="onAccountCreated" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useAccountsStore } from '~/stores/accounts'
import type { ManagedAccount } from '~/types'

definePageMeta({
  layout: 'default',
})

const authStore = useAuthStore()
const accountsStore = useAccountsStore()
const loading = ref(true)

const selectAccount = (accountId: number) => {
  accountsStore.selectAccount(accountId)
  navigateTo(`/account/${accountId}`)
}

const onAccountLinked = async () => {
  // Reload accounts after linking
  if (authStore.userId) {
    await accountsStore.loadAccounts(authStore.userId)
  }
}

const onAccountCreated = async (credentials: { username: string; password: string }) => {
  // Auto-link the newly created account
  if (authStore.userId) {
    try {
      await accountsStore.createAccountMapping(
        authStore.userId,
        credentials.username,
        credentials.password
      )
      await accountsStore.loadAccounts(authStore.userId)
    } catch (err) {
      console.error('Failed to auto-link new account:', err)
      // User can still manually link it
    }
  }
}

const handleUnlinkAccount = async (account: ManagedAccount) => {
  if (!confirm(`Are you sure you want to unlink "${account.mapping.wowAccountName}"? This will remove the connection between your web account and this WoW account.`)) {
    return
  }

  try {
    await accountsStore.removeAccountMapping(account.mapping)
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to unlink account')
  }
}

watchEffect(async () => {
  if (authStore.isAuthenticated) {
    loading.value = true
    try {
      if (authStore.userId) {
        await accountsStore.loadAccounts(authStore.userId)
      }
    } finally {
      loading.value = false
    }
  }
})
</script>

<style scoped lang="scss">
.dashboard {
  min-height: 100vh;
  background: #f5f5f5;
}

.loading,
.not-authenticated {
  padding: 2rem;
  text-align: center;
}

.dashboard-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.welcome-section {
  margin-bottom: 2rem;
  padding: 2rem;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  color: white;

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
    font-weight: 700;
  }

  p {
    margin: 0;
    font-size: 1.1rem;
    opacity: 0.95;
  }
}

.section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #333;
  }
}

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1.5rem;
}

.account-card {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  background: #fafafa;
  overflow: hidden;
  transition: all 0.2s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    transform: translateY(-2px);
  }

  .account-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem 1rem 0.5rem 1rem;
    border-bottom: 1px solid #e0e0e0;

    h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #333;
      cursor: pointer;
      flex: 1;

      &:hover {
        color: #667eea;
      }
    }
  }

  .account-card-body {
    padding: 1rem;
    cursor: pointer;
  }

  .realms-list {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .realm-item {
    padding: 0.75rem;
    background: white;
    border-radius: 6px;
    border: 1px solid #e0e0e0;
  }

  .realm-name {
    margin: 0 0 0.75rem 0;
    color: #667eea;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .no-characters {
    padding: 1rem;
    text-align: center;
    color: #999;
    font-size: 0.9rem;
    font-style: italic;
  }

  .account-details {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;

    .detail-item {
      display: flex;
      justify-content: space-between;
      font-size: 0.9rem;

      .label {
        color: #666;
        font-weight: 500;
      }

      .value {
        color: #333;
        font-weight: 600;
      }
    }
  }

  .last-used {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #e0e0e0;
  }
}

.unlink-button {
  padding: 0.25rem 0.5rem;
  border: none;
  background: transparent;
  color: #999;
  font-size: 1.25rem;
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.2s ease;
  line-height: 1;

  &:hover {
    background: #ffebee;
    color: #f44336;
  }
}

.no-accounts {
  padding: 2rem;
  text-align: center;
  color: #666;
  background: #f9f9f9;
  border-radius: 8px;
  border: 2px dashed #e0e0e0;

  p {
    margin: 0;
  }
}

.add-account-section {
  h2 {
    margin-bottom: 1rem;
  }
}

.create-account-section {
  h2 {
    margin-bottom: 0.5rem;
  }

  .section-description {
    margin: 0 0 1.5rem 0;
    color: #666;
    font-size: 0.95rem;
  }
}
</style>
