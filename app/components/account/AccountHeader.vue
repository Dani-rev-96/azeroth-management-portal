<template>
  <div class="account-header">
    <div class="header-content">
      <h1>{{ accountName }}</h1>
      <p class="realm-info">{{ realmName }} - {{ realmVersion }}</p>
    </div>
    <button @click="$emit('back')" class="back-button">Back to Dashboard</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  accountName: string
  realmName: string
  realmVersion: string
}>()

defineEmits<{
  back: []
}>()
</script>

<style scoped lang="scss">
.account-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #e0e0e0;

  h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
  }

  .realm-info {
    color: #666;
    margin: 0;
  }
}

.back-button {
  padding: 0.5rem 1rem;
  cursor: pointer;
}
</style>
