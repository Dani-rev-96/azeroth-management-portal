<template>
  <div class="login-page">
    <div class="login-card">
      <h1>WoW Management</h1>
      
      <div class="info-box">
        <p>
          This application requires authentication through Keycloak. 
          <br>
          <br>
          In production, you will be authenticated via OAuth-Proxy and can access your management dashboard.
        </p>
      </div>

      <button
        @click="handleLogin"
        class="login-button"
      >
        Login with Keycloak
      </button>

      <div v-if="error" class="error-message">
        <p>{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '~/stores/auth'

definePageMeta({
  layout: false,
})

const error = ref('')
const authStore = useAuthStore()
const runtimeConfig = useRuntimeConfig()
const useOauthProxy = runtimeConfig.public.authMode === 'oauth-proxy' || runtimeConfig.public.authMode === 'keycloak'

const handleLogin = async () => {
  try {
    if (useOauthProxy) {
      window.location.href = runtimeConfig.public.keycloakUrl
      return
    }
    // In production with oauth-proxy, the user is already authenticated
    // We just need to verify with our backend
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

// If already authenticated, redirect to dashboard
onMounted(() => {
  if (authStore.isAuthenticated) {
    navigateTo('/')
  }
})
</script>

<style scoped>
.login-page {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Source Sans Pro',
    sans-serif;
}
</style>
