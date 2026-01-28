<script setup lang="ts">
/**
 * UiDataTable - Reusable data table component
 */
export interface Column {
  key: string
  label: string
  width?: string
  align?: 'left' | 'center' | 'right'
  sortable?: boolean
}

export interface Props {
  columns: Column[]
  data: Record<string, any>[]
  loading?: boolean
  emptyMessage?: string
  rowKey?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  emptyMessage: 'No data available',
  rowKey: 'id',
})

const emit = defineEmits<{
  rowClick: [row: Record<string, any>]
}>()
</script>

<template>
  <div class="ui-data-table">
    <div class="ui-data-table__container">
      <table class="ui-data-table__table">
        <thead>
          <tr>
            <th
              v-for="column in columns"
              :key="column.key"
              :style="{ width: column.width, textAlign: column.align || 'left' }"
            >
              {{ column.label }}
            </th>
          </tr>
        </thead>
        <tbody v-if="!loading && data.length > 0">
          <tr
            v-for="row in data"
            :key="row[rowKey]"
            @click="emit('rowClick', row)"
          >
            <td
              v-for="column in columns"
              :key="column.key"
              :style="{ textAlign: column.align || 'left' }"
            >
              <slot :name="`cell-${column.key}`" :row="row" :value="row[column.key]">
                {{ row[column.key] }}
              </slot>
            </td>
          </tr>
        </tbody>
      </table>

      <UiLoadingState v-if="loading" message="Loading data..." />
      <UiEmptyState v-else-if="data.length === 0" :message="emptyMessage" />
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;

.ui-data-table {
  &__container {
    overflow-x: auto;
    background: $bg-secondary;
    border: 1px solid $border-primary;
    border-radius: $radius-xl;
  }

  &__table {
    width: 100%;
    border-collapse: collapse;

    th {
      padding: $spacing-4;
      text-align: left;
      background: $bg-primary;
      color: $text-secondary;
      font-weight: $font-weight-semibold;
      font-size: $font-size-sm;
      border-bottom: 1px solid $border-primary;
      white-space: nowrap;
    }

    td {
      padding: $spacing-4;
      border-bottom: 1px solid $border-primary;
      color: $text-primary;
    }

    tbody tr {
      transition: background-color $transition-fast;

      &:hover {
        background: rgba($text-secondary, 0.05);
      }

      &:last-child td {
        border-bottom: none;
      }
    }
  }
}
</style>
