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
import { computed, watchEffect } from 'vue'
import CreateAccountForm from '~/components/CreateAccountForm.vue'
import LinkAccountForm from '~/components/LinkAccountForm.vue'

definePageMeta({
  layout: 'default',
})

const authStore = useAuthStore()
const accountsStore = useAccountsStore()
const loading = ref(true)

const userId = computed(() => authStore.userId)

const selectAccount = (accountId: number) => {
  accountsStore.selectAccount(accountId)
  navigateTo(`/account/${accountId}`)
}

const onAccountLinked = async () => {
  // Reload accounts after linking
  if (userId.value) {
    await accountsStore.loadAccounts(userId.value)
  }
}

const onAccountCreated = async (credentials: { username: string; password: string }) => {
  // Auto-link the newly created account
  if (userId.value) {
    try {
      await accountsStore.createAccountMapping(
        userId.value,
        credentials.username,
        credentials.password
      )
      await accountsStore.loadAccounts(userId.value)
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
  if (authStore.isAuthenticated && userId.value) {
    loading.value = true
    try {
      await accountsStore.loadAccounts(userId.value)
    } finally {
      loading.value = false
    }
  }
})
</script>

<style scoped lang="scss">
/* Account Index - Page-specific styles only */
/* Shared styles are in ~/assets/css/shared.css */

.dashboard {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.dashboard-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.welcome-section {
  text-align: center;
  padding: 3rem 2rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 1rem;
  border: 1px solid #334155;

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2.5rem;
    font-weight: 700;
    background: linear-gradient(to right, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  p {
    margin: 0;
    font-size: 1.125rem;
    color: #94a3b8;
  }
}

.section {
  padding: 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;

  h2 {
    margin: 0 0 1.5rem 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: #e2e8f0;
  }

  .section-description {
    margin: 0 0 1.5rem 0;
    color: #94a3b8;
    font-size: 0.95rem;
  }
}

.accounts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
}

.account-card {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  overflow: hidden;
  transition: all 0.2s ease;

  &:hover {
    border-color: #475569;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .account-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1.25rem 1.25rem 1rem 1.25rem;
    border-bottom: 1px solid #334155;
    background: rgba(96, 165, 250, 0.05);

    h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: #60a5fa;
      cursor: pointer;
      flex: 1;
      transition: color 0.2s;

      &:hover {
        color: #93c5fd;
      }
    }
  }

  .account-card-body {
    padding: 1.25rem;
    cursor: pointer;
  }

  .realms-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .realm-item {
    padding: 0.875rem;
    background: #1e293b;
    border-radius: 0.5rem;
    border: 1px solid #334155;
  }

  .realm-name {
    margin: 0 0 0.75rem 0;
    color: #a78bfa;
    font-size: 0.95rem;
    font-weight: 600;
  }

  .no-characters {
    padding: 1.5rem;
    text-align: center;
    color: #64748b;
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
        color: #94a3b8;
        font-weight: 500;
      }

      .value {
        color: #e2e8f0;
        font-weight: 600;
      }
    }
  }

  .last-used {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid #334155;
  }
}

.unlink-button {
  padding: 0.375rem 0.625rem;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 1.25rem;
  cursor: pointer;
  border-radius: 0.375rem;
  transition: all 0.2s ease;
  line-height: 1;

  &:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #ef4444;
  }
}

.no-accounts {
  padding: 3rem 2rem;
  text-align: center;
  color: #94a3b8;
  background: rgba(148, 163, 184, 0.05);
  border-radius: 0.75rem;
  border: 2px dashed #334155;

  p {
    margin: 0;
    font-size: 1rem;
  }
}
</style>
