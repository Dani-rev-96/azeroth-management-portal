<template>
  <div class="account-detail">
    <div v-if="loading" class="loading">
      <p>Loading account details...</p>
    </div>

    <div v-else-if="error" class="error">
      <p>{{ error }}</p>
      <button @click="navigateTo('/')" class="back-button">Back to Dashboard</button>
    </div>

    <div v-else-if="accountData" class="account-content">
      <AccountHeader
        :account-name="accountData.mapping.wowAccountName"
        :realm-name="primaryRealm?.name || 'No Characters'"
        :realm-version="primaryRealm?.version || ''"
        @back="navigateTo('/')"
      />

      <AccountSecurityInfo :account="azAccount" />

      <PasswordChangeForm
        :account-id="accountId"
        @success="handlePasswordSuccess"
      />

      <!-- Show characters grouped by realm -->
      <div v-for="realmData in accountData.realms" :key="realmData.realm.id" class="realm-section">
        <h2 class="realm-heading">{{ realmData.realm.name }}</h2>
        
        <CharacterList
          :characters="realmData.characters"
          :loading="actionLoading"
          @rename="(char) => handleRenameCharacter(char, realmData.realm.id)"
          @undelete="(char) => handleUndeleteCharacter(char, realmData.realm.id)"
        />

        <AccountStatistics :characters="realmData.characters" />
      </div>

      <CharacterActionModal
        :show="showActionModal"
        :character="selectedCharacter"
        :action="actionType"
        :realm-id="selectedRealmId"
        @close="closeActionModal"
        @success="handleCharacterActionSuccess"
      />

      <DangerZone
        ref="dangerZoneRef"
        @unlink="handleUnlinkAccount"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { ManagedAccount, WoWCharacter, AzerothCoreAccount, RealmId, RealmConfig } from '~/types'
import { useAuthStore } from '~/stores/auth'
import { useAccountsStore } from '~/stores/accounts'
import AccountHeader from '~/components/account/AccountHeader.vue'
import AccountSecurityInfo from '~/components/account/AccountSecurityInfo.vue'
import PasswordChangeForm from '~/components/account/PasswordChangeForm.vue'
import CharacterList from '~/components/account/CharacterList.vue'
import CharacterActionModal from '~/components/account/CharacterActionModal.vue'
import AccountStatistics from '~/components/account/AccountStatistics.vue'
import DangerZone from '~/components/account/DangerZone.vue'

definePageMeta({
  layout: 'default',
})

const route = useRoute()
const authStore = useAuthStore()
const accountsStore = useAccountsStore()

const accountId = computed(() => Number(route.params.id))
const loading = ref(true)
const error = ref('')
const accountData = ref<ManagedAccount | null>(null)
const azAccount = ref<AzerothCoreAccount | null>(null)

// Compute primary realm (one with most characters)
const primaryRealm = computed<RealmConfig | null>(() => {
  if (!accountData.value || accountData.value.realms.length === 0) {
    return null
  }
  
  // Sort by character count and return the realm with most characters
  const sorted = [...accountData.value.realms].sort((a, b) => b.characters.length - a.characters.length)
  return sorted[0]?.realm || null
})

// Character actions
const actionLoading = ref(false)
const showActionModal = ref(false)
const actionType = ref<'rename' | 'undelete'>('rename')
const selectedCharacter = ref<WoWCharacter | null>(null)
const selectedRealmId = ref<RealmId | undefined>(undefined)

// Reference to DangerZone component
const dangerZoneRef = ref<any>(null)

// Methods
const loadAccountData = async () => {
  loading.value = true
  error.value = ''

  try {
    if (!authStore.userId) {
      throw new Error('Not authenticated')
    }

    // Load all accounts if not already loaded
    if (!accountsStore.hasAccounts) {
      await accountsStore.loadAccounts(authStore.userId)
    }

    // Find the specific account
    const account = accountsStore.allAccounts.find(
      a => a.mapping.wowAccountId === accountId.value
    )

    if (!account) {
      throw new Error('Account not found')
    }

    accountData.value = account
    // No longer need to set characters separately - they're in accountData.realms

    // Load detailed AzerothCore account info
    await loadAzerothCoreAccount()

  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to load account'
  } finally {
    loading.value = false
  }
}

const loadAzerothCoreAccount = async () => {
  try {
    const response = await $fetch<AzerothCoreAccount>(`/api/accounts/detail/${accountId.value}`)
    azAccount.value = response
  } catch (err) {
    console.error('Failed to load AzerothCore account details:', err)
    // Set defaults if the API doesn't exist yet
    azAccount.value = {
      id: accountData.value?.mapping.wowAccountId || 0,
      username: accountData.value?.mapping.wowAccountName || '',
      salt: '',
      verifier: '',
      email: null,
      joindate: new Date().toISOString(),
      last_ip: '127.0.0.1',
      last_login: new Date().toISOString(),
      online: 0,
      expansion: 2,
      mutetime: BigInt(0),
      locale: 0
    }
  }
}

const handlePasswordSuccess = () => {
  // Optionally reload account data or show notification
  console.log('Password updated successfully')
}

const handleRenameCharacter = (character: WoWCharacter, realmId: RealmId) => {
  selectedCharacter.value = character
  selectedRealmId.value = realmId
  actionType.value = 'rename'
  showActionModal.value = true
}

const handleUndeleteCharacter = (character: WoWCharacter, realmId: RealmId) => {
  selectedCharacter.value = character
  selectedRealmId.value = realmId
  actionType.value = 'undelete'
  showActionModal.value = true
}

const handleCharacterActionSuccess = () => {
  loadAccountData() // Reload to see changes
}

const closeActionModal = () => {
  showActionModal.value = false
  selectedCharacter.value = null
}

const handleUnlinkAccount = async () => {
  try {
    if (!authStore.userId || !accountData.value) {
      throw new Error('Not authenticated or no account data')
    }

    await accountsStore.removeAccountMapping(accountData.value.mapping)
    navigateTo('/')
  } catch (err) {
    alert(err instanceof Error ? err.message : 'Failed to unlink account')
  } finally {
    dangerZoneRef.value?.setLoading(false)
  }
}

onMounted(() => {
  loadAccountData()
})
</script>

<style scoped lang="scss">
.account-detail {
  min-height: 100vh;
}

.loading,
.error {
  padding: 2rem;
  text-align: center;
}

.error {
  color: #d32f2f;
}

.back-button {
  padding: 0.5rem 1rem;
  cursor: pointer;
}

.account-content {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.realm-section {
  margin-bottom: 3rem;
}

.realm-heading {
  font-size: 1.5rem;
  font-weight: 600;
  color: #667eea;
  margin: 0 0 1.5rem 0;
  padding-bottom: 0.5rem;
  border-bottom: 2px solid #667eea;
}
</style>