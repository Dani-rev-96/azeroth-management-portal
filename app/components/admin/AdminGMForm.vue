<script setup lang="ts">
import UiFormGroup from '~/components/ui/UiFormGroup.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiMessage from '~/components/ui/UiMessage.vue'

/**
 * AdminGMForm - Set GM access level form
 */
export interface RealmOption {
  realmId: number
  name: string
}

export interface GMFormData {
  accountId: number | null
  gmLevel: number
  realmId: number
  comment: string
}

export interface Props {
  realms: RealmOption[]
  loading?: boolean
  error?: string
  success?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  submit: [data: GMFormData]
}>()

const form = reactive<GMFormData>({
  accountId: null,
  gmLevel: 0,
  realmId: -1,
  comment: '',
})

function handleSubmit() {
  if (!form.accountId) return
  emit('submit', { ...form })
}

// Reset form after successful submission
watch(() => props.success, (newSuccess) => {
  if (newSuccess) {
    form.accountId = null
    form.gmLevel = 0
    form.realmId = -1
    form.comment = ''
  }
})
</script>

<template>
  <div class="gm-form-section">
    <h3 class="gm-form-section__title">Set GM Access Level</h3>

    <form class="gm-form" @submit.prevent="handleSubmit">
      <div class="form-row">
        <UiFormGroup label="Account ID" html-for="gm-account-id" required>
          <UiInput
            id="gm-account-id"
            v-model="form.accountId"
            type="number"
            placeholder="Enter account ID"
            required
          />
        </UiFormGroup>

        <UiFormGroup label="GM Level (0-10)" html-for="gm-level" required hint="0 = Remove GM access, 1-3 = Standard levels">
          <UiInput
            id="gm-level"
            v-model="form.gmLevel"
            type="number"
            :min="0"
            :max="10"
            placeholder="0"
            required
          />
        </UiFormGroup>

        <UiFormGroup label="Realm" html-for="gm-realm">
          <UiSelect
            id="gm-realm"
            v-model="form.realmId"
            :options="[
              { value: -1, label: 'All Realms' },
              ...realms.map(r => ({ value: r.realmId, label: r.name }))
            ]"
            placeholder=""
          />
        </UiFormGroup>
      </div>

      <UiFormGroup label="Comment (Optional)" html-for="gm-comment">
        <UiInput
          id="gm-comment"
          v-model="form.comment"
          type="text"
          placeholder="Reason for GM access"
        />
      </UiFormGroup>

      <div class="gm-form__actions">
        <UiButton type="submit" :loading="loading" :disabled="!form.accountId">
          🛡️ Set GM Level
        </UiButton>
      </div>

      <UiMessage v-if="error" variant="error">{{ error }}</UiMessage>
      <UiMessage v-if="success" variant="success">{{ success }}</UiMessage>
    </form>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.gm-form-section {
  @include card-base;
  margin-bottom: $spacing-8;

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin: 0 0 $spacing-6;
  }
}

.gm-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;

  &__actions {
    margin-top: $spacing-2;
  }
}

.form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: $spacing-4;
}
</style>
