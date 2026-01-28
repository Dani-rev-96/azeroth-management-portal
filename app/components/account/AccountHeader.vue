<template>
  <div class="account-header">
    <div class="header-content">
      <h1>{{ accountName }}</h1>
      <p class="realm-info">
        <span class="realm-icon">🌍</span>
        {{ realmName }}<template v-if="realmVersion"> <span class="separator">•</span> {{ realmVersion }}</template>
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  accountName: string
  realmName: string
  realmVersion?: string
}>()
</script>

<style scoped lang="scss">
.account-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 2rem;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  border: 1px solid #334155;
  border-radius: 1rem;

  .header-content {
    flex: 1;
  }

  h1 {
    background: linear-gradient(to right, #60a5fa, #a78bfa);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    font-size: 2.5rem;
    margin: 0 0 1rem 0;
    font-weight: 700;
  }

  .realm-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #94a3b8;
    margin: 0;
    font-size: 1rem;

    .realm-icon {
      font-size: 1.25rem;
    }

    .separator {
      color: #475569;
      margin: 0 0.25rem;
    }
  }
}

@media (max-width: 768px) {
  .account-header {
    padding: 1.5rem;

    h1 {
      font-size: 2rem;
    }

    .realm-info {
      font-size: 0.9rem;
      flex-wrap: wrap;
    }
  }
}
</style>
