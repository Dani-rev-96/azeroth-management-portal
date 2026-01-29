<template>
  <div v-if="showUnlink" class="section danger-section">
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

const props = withDefaults(defineProps<{
  /** Hide the unlink button (e.g., in direct auth mode) */
  showUnlink?: boolean
}>(), {
  showUnlink: true,
})

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
  padding: 2rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 1rem;

  h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    color: #e2e8f0;
  }

  .section-description {
    margin: 0 0 1.5rem 0;
    color: #94a3b8;
    font-size: 0.95rem;
  }
}

.danger-section {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.05);
}

.danger-button {
  padding: 1rem 2rem;
  border: 1px solid #ef4444;
  border-radius: 0.5rem;
  background: rgba(239, 68, 68, 0.1);
  color: #fca5a5;
  font-weight: 600;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.2s;

  &:hover:not(:disabled) {
    background: rgba(239, 68, 68, 0.2);
    transform: translateY(-2px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
