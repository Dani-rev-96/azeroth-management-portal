<template>
  <div class="dashboard">
    <div v-if="loading" class="p-8">
      <p>Loading accounts...</p>
    </div>

    <div v-else-if="!authStore.isAuthenticated" class="p-8">
      <p>Please log in to continue.</p>
    </div>

    <div v-else>
      <!-- Welcome Section -->
      <div class="bg-gradient-to-r from-blue-500 to-blue-600 text-white p-8 mb-8">
        <h1 class="text-4xl font-bold mb-2">
          WoW Management Dashboard
        </h1>
        <p>Welcome, {{ authStore.user?.preferred_username }}</p>
      </div>

      <!-- Accounts Section -->
      <div class="container mx-auto px-8">
        <h2 class="text-2xl font-bold mb-6">Your WoW Accounts</h2>

        <div v-if="accountsStore.hasAccounts" class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div
            v-for="account in accountsStore.allAccounts"
            :key="account.mapping.wowAccountId"
            class="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition"
            @click="selectAccount(account.mapping.wowAccountId)"
          >
            <h3 class="text-xl font-bold mb-2">{{ account.mapping.wowAccountName }}</h3>
            <p class="text-gray-600 mb-3">{{ account.realm.name }}</p>
            <div class="text-sm text-gray-500">
              <p>Characters: {{ account.characters.length }}</p>
              <p v-if="account.mapping.lastUsed">
                Last used: {{ new Date(account.mapping.lastUsed).toLocaleDateString() }}
              </p>
            </div>
          </div>
        </div>

        <div v-else class="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <p class="text-blue-900">
            No WoW accounts linked yet. Link your first account to get started!
          </p>
        </div>

        <!-- Add Account Section -->
        <div class="bg-white rounded-lg shadow-md p-6">
          <h3 class="text-xl font-bold mb-4">Link WoW Account</h3>
          <LinkAccountForm @success="onAccountLinked" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

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

onMounted(async () => {
  loading.value = true
  try {
    if (authStore.userId) {
      await accountsStore.loadAccounts(authStore.userId)
    }
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.dashboard {
  min-height: 100vh;
  background-color: #f3f4f6;
}
</style>
