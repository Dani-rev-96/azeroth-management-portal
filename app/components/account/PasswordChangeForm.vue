<template>
  <div class="section password-section">
    <h2>Change Password</h2>
    <p class="section-description">Update your WoW account password securely</p>
    
    <form @submit.prevent="handleSubmit" class="password-form">
      <div class="form-group">
        <label>New Password</label>
        <input 
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
  margin-bottom: 2rem;
  padding: 1.5rem;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  h2 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
  }

  .section-description {
    margin: -0.5rem 0 1rem 0;
    color: #666;
    font-size: 0.9rem;
  }
}

.password-form {
  max-width: 500px;

  .form-group {
    margin-bottom: 1rem;

    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #333;
    }

    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;

      &:focus {
        outline: none;
        border-color: #2196f3;
      }

      &:disabled {
        background: #f5f5f5;
        cursor: not-allowed;
      }
    }
  }
}

.submit-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  background: #2196f3;
  color: white;
  font-weight: 600;
  cursor: pointer;
  font-size: 1rem;

  &:hover:not(:disabled) {
    background: #1976d2;
  }

  &:disabled {
    background: #ccc;
    cursor: not-allowed;
  }
}

.error-message,
.success-message {
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.error-message {
  background: #ffebee;
  border: 1px solid #ffcdd2;
  color: #c62828;
}

.success-message {
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
  color: #2e7d32;
}
</style>
