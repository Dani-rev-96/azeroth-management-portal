<script setup lang="ts">
/**
 * AdminDressingRoomSkills - Weapon & general skill editor sub-component
 * Set weapon skills (swords, daggers, etc.), defense, and other general skills
 * Max skill = 5 * character level (400 at level 80)
 */
import UiButton from '~/components/ui/UiButton.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiMessage from '~/components/ui/UiMessage.vue'

const props = defineProps<{
  guid: number
  realmId: string | number
  characterName: string
  characterLevel: number
}>()

const WEAPON_SKILLS = [
  { value: 43, label: 'Swords' },
  { value: 44, label: 'Axes' },
  { value: 45, label: 'Bows' },
  { value: 46, label: 'Guns' },
  { value: 54, label: 'Maces' },
  { value: 55, label: 'Two-Handed Swords' },
  { value: 136, label: 'Staves' },
  { value: 160, label: 'Two-Handed Maces' },
  { value: 162, label: 'Unarmed' },
  { value: 172, label: 'Two-Handed Axes' },
  { value: 173, label: 'Daggers' },
  { value: 176, label: 'Thrown' },
  { value: 226, label: 'Crossbows' },
  { value: 228, label: 'Wands' },
  { value: 229, label: 'Polearms' },
  { value: 473, label: 'Fist Weapons' },
  { value: 95, label: 'Defense' },
]

const maxSkill = computed(() => (props.characterLevel || 80) * 5)

const selectedSkill = ref<number | null>(null)
const skillValue = ref<number | null>(null)
const error = ref('')
const success = ref('')
const actionLoading = ref(false)
const bulkLoading = ref(false)

async function setSkill() {
  if (!selectedSkill.value || skillValue.value === null || skillValue.value === undefined) return

  actionLoading.value = true
  error.value = ''
  success.value = ''

  try {
    const data = await $fetch<{ message: string }>('/api/admin/dressingroom/set-skill', {
      method: 'POST',
      body: {
        guid: props.guid,
        realmId: props.realmId,
        skillId: selectedSkill.value,
        value: skillValue.value,
      },
    })
    success.value = data.message
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || 'Failed to set skill'
  } finally {
    actionLoading.value = false
  }
}

async function maxAllWeaponSkills() {
  bulkLoading.value = true
  error.value = ''
  success.value = ''
  let count = 0

  try {
    for (const skill of WEAPON_SKILLS) {
      await $fetch('/api/admin/dressingroom/set-skill', {
        method: 'POST',
        body: {
          guid: props.guid,
          realmId: props.realmId,
          skillId: skill.value,
          value: maxSkill.value,
        },
      })
      count++
    }
    success.value = `Set ${count} skill(s) to ${maxSkill.value} for ${props.characterName}`
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || `Failed after ${count} skills`
  } finally {
    bulkLoading.value = false
  }
}

function setMaxValue() {
  skillValue.value = maxSkill.value
}
</script>

<template>
  <div class="skill-editor">
    <h3 class="editor-card__title">⚔️ Skills</h3>

    <UiMessage v-if="error" variant="error">{{ error }}</UiMessage>
    <UiMessage v-if="success" variant="success">{{ success }}</UiMessage>

    <p class="form-hint">
      Set weapon skills, defense, and other general skills.
      Max skill = 5 × character level = {{ maxSkill }}.
    </p>

    <!-- Bulk action -->
    <div class="skill-bulk">
      <UiButton
        size="sm"
        :loading="bulkLoading"
        @click="maxAllWeaponSkills"
      >
        Max All Skills ({{ maxSkill }})
      </UiButton>
    </div>

    <!-- Individual skill setter -->
    <div class="skill-form">
      <UiSelect
        :model-value="selectedSkill"
        :options="WEAPON_SKILLS"
        placeholder="Select skill..."
        @update:model-value="selectedSkill = $event as number"
      />
      <div class="skill-form__row">
        <UiInput
          v-model="skillValue"
          type="number"
          :min="0"
          :max="maxSkill"
          placeholder="Value"
        />
        <UiButton size="sm" variant="secondary" @click="setMaxValue">
          Max
        </UiButton>
        <UiButton
          size="sm"
          :loading="actionLoading"
          :disabled="!selectedSkill || skillValue === null || skillValue === undefined"
          @click="setSkill"
        >
          Set
        </UiButton>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.skill-editor {
  @include card-base;
  display: flex;
  flex-direction: column;
  gap: $spacing-3;
}

.form-hint {
  font-size: $font-size-xs;
  color: $text-muted;
  margin: 0;
}

.skill-bulk {
  display: flex;
  gap: $spacing-2;
  align-items: center;
}

.skill-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;

  &__row {
    display: flex;
    gap: $spacing-2;
    align-items: flex-start;
  }
}
</style>
