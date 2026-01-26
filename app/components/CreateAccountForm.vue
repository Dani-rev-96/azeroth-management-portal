<template>
  <form @submit.prevent="handleSubmit" class="create-account-form">
    <!-- Username -->
    <div class="form-group">
      <label>
        Username
      </label>
      <input
        v-model="formData.username"
        type="text"
        placeholder="e.g., MyAccount"
        minlength="3"
        maxlength="16"
        pattern="[a-zA-Z0-9]+"
        required
      />
      <small>3-16 characters, letters and numbers only</small>
    </div>

    <!-- Password -->
    <div class="form-group">
      <label>
        Password
      </label>
      <input
        v-model="formData.password"
        type="password"
        placeholder="••••••••"
        minlength="8"
        required
      />
      <small>At least 8 characters</small>
    </div>

    <!-- Confirm Password -->
    <div class="form-group">
      <label>
        Confirm Password
      </label>
      <input
        v-model="formData.confirmPassword"
        type="password"
        placeholder="••••••••"
        required
      />
    </div>

    <!-- Email (Optional) -->
    <div class="form-group">
      <label>
        Email (Optional)
      </label>
      <input
        v-model="formData.email"
        type="email"
        placeholder="your@email.com"
      />
      <small>For account recovery</small>
    </div>

    <!-- Error Message -->
    <div v-if="error" class="error-message">
      <p>{{ error }}</p>
    </div>

    <!-- Success Message -->
    <div v-if="success" class="success-message">
      <p>Account created successfully! You can now link it to your profile.</p>
    </div>

    <!-- Submit Button -->
    <button
      type="submit"
      :disabled="loading || success"
      class="submit-button"
    >
      {{ loading ? 'Creating...' : success ? 'Account Created!' : 'Create Account' }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  success: [{ username: string; password: string }]
}>()

const loading = ref(false)
const error = ref('')
const success = ref(false)

const formData = ref({
  username: '',
  password: '',
  confirmPassword: '',
  email: '',
})

const handleSubmit = async () => {
  loading.value = true
  error.value = ''
  success.value = false

  try {
    // Validate passwords match
    if (formData.value.password !== formData.value.confirmPassword) {
      throw new Error('Passwords do not match')
    }

    // Create account
    await $fetch('/api/accounts/create', {
      method: 'POST',
      body: {
        username: formData.value.username,
        password: formData.value.password,
        email: formData.value.email || undefined,
      },
    })

    success.value = true

    // Emit success with credentials so parent can auto-link
    emit('success', {
      username: formData.value.username,
      password: formData.value.password,
    })

    // Reset form after delay
    setTimeout(() => {
      formData.value = {
        username: '',
        password: '',
        confirmPassword: '',
        email: '',
      }
      success.value = false
    }, 3000)
  } catch (err: any) {
    error.value = err.data?.statusMessage || err.message || 'Failed to create account'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.create-account-form {
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

    input {
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

    small {
      display: block;
      margin-top: 0.375rem;
      font-size: 0.85rem;
      color: #94a3b8;
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

  .success-message {
    margin-bottom: 1.5rem;
    padding: 1rem;
    background: rgba(34, 197, 94, 0.1);
    border: 1px solid rgba(34, 197, 94, 0.3);
    border-radius: 0.5rem;
    color: #86efac;

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
