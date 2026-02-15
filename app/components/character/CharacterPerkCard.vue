<script setup lang="ts">
/**
 * CharacterPerkCard - A generic card for character perks/unlockables
 *
 * Designed to be reusable for any unlockable feature (spells, mounts, abilities, etc.)
 * Supports multiple states: locked (requirements not met), offline (character not online),
 * available (ready to unlock), loading, success, and error.
 */

export interface PerkCardProps {
  /** Display icon (emoji or image URL) */
  icon: string
  /** Perk title */
  title: string
  /** Description shown when the perk is available */
  description: string
  /** Message displayed when the requirement is not met */
  lockedMessage?: string
  /** Message displayed when the character is offline */
  offlineMessage?: string
  /** Message displayed after successfully unlocking */
  successMessage?: string
  /** Whether the character meets the requirements */
  meetsRequirements: boolean
  /** Whether the character is online */
  isOnline: boolean
  /** Whether the perk is currently being unlocked */
  loading: boolean
  /** Whether the perk has already been unlocked */
  unlocked: boolean
  /** Error message to display */
  error?: string
  /** Label for the action button */
  buttonLabel?: string
  /** Label for the button when loading */
  buttonLoadingLabel?: string
  /** Label for the button when unlocked */
  buttonUnlockedLabel?: string
  /** Accent color class: 'purple' | 'blue' | 'green' | 'orange' | 'red' */
  accent?: string
}

const props = withDefaults(defineProps<PerkCardProps>(), {
  lockedMessage: 'Requirements not met.',
  offlineMessage: 'Character must be online.',
  successMessage: 'Successfully unlocked!',
  buttonLabel: 'Unlock',
  buttonLoadingLabel: '⏳',
  buttonUnlockedLabel: '✓ Unlocked',
  accent: 'purple',
})

const emit = defineEmits<{
  unlock: []
}>()

function handleUnlock() {
  if (!props.meetsRequirements || !props.isOnline || props.loading || props.unlocked) return
  emit('unlock')
}
</script>

<template>
  <div
    class="perk-card"
    :class="[
      `perk-card--${accent}`,
      {
        'perk-card--locked': !meetsRequirements,
        'perk-card--offline': meetsRequirements && !isOnline,
        'perk-card--unlocked': unlocked,
      },
    ]"
  >
    <div class="perk-card__content">
      <div class="perk-card__icon-wrapper">
        <span class="perk-card__icon">{{ icon }}</span>
      </div>
      <div class="perk-card__info">
        <h3 class="perk-card__title">{{ title }}</h3>
        <p v-if="!meetsRequirements" class="perk-card__description perk-card__description--locked">
          {{ lockedMessage }}
        </p>
        <p v-else-if="!isOnline" class="perk-card__description perk-card__description--offline">
          {{ offlineMessage }}
        </p>
        <p v-else-if="unlocked" class="perk-card__description perk-card__description--success">
          {{ successMessage }}
        </p>
        <p v-else class="perk-card__description">
          {{ description }}
        </p>
      </div>
      <div class="perk-card__action">
        <button
          class="perk-card__button"
          :disabled="!meetsRequirements || !isOnline || loading || unlocked"
          :class="{ 'perk-card__button--unlocked': unlocked }"
          @click="handleUnlock"
        >
          <span v-if="loading" class="perk-card__spinner">{{ buttonLoadingLabel }}</span>
          <span v-else-if="unlocked">{{ buttonUnlockedLabel }}</span>
          <span v-else>{{ buttonLabel }}</span>
        </button>
      </div>
    </div>
    <p v-if="error" class="perk-card__error">{{ error }}</p>
  </div>
</template>

