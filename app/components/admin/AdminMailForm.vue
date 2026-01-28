<script setup lang="ts">
/**
 * AdminMailForm - Send item via in-game mail form
 */

import UiFormGroup from '~/components/ui/UiFormGroup.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiTextarea from '~/components/ui/UiTextarea.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiMessage from '~/components/ui/UiMessage.vue'

export interface RealmOption {
  id: string
  name: string
}

export interface MailFormData {
  characterName: string
  itemId: number | null
  itemCount: number
  subject: string
  body: string
  realmId: string
}

export interface Props {
  realms: RealmOption[]
  loading?: boolean
  error?: string
  success?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  submit: [data: MailFormData]
}>()

const form = reactive<MailFormData>({
  characterName: '',
  itemId: null,
  itemCount: 1,
  subject: 'GM Mail',
  body: '',
  realmId: '',
})

const isValid = computed(() =>
  form.characterName && form.itemId && form.realmId
)

function handleSubmit() {
  if (!isValid.value) return
  emit('submit', { ...form })
}

// Reset form after successful submission
watch(() => props.success, (newSuccess) => {
  if (newSuccess) {
    form.characterName = ''
    form.itemId = null
    form.itemCount = 1
    form.subject = 'GM Mail'
    form.body = ''
    form.realmId = ''
  }
})
</script>

<template>
  <div class="mail-form-section">
    <h3 class="mail-form-section__title">Send Item via Mail</h3>

    <form class="mail-form" @submit.prevent="handleSubmit">
      <div class="form-row">
        <UiFormGroup label="Character Name" html-for="mail-character" required>
          <UiInput
            id="mail-character"
            v-model="form.characterName"
            type="text"
            placeholder="Enter character name"
            required
          />
        </UiFormGroup>

        <UiFormGroup label="Realm" html-for="mail-realm" required>
          <UiSelect
            id="mail-realm"
            v-model="form.realmId"
            :options="realms.map(r => ({ value: r.id, label: r.name }))"
            placeholder="Select realm"
            required
          />
        </UiFormGroup>
      </div>

      <div class="form-row">
        <UiFormGroup label="Item ID" html-for="mail-item-id" required hint="Enter the item entry ID from item_template">
          <UiInput
            id="mail-item-id"
            v-model="form.itemId"
            type="number"
            placeholder="e.g., 25 for Worn Shortsword"
            required
          />
        </UiFormGroup>

        <UiFormGroup label="Item Count" html-for="mail-item-count" required>
          <UiInput
            id="mail-item-count"
            v-model="form.itemCount"
            type="number"
            :min="1"
            :max="1000"
            placeholder="1"
            required
          />
        </UiFormGroup>
      </div>

      <UiFormGroup label="Mail Subject" html-for="mail-subject">
        <UiInput
          id="mail-subject"
          v-model="form.subject"
          type="text"
          placeholder="GM Mail"
        />
      </UiFormGroup>

      <UiFormGroup label="Mail Body" html-for="mail-body">
        <UiTextarea
          id="mail-body"
          v-model="form.body"
          placeholder="Message to player..."
          :rows="4"
          :maxlength="8000"
        />
      </UiFormGroup>

      <div class="mail-form__actions">
        <UiButton type="submit" :loading="loading" :disabled="!isValid">
          📧 Send Item
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

.mail-form-section {
  @include card-base;
  margin-bottom: $spacing-8;

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin: 0 0 $spacing-6;
  }
}

.mail-form {
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
