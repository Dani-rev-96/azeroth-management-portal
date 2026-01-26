<template>
  <div class="layout">
    <!-- Navigation -->
    <nav class="navbar">
      <div class="nav-container">
        <NuxtLink to="/" class="nav-brand">
          <span class="brand-icon">⚔️</span>
          <span class="brand-text">Azeroth Portal</span>
        </NuxtLink>

        <div v-if="authStore.isAuthenticated" class="nav-links">
          <NuxtLink to="/account" class="nav-link">
            <span class="nav-icon">🎮</span>
            My Accounts
          </NuxtLink>
          <NuxtLink to="/downloads" class="nav-link">
            <span class="nav-icon">📦</span>
            Downloads
          </NuxtLink>
          <NuxtLink to="/community" class="nav-link">
            <span class="nav-icon">👥</span>
            Community
          </NuxtLink>
          <NuxtLink v-if="isGM" to="/admin" class="nav-link nav-link-admin">
            <span class="nav-icon">🛡️</span>
            Admin
          </NuxtLink>
        </div>

        <div class="nav-user">
          <div v-if="authStore.isAuthenticated" class="user-info">
            <span class="username">{{ authStore.user?.preferred_username }}</span>
            <span v-if="isGM" class="gm-badge">GM</span>
          </div>
          <NuxtLink v-else to="/login" class="btn-login">
            Sign In
          </NuxtLink>
        </div>
      </div>
    </nav>

    <!-- Main Content -->
    <div class="main-content">
      <slot />
    </div>

    <!-- Footer -->
    <footer class="footer">
      <div class="footer-container">
        <p>&copy; 2026 Azeroth Management Portal</p>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
// Initialize auth on app load
const authStore = useAuthStore()
const isGM = ref(false)

onMounted(async () => {
  const isAuthenticated = await authStore.initializeAuth()
  if (!isAuthenticated && useRoute().path !== '/login') {
    // Don't redirect if already on login page
    if (useRoute().path !== '/') {
      navigateTo('/login')
    }
  }

  // Check GM status
  if (isAuthenticated) {
    try {
      const { data } = await useFetch('/api/auth/me')
      isGM.value = data.value?.isGM || false
    } catch (error) {
      console.error('Failed to check GM status:', error)
    }
  }
})
</script>

<style scoped>
.layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: #0f172a;
  color: #e2e8f0;
}

.navbar {
  background: #1e293b;
  border-bottom: 1px solid #334155;
  position: sticky;
  top: 0;
  z-index: 100;
}

.nav-container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 1rem 2rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 2rem;
}

.nav-brand {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  text-decoration: none;
  font-size: 1.5rem;
  font-weight: 700;
}

.brand-icon {
  font-size: 2rem;
}

.brand-text {
  background: linear-gradient(to right, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.nav-links {
  display: flex;
  gap: 1rem;
  flex: 1;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  color: #94a3b8;
  text-decoration: none;
  border-radius: 0.5rem;
  font-weight: 600;
  transition: all 0.2s;
}

.nav-link:hover {
  color: #e2e8f0;
  background: rgba(148, 163, 184, 0.1);
}

.nav-link.router-link-active {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
}

.nav-link-admin {
  color: #fbbf24;
}

.nav-link-admin:hover {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.nav-link-admin.router-link-active {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
}

.nav-icon {
  font-size: 1.25rem;
}

.nav-user {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.username {
  color: #e2e8f0;
  font-weight: 600;
}

.gm-badge {
  padding: 0.25rem 0.75rem;
  background: rgba(245, 158, 11, 0.2);
  border: 1px solid #f59e0b;
  border-radius: 0.375rem;
  color: #f59e0b;
  font-size: 0.875rem;
  font-weight: 600;
}

.btn-login {
  padding: 0.75rem 1.5rem;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  text-decoration: none;
  border-radius: 0.5rem;
  font-weight: 600;
  transition: all 0.2s;
}

.btn-login:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.main-content {
  flex: 1;
  padding: 2rem 0;
}

.footer {
  background: #1e293b;
  border-top: 1px solid #334155;
  padding: 2rem 0;
  margin-top: auto;
}

.footer-container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 2rem;
  text-align: center;
  color: #94a3b8;
}

@media (max-width: 768px) {
  .nav-container {
    flex-direction: column;
    gap: 1rem;
  }

  .nav-links {
    flex-direction: column;
    width: 100%;
  }

  .nav-link {
    justify-content: center;
  }
}
</style>