<style scoped lang="scss">
// Accent color maps
$accents: (
  purple: (
    border: #a78bfa,
    bg-start: rgba(167, 139, 250, 0.08),
    bg-end: rgba(139, 92, 246, 0.04),
    icon-bg: rgba(167, 139, 250, 0.15),
    icon-border: rgba(167, 139, 250, 0.3),
    title: #c4b5fd,
    btn-start: #a78bfa,
    btn-end: #8b5cf6,
    btn-shadow: rgba(167, 139, 250, 0.4),
  ),
  blue: (
    border: #60a5fa,
    bg-start: rgba(96, 165, 250, 0.08),
    bg-end: rgba(59, 130, 246, 0.04),
    icon-bg: rgba(96, 165, 250, 0.15),
    icon-border: rgba(96, 165, 250, 0.3),
    title: #93c5fd,
    btn-start: #60a5fa,
    btn-end: #3b82f6,
    btn-shadow: rgba(96, 165, 250, 0.4),
  ),
  green: (
    border: #4ade80,
    bg-start: rgba(74, 222, 128, 0.08),
    bg-end: rgba(34, 197, 94, 0.04),
    icon-bg: rgba(74, 222, 128, 0.15),
    icon-border: rgba(74, 222, 128, 0.3),
    title: #86efac,
    btn-start: #4ade80,
    btn-end: #22c55e,
    btn-shadow: rgba(74, 222, 128, 0.4),
  ),
  orange: (
    border: #fb923c,
    bg-start: rgba(251, 146, 60, 0.08),
    bg-end: rgba(249, 115, 22, 0.04),
    icon-bg: rgba(251, 146, 60, 0.15),
    icon-border: rgba(251, 146, 60, 0.3),
    title: #fdba74,
    btn-start: #fb923c,
    btn-end: #f97316,
    btn-shadow: rgba(251, 146, 60, 0.4),
  ),
  red: (
    border: #f87171,
    bg-start: rgba(248, 113, 113, 0.08),
    bg-end: rgba(239, 68, 68, 0.04),
    icon-bg: rgba(248, 113, 113, 0.15),
    icon-border: rgba(248, 113, 113, 0.3),
    title: #fca5a5,
    btn-start: #f87171,
    btn-end: #ef4444,
    btn-shadow: rgba(248, 113, 113, 0.4),
  ),
);

.perk-card {
  background: linear-gradient(135deg, rgba(30, 41, 59, 0.8) 0%, rgba(51, 65, 85, 0.6) 100%);
  border: 1px solid #475569;
  border-radius: 0.75rem;
  padding: 1rem 1.25rem;
  transition: all 0.3s ease;

  &--locked {
    opacity: 0.6;
  }

  &--offline {
    opacity: 0.75;
  }

  // Generate accent-specific styles
  @each $name, $colors in $accents {
    &--#{$name}:not(.perk-card--locked):not(.perk-card--offline) {
      border-color: map-get($colors, border);
      background: linear-gradient(135deg, map-get($colors, bg-start) 0%, map-get($colors, bg-end) 100%);
    }

    &--#{$name} .perk-card__icon-wrapper {
      background: map-get($colors, icon-bg);
      border-color: map-get($colors, icon-border);
    }

    &--#{$name} .perk-card__title {
      color: map-get($colors, title);
    }

    &--#{$name} .perk-card__button:not(:disabled) {
      background: linear-gradient(135deg, map-get($colors, btn-start) 0%, map-get($colors, btn-end) 100%);

      &:hover {
        box-shadow: 0 4px 12px map-get($colors, btn-shadow);
      }
    }
  }

  // Override title color when locked
  &--locked .perk-card__title {
    color: #94a3b8 !important;
  }

  &--locked .perk-card__icon-wrapper {
    background: rgba(100, 116, 139, 0.15) !important;
    border-color: rgba(100, 116, 139, 0.3) !important;
  }
}

.perk-card__content {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.perk-card__icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 0.5rem;
  border: 1px solid;
  flex-shrink: 0;
}

.perk-card__icon {
  font-size: 1.5rem;

  .perk-card--locked & {
    filter: grayscale(1);
    opacity: 0.5;
  }
}

.perk-card__info {
  flex: 1;
  min-width: 0;
}

.perk-card__title {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 600;
}

.perk-card__description {
  margin: 0;
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.4;

  &--locked {
    color: #64748b;
  }

  &--offline {
    color: #fbbf24;
  }

  &--success {
    color: #86efac;
  }
}

.perk-card__action {
  flex-shrink: 0;
}

.perk-card__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.4rem;
  padding: 0.5rem 1.25rem;
  border-radius: 0.5rem;
  font-weight: 600;
  font-size: 0.875rem;
  cursor: pointer;
  border: none;
  transition: all 0.2s ease;
  color: white;
  white-space: nowrap;

  &:hover:not(:disabled) {
    transform: translateY(-1px);
  }

  &:active:not(:disabled) {
    transform: translateY(0);
  }

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: #334155;
    color: #64748b;
  }

  &--unlocked {
    background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%) !important;
    opacity: 1 !important;
    color: white !important;
  }
}

.perk-card__spinner {
  animation: spin 1s linear infinite;
  display: inline-block;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.perk-card__error {
  margin: 0.75rem 0 0;
  padding: 0.5rem 0.75rem;
  border-radius: 0.375rem;
  font-size: 0.8rem;
  color: #fca5a5;
  background: rgba(239, 68, 68, 0.1);
}

@media (max-width: 640px) {
  .perk-card__content {
    flex-wrap: wrap;
  }

  .perk-card__action {
    width: 100%;

    .perk-card__button {
      width: 100%;
    }
  }
}
</style>
