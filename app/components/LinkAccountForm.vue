<template>
  <form @submit.prevent="handleSubmit" class="space-y-4">
    <!-- Realm Selection -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        Realm
      </label>
      <select
        v-model="formData.realmId"
        class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="wotlk">Azeroth WoTLK (Classical)</option>
        <option value="wotlk-ip">Azeroth IP (Individual Progression)</option>
      </select>
    </div>

    <!-- Account Name -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        WoW Account Name
      </label>
      <input
        v-model="formData.accountName"
        type="text"
        placeholder="e.g., MyAccount"
        class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />
    </div>

    <!-- Account Password -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">
        WoW Account Password
      </label>
      <input
        v-model="formData.password"
        type="password"
        placeholder="••••••••"
        class="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        required
      />
    </div>

    <!-- Error Message -->
    <div v-if="error" class="bg-red-50 border border-red-200 rounded-lg p-3">
      <p class="text-red-900 text-sm">{{ error }}</p>
    </div>

    <!-- Submit Button -->
    <button
      type="submit"
      :disabled="loading"
      class="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
    >
      {{ loading ? 'Linking...' : 'Link Account' }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { RealmId } from '~/types'

const emit = defineEmits<{
  success: []
}>()

const authStore = useAuthStore()
const accountsStore = useAccountsStore()
const loading = ref(false)
const error = ref('')

const formData = ref({
  realmId: 'wotlk' as RealmId,
  accountName: '',
  password: '',
})

const handleSubmit = async () => {
  loading.value = true
  error.value = ''

  try {
    if (!authStore.userId) {
      throw new Error('Not authenticated')
    }

    await accountsStore.createAccountMapping(
      authStore.userId,
      formData.value.accountName,
      formData.value.password,
      formData.value.realmId
    )

    // Reset form
    formData.value = {
      realmId: 'wotlk',
      accountName: '',
      password: '',
    }

    // Emit success event
    emit('success')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to link account'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
/* Component styles */
</style>
