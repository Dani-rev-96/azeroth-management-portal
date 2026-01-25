<template>
  <div class="min-h-screen flex flex-col">
    <!-- Navigation/Header would go here -->
    
    <!-- Main Content -->
    <div class="flex-1">
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
