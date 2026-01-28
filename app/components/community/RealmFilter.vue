<script setup lang="ts">
import UiSelect from '~/components/ui/UiSelect.vue'

/**
 * RealmFilter - Dropdown to filter by realm
 */
export interface Props {
  modelValue: string
  realms: Record<string, { name: string }>
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const options = computed(() => [
  { value: '', label: 'All Realms' },
  ...Object.entries(props.realms).map(([id, realm]) => ({
    value: id,
    label: realm.name,
  })),
])

</script>

<template>
  <div class="realm-filter">
    <label for="realm-select" class="realm-filter__label">Filter by Realm:</label>
    <UiSelect
      id="realm-select"
      :model-value="modelValue"
      :options="options"
      placeholder=""
      class="realm-filter__select"
      @update:model-value="emit('update:modelValue', $event as string)"
    />
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.realm-filter {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  margin-bottom: $spacing-8;
  padding: $spacing-4;
  background: $bg-secondary;
  border: 1px solid $border-primary;
  border-radius: $radius-xl;

  &__label {
    color: $text-primary;
    font-weight: $font-weight-semibold;
    white-space: nowrap;
  }

  &__select {
    min-width: 200px;
  }
}

@media (max-width: 640px) {
  .realm-filter {
    flex-direction: column;
    align-items: stretch;

    &__select {
      min-width: 100%;
    }
  }
}
</style>
