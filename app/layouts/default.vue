<template>
  <div class="layout">
    <!-- Mobile Menu Overlay -->
    <div
      v-if="authStore.isAuthenticated"
      class="mobile-overlay"
      :class="{ 'active': mobileMenuOpen }"
      @click="mobileMenuOpen = false"
    ></div>

    <!-- Navigation -->
    <nav class="navbar">
      <div class="nav-container">
        <NuxtLink to="/" class="nav-brand">
          <span class="brand-icon">⚔️</span>
          <span class="brand-text">Azeroth Portal</span>
        </NuxtLink>

        <div v-if="authStore.isAuthenticated" class="nav-links desktop-nav">
          <NuxtLink to="/account" class="nav-link">
            <span class="nav-icon">🎮</span>
            My Accounts
          </NuxtLink>
          <NuxtLink to="/shop" class="nav-link">
            <span class="nav-icon">🛒</span>
            Shop
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

        <div class="nav-right">
          <div class="nav-user">
            <div v-if="authStore.isAuthenticated" class="user-info">
              <span class="username">{{ authStore.user?.preferred_username }}</span>
              <span v-if="isGM" class="gm-badge">GM</span>
            </div>
            <NuxtLink v-else to="/login" class="btn-login">
              Sign In
            </NuxtLink>
          </div>

          <button
            v-if="authStore.isAuthenticated"
            class="mobile-menu-toggle"
            @click="mobileMenuOpen = !mobileMenuOpen"
            :aria-label="mobileMenuOpen ? 'Close menu' : 'Open menu'"
          >
            <span class="hamburger" :class="{ 'open': mobileMenuOpen }"></span>
          </button>
        </div>
      </div>
    </nav>

    <!-- Mobile Slide-in Menu -->
    <div
      v-if="authStore.isAuthenticated"
      class="mobile-menu"
      :class="{ 'open': mobileMenuOpen }"
    >
      <div class="mobile-menu-header">
        <span class="mobile-menu-title">Menu</span>
        <button class="mobile-menu-close" @click="mobileMenuOpen = false">✕</button>
      </div>
      <div class="mobile-nav-links">
        <NuxtLink to="/account" class="mobile-nav-link" @click="mobileMenuOpen = false">
          <span class="nav-icon">🎮</span>
          My Accounts
        </NuxtLink>
        <NuxtLink to="/shop" class="mobile-nav-link" @click="mobileMenuOpen = false">
          <span class="nav-icon">🛒</span>
          Shop
        </NuxtLink>
        <NuxtLink to="/downloads" class="mobile-nav-link" @click="mobileMenuOpen = false">
          <span class="nav-icon">📦</span>
          Downloads
        </NuxtLink>
        <NuxtLink to="/community" class="mobile-nav-link" @click="mobileMenuOpen = false">
          <span class="nav-icon">👥</span>
          Community
        </NuxtLink>
        <NuxtLink v-if="isGM" to="/admin" class="mobile-nav-link mobile-nav-link-admin" @click="mobileMenuOpen = false">
          <span class="nav-icon">🛡️</span>
          Admin
        </NuxtLink>
      </div>
    </div>

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
const isGM = computed(() => authStore.user?.isGM || false)
const mobileMenuOpen = ref(false)

onMounted(async () => {
  const isAuthenticated = await authStore.initializeAuth()
  if (!isAuthenticated && useRoute().path !== '/login') {
    // Don't redirect if already on login page
    if (useRoute().path !== '/') {
      navigateTo('/login')
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

.nav-right {
  display: flex;
  align-items: center;
  gap: 1rem;
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
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  scrollbar-color: #334155 transparent;
  -webkit-overflow-scrolling: touch;
}

.nav-links::-webkit-scrollbar {
  height: 4px;
}

.nav-links::-webkit-scrollbar-track {
  background: transparent;
}

.nav-links::-webkit-scrollbar-thumb {
  background: #334155;
  border-radius: 2px;
}

.nav-links::-webkit-scrollbar-thumb:hover {
  background: #475569;
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
  white-space: nowrap;
  flex-shrink: 0;
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

.mobile-menu-toggle {
  display: none;
  background: none;
  border: none;
  cursor: pointer;
  padding: 0.5rem;
  z-index: 1001;
}

.hamburger {
  display: block;
  width: 24px;
  height: 2px;
  background: #94a3b8;
  position: relative;
  transition: background 0.3s;
}

.hamburger::before,
.hamburger::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 2px;
  background: #94a3b8;
  transition: all 0.3s;
}

.hamburger::before {
  top: -8px;
}

.hamburger::after {
  top: 8px;
}

.hamburger.open {
  background: transparent;
}

.hamburger.open::before {
  transform: rotate(45deg);
  top: 0;
}

.hamburger.open::after {
  transform: rotate(-45deg);
  top: 0;
}

.mobile-overlay {
  display: none;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 999;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.mobile-overlay.active {
  opacity: 1;
  pointer-events: all;
}

.mobile-menu {
  display: none;
  position: fixed;
  top: 0;
  right: -300px;
  width: 280px;
  height: 100vh;
  background: #1e293b;
  border-left: 1px solid #334155;
  z-index: 1000;
  transition: right 0.3s ease-out;
  overflow-y: auto;
}

.mobile-menu.open {
  right: 0;
}

.mobile-menu-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1.5rem;
  border-bottom: 1px solid #334155;
}

.mobile-menu-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: #e2e8f0;
}

.mobile-menu-close {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 1.5rem;
  cursor: pointer;
  padding: 0.25rem;
  line-height: 1;
  transition: color 0.2s;
}

.mobile-menu-close:hover {
  color: #e2e8f0;
}

.mobile-nav-links {
  display: flex;
  flex-direction: column;
  padding: 1rem 0;
}

.mobile-nav-link {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.5rem;
  color: #94a3b8;
  text-decoration: none;
  font-weight: 600;
  transition: all 0.2s;
  border-left: 3px solid transparent;
}

.mobile-nav-link:hover {
  color: #e2e8f0;
  background: rgba(148, 163, 184, 0.1);
  border-left-color: #60a5fa;
}

.mobile-nav-link.router-link-active {
  color: #60a5fa;
  background: rgba(96, 165, 250, 0.1);
  border-left-color: #60a5fa;
}

.mobile-nav-link-admin {
  color: #fbbf24;
}

.mobile-nav-link-admin:hover {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  border-left-color: #f59e0b;
}

.mobile-nav-link-admin.router-link-active {
  color: #f59e0b;
  background: rgba(245, 158, 11, 0.1);
  border-left-color: #f59e0b;
}

@media (max-width: 768px) {
  .nav-container {
    gap: 1rem;
  }

  .desktop-nav {
    display: none;
  }

  .mobile-menu-toggle {
    display: block;
  }

  .mobile-overlay,
  .mobile-menu {
    display: block;
  }

  .brand-text {
    font-size: 1rem;
  }

  .username {
    display: none;
  }
}

@media (max-width: 480px) {
  .nav-container {
    padding: 1rem;
  }

  .brand-text {
    display: none;
  }
}
</style>
