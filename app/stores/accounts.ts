import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { ManagedAccount, AccountMapping } from '~/types'

export const useAccountsStore = defineStore('accounts', () => {
  // State
  const accounts = ref<ManagedAccount[]>([])
  const currentAccountId = ref<number | undefined>(undefined)
  const loading = ref(false)
  const error = ref<string | undefined>(undefined)

  // Getters
  const allAccounts = computed(() => accounts.value)

  const currentAccount = computed(() =>
    currentAccountId.value
      ? accounts.value.find(acc => acc.mapping.wowAccountId === currentAccountId.value)
      : undefined
  )

  const hasAccounts = computed(() => accounts.value.length > 0)

  const accountCount = computed(() => accounts.value.length)

  // Actions
  async function loadAccounts(externalId: string) {
    loading.value = true
    error.value = undefined

    try {
      const response = await $fetch<ManagedAccount[]>(
        `/api/accounts/user/${externalId}`,
        { method: 'GET' }
      )

      accounts.value = response
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to load accounts'
      console.error('Load accounts error:', err)
    } finally {
      loading.value = false
    }
  }

  async function createAccountMapping(
    externalId: string,
    wowAccountName: string,
    wowAccountPassword: string
  ) {
    try {
      const data = await $fetch<ManagedAccount>('/api/accounts/map', {
        method: 'POST',
        body: {
          externalId,
          wowAccountName,
          wowAccountPassword,
        },
      })

      accounts.value.push(data)
      return data
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to create mapping'
      throw err
    }
  }

  async function removeAccountMapping(mappingId: AccountMapping) {
    try {
      await $fetch(
        `/api/accounts/map/${mappingId.externalId}/${mappingId.wowAccountId}`,
        { method: 'DELETE' }
      )

      accounts.value = accounts.value.filter(
        acc => acc.mapping.wowAccountId !== mappingId.wowAccountId
      )
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to remove mapping'
      throw err
    }
  }

  function selectAccount(accountId: number) {
    currentAccountId.value = accountId
  }

  function clearError() {
    error.value = undefined
  }

  function $reset() {
    accounts.value = []
    currentAccountId.value = undefined
    loading.value = false
    error.value = undefined
  }

  return {
    // State
    accounts,
    currentAccountId,
    loading,
    error,
    // Getters
    allAccounts,
    currentAccount,
    hasAccounts,
    accountCount,
    // Actions
    loadAccounts,
    createAccountMapping,
    removeAccountMapping,
    selectAccount,
    clearError,
    $reset,
  }
})
