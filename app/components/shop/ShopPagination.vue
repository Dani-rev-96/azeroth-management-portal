<script setup lang="ts">
defineProps<{
  page: number
  totalPages: number
}>()

const emit = defineEmits<{
  'page-change': [page: number]
}>()
</script>

<template>
  <div v-if="totalPages > 1" class="pagination">
    <button
      class="page-btn"
      :disabled="page <= 1"
      @click="emit('page-change', page - 1)"
    >
      ← Prev
    </button>
    <span class="page-info">
      Page {{ page }} of {{ totalPages }}
    </span>
    <button
      class="page-btn"
      :disabled="page >= totalPages"
      @click="emit('page-change', page + 1)"
    >
      Next →
    </button>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 2rem;
  padding-top: 1.5rem;
  border-top: 1px solid $border-primary;

  .page-btn {
    padding: 0.5rem 1rem;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: 4px;
    color: $text-secondary;
    cursor: pointer;
    transition: all 0.2s;

    &:hover:not(:disabled) {
      border-color: $color-accent;
      color: $text-primary;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .page-info {
    color: $text-muted;
  }
}
</style>
