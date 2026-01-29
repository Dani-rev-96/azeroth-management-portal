<script setup lang="ts">
import type { ShopNotification } from '~/composables/useShop'

defineProps<{
  notification: ShopNotification | null
}>()
</script>

<template>
  <Teleport to="body">
    <Transition name="slide">
      <div v-if="notification" class="notification" :class="notification.type">
        <span class="notification-icon">
          {{ notification.type === 'success' ? '✅' : '❌' }}
        </span>
        <span class="notification-message">{{ notification.message }}</span>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.notification {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  padding: 1rem 1.5rem;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  z-index: 1000;

  &.success {
    background: rgba($success, 0.9);
    color: white;
  }

  &.error {
    background: rgba($error, 0.9);
    color: white;
  }

  .notification-icon {
    font-size: 1.25rem;
  }
}

.slide-enter-active,
.slide-leave-active {
  transition: all 0.3s ease;
}

.slide-enter-from,
.slide-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

@media (max-width: 768px) {
  .notification {
    left: 1rem;
    right: 1rem;
    bottom: 1rem;
  }
}
</style>
