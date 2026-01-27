<template>
  <div class="landing-page">
    <!-- Hero Section -->
    <section class="hero">
      <h1>Azeroth Management Portal</h1>
      <p class="tagline">Manage your World of Warcraft accounts and see who's online</p>

      <div v-if="!authStore.isAuthenticated" class="cta-buttons">
        <NuxtLink to="/login" class="btn-primary">Sign In</NuxtLink>
      </div>

      <div v-else class="cta-buttons">
        <NuxtLink to="/account" class="btn-primary">My Accounts</NuxtLink>
        <NuxtLink to="/community" class="btn-secondary">Community</NuxtLink>
        <NuxtLink v-if="isGM" to="/admin" class="btn-admin">Admin Panel</NuxtLink>
      </div>
    </section>

    <!-- Features Grid -->
    <section class="features">
      <div class="feature-card">
        <div class="feature-icon">🎮</div>
        <h3>Account Management</h3>
        <p>Link and manage multiple WoW accounts from one place</p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">👥</div>
        <h3>Community Hub</h3>
        <p>See who's online and check out player statistics</p>
      </div>

      <div class="feature-card">
        <div class="feature-icon">⚔️</div>
        <h3>Character Tools</h3>
        <p>Rename characters and manage your roster</p>
      </div>

      <div v-if="isGM" class="feature-card admin">
        <div class="feature-icon">🛡️</div>
        <h3>GM Tools</h3>
        <p>Manage accounts and moderate the server</p>
      </div>
    </section>

    <!-- Stats Section (if authenticated) -->
    <section v-if="authStore.isAuthenticated && stats" class="stats-preview">
      <h2>Server Status</h2>
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-value">{{ stats.onlinePlayers }}</span>
          <span class="stat-label">Players Online</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.totalAccounts }}</span>
          <span class="stat-label">Total Accounts</span>
        </div>
        <div class="stat-item">
          <span class="stat-value">{{ stats.totalCharacters }}</span>
          <span class="stat-label">Characters Created</span>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
const authStore = useAuthStore()

// Check if user has GM access
const isGM = computed(() => authStore.user?.isGM || false)
const stats = ref<{
  onlinePlayers: number
  totalAccounts: number
  totalCharacters: number
} | null>(null)

// Load stats when authenticated
watchEffect(async () => {
  if (authStore.isAuthenticated && !stats.value) {
    try {
      const { data } = await useFetch('/api/stats/overview')
      stats.value = data.value
    } catch (error) {
      console.error('Failed to load stats:', error)
    }
  }
})
</script>

<style scoped>
/* Landing Page - Page-specific styles only */
/* Shared styles are in ~/assets/css/shared.css */

.landing-page {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem;
}

.hero {
  text-align: center;
  padding: 4rem 2rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border-radius: 1rem;
  margin-bottom: 3rem;
}

.hero h1 {
  font-size: 3rem;
  margin-bottom: 1rem;
  background: linear-gradient(to right, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.tagline {
  font-size: 1.25rem;
  color: #94a3b8;
  margin-bottom: 2rem;
}

.cta-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}

.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 2rem;
  margin-bottom: 3rem;
}

.feature-card.admin {
  border-color: #f59e0b;
}

.stats-preview {
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;
  padding: 2rem;
  text-align: center;
}

.stats-preview h2 {
  margin-bottom: 2rem;
  color: #e2e8f0;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 2rem;
}

.stat-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.stat-value {
  font-size: 2.5rem;
  font-weight: 700;
  background: linear-gradient(to right, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.stat-label {
  color: #94a3b8;
  font-size: 0.9rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
</style>
