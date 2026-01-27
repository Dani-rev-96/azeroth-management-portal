<template>
  <div class="section password-section">
    <h2>Change Password</h2>
    <p class="section-description">Update your WoW account password securely</p>

    <form @submit.prevent="handleSubmit" class="password-form">
      <div class="form-group">
        <label>New Password</label>
        <input
				class="form-input"
          v-model="form.newPassword"
          type="password"
          placeholder="Enter new password"
          :disabled="loading"
          required
        />
      </div>
      <div class="form-group">
        <label>Confirm Password</label>
        <input
				class="form-input"
          v-model="form.confirmPassword"
          type="password"
          placeholder="Confirm new password"
          :disabled="loading"
          required
        />
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      <div v-if="success" class="success-message">
        {{ success }}
      </div>

      <button
        type="submit"
        :disabled="loading || !isValid"
        class="submit-button"
      >
        {{ loading ? 'Updating...' : 'Update Password' }}
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = defineProps<{
  accountId: number
}>()

const emit = defineEmits<{
  success: []
}>()

const loading = ref(false)
const error = ref('')
const success = ref('')
const form = ref({
  newPassword: '',
  confirmPassword: ''
})

const isValid = computed(() => {
  return form.value.newPassword.length >= 6 &&
         form.value.newPassword === form.value.confirmPassword
})

const handleSubmit = async () => {
  if (!isValid.value) {
    error.value = 'Passwords must match and be at least 6 characters'
    return
  }

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    await $fetch('/api/accounts/password', {
      method: 'POST',
      body: {
        accountId: props.accountId,
        newPassword: form.value.newPassword
      }
    })

    success.value = 'Password updated successfully!'
    form.value = { newPassword: '', confirmPassword: '' }
    emit('success')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Failed to update password'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.section {
  padding: 1rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;

  h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    color: #e2e8f0;
  }

  .section-description {
    margin: 0 0 1.5rem 0;
    color: #94a3b8;
    font-size: 0.95rem;
  }
}

.password-form {
  max-width: 500px;
}

.submit-button {
  padding: 1rem 2rem;
  border: none;
  border-radius: 0.5rem;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  font-weight: 600;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
