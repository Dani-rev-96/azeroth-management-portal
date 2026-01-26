import { defineStore } from 'pinia'
import type { ManagedAccount, AccountMapping } from '~/types'

interface AccountsState {
  accounts: ManagedAccount[]
  currentAccountId?: number
  loading: boolean
  error?: string
}

export const useAccountsStore = defineStore('accounts', {
  state: (): AccountsState => ({
    accounts: [],
    currentAccountId: undefined,
    loading: false,
    error: undefined,
  }),

  getters: {
    allAccounts: (state) => state.accounts,
    
    currentAccount: (state) => 
      state.currentAccountId 
        ? state.accounts.find(acc => acc.mapping.wowAccountId === state.currentAccountId)
        : undefined,
    
    hasAccounts: (state) => state.accounts.length > 0,
  },

  actions: {
    // Fetch all accounts for current Keycloak user
    async loadAccounts(keycloakId: string) {
      this.loading = true
      this.error = undefined

      try {
        const response = await $fetch<ManagedAccount[]>(
          `/api/accounts/user/${keycloakId}`,
          { method: 'GET' }
        )

        this.accounts = response
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to load accounts'
        console.error('Load accounts error:', err)
      } finally {
        this.loading = false
      }
    },

    // Create new mapping between Keycloak account and WoW account
    async createAccountMapping(
      keycloakId: string,
      wowAccountName: string,
      wowAccountPassword: string
    ) {
      try {
        const data = await $fetch<ManagedAccount>('/api/accounts/map', {
          method: 'POST',
          body: {
            keycloakId,
            wowAccountName,
            wowAccountPassword,
          },
        })

        this.accounts.push(data)
        return data
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to create mapping'
        throw err
      }
    },

    // Remove account mapping
    async removeAccountMapping(mappingId: AccountMapping) {
      try {
        await $fetch(
          `/api/accounts/map/${mappingId.keycloakId}/${mappingId.wowAccountId}`,
          { method: 'DELETE' }
        )

        this.accounts = this.accounts.filter(
          acc => acc.mapping.wowAccountId !== mappingId.wowAccountId
        )
      } catch (err) {
        this.error = err instanceof Error ? err.message : 'Failed to remove mapping'
        throw err
      }
    },

    selectAccount(accountId: number) {
      this.currentAccountId = accountId
    },
  },
})
