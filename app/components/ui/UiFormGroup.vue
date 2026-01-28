<script setup lang="ts">
/**
 * UiFormGroup - Form field wrapper with label, input, and hint/error
 */
export interface Props {
  label?: string
  htmlFor?: string
  hint?: string
  error?: string
  required?: boolean
}

defineProps<Props>()
</script>

<template>
  <div class="ui-form-group">
    <label v-if="label" :for="htmlFor" class="ui-form-group__label">
      {{ label }}
      <span v-if="required" class="ui-form-group__required" aria-hidden="true">*</span>
    </label>
    <slot />
    <small v-if="error" class="ui-form-group__error" role="alert">{{ error }}</small>
    <small v-else-if="hint" class="ui-form-group__hint">{{ hint }}</small>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-form-group {
  margin-bottom: $spacing-6;

  &__label {
    display: block;
    margin-bottom: $spacing-2;
    color: $text-primary;
    font-weight: $font-weight-medium;
    font-size: $font-size-sm;
  }

  &__required {
    color: $error;
    margin-left: $spacing-1;
  }

  &__hint {
    display: block;
    margin-top: $spacing-1;
    color: $text-muted;
    font-size: $font-size-xs;
  }

  &__error {
    display: block;
    margin-top: $spacing-1;
    color: $error-light;
    font-size: $font-size-xs;
  }
}
</style>
