<template>
  <div class="login-page min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600">
    <div class="bg-white rounded-lg shadow-2xl p-8 max-w-md w-full">
      <h1 class="text-3xl font-bold mb-6 text-center">WoW Management</h1>
      
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <p class="text-blue-900 text-sm">
          This application requires authentication through Keycloak. 
          <br>
          <br>
          In production, you will be authenticated via OAuth-Proxy and can access your management dashboard.
        </p>
      </div>

      <button
        @click="handleLogin"
        class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
      >
        Login with Keycloak
      </button>

      <div v-if="error" class="mt-4 bg-red-50 border border-red-200 rounded-lg p-3">
        <p class="text-red-900 text-sm">{{ error }}</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

definePageMeta({
  layout: false,
})

const error = ref('')
const authStore = useAuthStore()

const handleLogin = async () => {
  try {
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
