<template>
  <div class="layout">
    <!-- Navigation/Header would go here -->
    
    <!-- Main Content -->
    <div class="main-content">
      <slot />
    </div>

    <!-- Footer would go here -->
  </div>
</template>

<script setup lang="ts">
// Initialize auth on app load
const authStore = useAuthStore()

onMounted(async () => {
  const isAuthenticated = await authStore.initializeAuth()
  if (!isAuthenticated) {
    navigateTo('/login')
  }
})
</script>

<style scoped>
/* Add your global layout styles here */
</style>
