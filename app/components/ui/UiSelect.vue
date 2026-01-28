<script setup lang="ts">
/**
 * UiSelect - Form select component
 */
export interface SelectOption {
  value: string | number
  label: string
  disabled?: boolean
}

export interface Props {
  modelValue: string | number
  options: SelectOption[]
  placeholder?: string
  disabled?: boolean
  required?: boolean
}

withDefaults(defineProps<Props>(), {
  placeholder: 'Select an option',
  disabled: false,
  required: false,
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

function handleChange(event: Event) {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}
</script>

<template>
  <select
    :value="modelValue"
    :disabled="disabled"
    :required="required"
    class="ui-select"
    @change="handleChange"
  >
    <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
    <option
      v-for="option in options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled"
    >
      {{ option.label }}
    </option>
  </select>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-select {
  width: 100%;
  padding: $spacing-3 $spacing-4;
  padding-right: $spacing-10;
  background: $bg-primary;
  border: 1px solid $border-primary;
  border-radius: $radius-lg;
  color: $text-primary;
  font-size: $font-size-base;
  font-family: inherit;
  cursor: pointer;
  appearance: none;
  transition: border-color $transition-base;

  background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
  background-position: right $spacing-3 center;
  background-repeat: no-repeat;
  background-size: 1.5em 1.5em;

  &:focus {
    outline: none;
    border-color: $blue-light;
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
}
</style>
