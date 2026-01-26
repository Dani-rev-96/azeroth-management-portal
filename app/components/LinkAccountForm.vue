<template>
  <form @submit.prevent="handleSubmit" class="link-account-form">
    <!-- Account Name -->
    <div class="form-group">
      <label>
        WoW Account Name
      </label>
      <input
        v-model="formData.accountName"
        type="text"
        placeholder="e.g., MyAccount"
        required
      />
    </div>

    <!-- Account Password -->
    <div class="form-group">
      <label>
        WoW Account Password
      </label>
      <input
        v-model="formData.password"
        type="password"
        placeholder="••••••••"
        required
      />
    </div>

    <!-- Error Message -->
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
    </div>

    <!-- Submit Button -->
    <button
      type="submit"
      :disabled="loading"
      class="submit-button"
    >
      {{ loading ? 'Linking...' : 'Link Account' }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'
import { useAccountsStore } from '~/stores/accounts'

const emit = defineEmits<{
  success: []
}>()

const authStore = useAuthStore()
const accountsStore = useAccountsStore()
const loading = ref(false)
const error = ref('')

const formData = ref({
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
      formData.value.password
    )

    // Reset form
    formData.value = {
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

<style scoped lang="scss">
.link-account-form {
  max-width: 500px;
  margin: 0 auto;

  .form-group {
    margin-bottom: 1.5rem;

    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #e2e8f0;
      font-size: 0.95rem;
    }

    input,
    select {
      width: 100%;
      padding: 0.875rem 1rem;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      font-size: 1rem;
      transition: all 0.2s;
      background: #0f172a;
      color: #e2e8f0;

      &:focus {
        outline: none;
        border-color: #60a5fa;
        box-shadow: 0 0 0 3px rgba(96, 165, 250, 0.1);
      }

      &::placeholder {
        color: #64748b;
      }
    }

    select {
      cursor: pointer;
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%2394a3b8'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      background-size: 1.25rem;
      padding-right: 2.5rem;
    }
  }

  .error-message {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 0.5rem;
    color: #fca5a5;

    p {
      margin: 0;
      font-size: 0.95rem;
    }
  }

  .submit-button {
    width: 100%;
    padding: 1rem;
    background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-size: 1rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }
}
</style>
