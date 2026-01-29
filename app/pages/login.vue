<template>
  <div class="login-page">
    <div class="login-card">
      <h1>WoW Management</h1>

      <!-- Direct Auth Mode: Login or Register -->
      <div v-if="isDirectAuth" class="auth-forms">
        <!-- Login Form -->
        <div v-if="!showRegistration" class="login-form">
          <p class="info-text">Login with your WoW account credentials</p>

          <form @submit.prevent="handleDirectLogin">
            <div class="form-group">
              <label for="username">Username</label>
              <input
                id="username"
                v-model="username"
                type="text"
                placeholder="WoW Account Username"
                required
                autocomplete="username"
              />
            </div>

            <div class="form-group">
              <label for="password">Password</label>
              <input
                id="password"
                v-model="password"
                type="password"
                placeholder="Password"
                required
                autocomplete="current-password"
              />
            </div>

            <button type="submit" class="login-button" :disabled="isLoading">
              {{ isLoading ? 'Logging in...' : 'Login' }}
            </button>
          </form>

          <div class="toggle-link">
            <span>Don't have an account?</span>
            <button type="button" class="link-button" @click="showRegistration = true">
              Create one
            </button>
          </div>
        </div>

        <!-- Registration Form -->
        <div v-else class="registration-form">
          <p class="info-text">Create a new WoW account</p>

          <CreateAccountForm @success="onAccountCreated" />

          <div class="toggle-link">
            <span>Already have an account?</span>
            <button type="button" class="link-button" @click="showRegistration = false">
              Login instead
            </button>
          </div>
        </div>
      </div>

      <!-- External Auth Mode -->
      <div v-else class="info-box">
        <p>
          This application requires authentication.
          <br>
          <br>
          In production, you will be authenticated via OAuth-Proxy and can access your management dashboard.
        </p>

        <button
          @click="handleOAuthLogin"
          class="login-button"
        >
          Login
        </button>
      </div>

      <div v-if="error" class="error-message">
        <p>{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '~/stores/auth'
import CreateAccountForm from '~/components/CreateAccountForm.vue'

definePageMeta({
  layout: false,
})

const error = ref('')
const username = ref('')
const password = ref('')
const isLoading = ref(false)
const isDirectAuth = ref(false)
const showRegistration = ref(false)
const authStore = useAuthStore()

// Check auth mode on mount
onMounted(async () => {
  // If already authenticated, redirect to dashboard
  if (authStore.isAuthenticated) {
    navigateTo('/')
    return
  }

  // Fetch auth config to determine login mode
  try {
    const config = await $fetch<{ isDirectAuth: boolean }>('/api/auth/config')
    isDirectAuth.value = config.isDirectAuth
  } catch {
    // Default to OAuth if config fails
    isDirectAuth.value = false
  }
})

const handleDirectLogin = async () => {
  if (isLoading.value) return

  error.value = ''
  isLoading.value = true

  try {
    await $fetch('/api/auth/login', {
      method: 'POST',
      body: {
        username: username.value,
        password: password.value,
      },
    })

    // Re-initialize auth after login
    const success = await authStore.initializeAuth()

    if (success) {
      navigateTo('/')
    } else {
      error.value = 'Authentication failed. Please check your credentials.'
    }
  } catch (err: unknown) {
    const fetchError = err as { data?: { message?: string } }
    error.value = fetchError?.data?.message || 'Login failed. Please check your credentials.'
  } finally {
    isLoading.value = false
  }
}

const onAccountCreated = async (credentials: { username: string; password: string }) => {
  // After registration, automatically log in with the new credentials
  username.value = credentials.username
  password.value = credentials.password
  showRegistration.value = false

  // Give a brief moment for the UI to update, then log in
  await handleDirectLogin()
}

const handleOAuthLogin = async () => {
  try {
    // In oauth-proxy mode, just redirect to trigger auth
    const success = await authStore.initializeAuth()

    if (success) {
      navigateTo('/')
    } else {
      error.value = 'Authentication failed. Please try again.'
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Login failed'
  }
}
</script>

<style scoped>
.login-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Source Sans Pro',
    sans-serif;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
}

.login-card {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 2rem;
  width: 100%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
}

.login-card h1 {
  color: #fff;
  text-align: center;
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
}

.info-text {
  color: #aaa;
  text-align: center;
  margin-bottom: 1.5rem;
}

.info-box {
  color: #aaa;
  text-align: center;
  margin-bottom: 1rem;
}

.info-box p {
  margin-bottom: 1.5rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  color: #ccc;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
}

.form-group input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
  font-size: 1rem;
  transition: border-color 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #4f8ef7;
}

.form-group input::placeholder {
  color: #666;
}

.login-button {
  width: 100%;
  padding: 0.75rem;
  border: none;
  border-radius: 6px;
  background: linear-gradient(135deg, #4f8ef7 0%, #3b7dd8 100%);
  color: #fff;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.1s;
  margin-top: 1rem;
}

.login-button:hover:not(:disabled) {
  opacity: 0.9;
}

.login-button:active:not(:disabled) {
  transform: scale(0.98);
}

.login-button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  margin-top: 1rem;
  padding: 0.75rem;
  background: rgba(220, 53, 69, 0.2);
  border: 1px solid rgba(220, 53, 69, 0.3);
  border-radius: 6px;
  color: #ff6b6b;
  text-align: center;
}

.error-message p {
  margin: 0;
}

.toggle-link {
  margin-top: 1.5rem;
  text-align: center;
  color: #888;
  font-size: 0.875rem;
}

.toggle-link span {
  margin-right: 0.25rem;
}

.link-button {
  background: none;
  border: none;
  color: #4f8ef7;
  cursor: pointer;
  font-size: 0.875rem;
  padding: 0;
  text-decoration: underline;
  transition: color 0.2s;
}

.link-button:hover {
  color: #7ab3ff;
}

/* Style the CreateAccountForm within the login page */
.registration-form :deep(.create-account-form) {
  background: transparent;
  padding: 0;
  border: none;
}

.registration-form :deep(.form-group label) {
  color: #ccc;
}

.registration-form :deep(.form-group input) {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: #fff;
}

.registration-form :deep(.form-group input:focus) {
  border-color: #4f8ef7;
}

.registration-form :deep(.form-group small) {
  color: #666;
}

.registration-form :deep(.submit-button) {
  background: linear-gradient(135deg, #4f8ef7 0%, #3b7dd8 100%);
}
</style>
