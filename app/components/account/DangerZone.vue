<template>
  <div class="section danger-section">
    <h2>Danger Zone</h2>
    <p class="section-description">This action cannot be undone</p>
    <button 
      @click="handleUnlink" 
      :disabled="loading"
      class="danger-button"
    >
      {{ loading ? 'Unlinking...' : 'Unlink Account' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const emit = defineEmits<{
  unlink: []
}>()

const loading = ref(false)

const handleUnlink = () => {
  if (!confirm('Are you sure you want to unlink this account? This will remove the connection between your web account and this WoW account.')) {
    return
  }

  loading.value = true
  emit('unlink')
}

// Expose loading state so parent can reset it
defineExpose({
  setLoading: (value: boolean) => {
    loading.value = value
  }
})
</script>

<style scoped lang="scss">
.section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);

  h2 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
  }

  .section-description {
    margin: -0.5rem 0 1rem 0;
    color: #666;
    font-size: 0.9rem;
  }
}

.danger-section {
  border: 2px solid #f44336;
  background: #ffebee;
}

.danger-button {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 4px;
  background: #f44336;
  color: white;
  font-weight: 600;
  cursor: pointer;
  font-size: 1rem;

  &:hover:not(:disabled) {
    background: #d32f2f;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
