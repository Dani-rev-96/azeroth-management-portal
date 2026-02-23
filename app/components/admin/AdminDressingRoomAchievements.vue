<script setup lang="ts">
/**
 * AdminDressingRoomAchievements - Achievement granting sub-component
 * Grant achievements by ID (direct DB only, no Eluna API available)
 */
import UiButton from '~/components/ui/UiButton.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiMessage from '~/components/ui/UiMessage.vue'

const props = defineProps<{
  guid: number
  realmId: string | number
  characterName: string
}>()

const achievementInput = ref('')
const error = ref('')
const success = ref('')
const actionLoading = ref(false)
const requiresRelog = ref(false)

async function grantAchievements() {
  if (!achievementInput.value.trim()) return

  // Parse comma/space separated IDs
  const ids = achievementInput.value
    .split(/[\s,]+/)
    .map((s: string) => parseInt(s.trim()))
    .filter((n: number) => !isNaN(n) && n > 0)

  if (ids.length === 0) {
    error.value = 'No valid achievement IDs entered'
    return
  }

  actionLoading.value = true
  error.value = ''
  success.value = ''
  requiresRelog.value = false

  try {
    const data = await $fetch<{ message: string; requiresRelog?: boolean }>('/api/admin/dressingroom/add-achievement', {
      method: 'POST',
      body: {
        guid: props.guid,
        realmId: props.realmId,
        achievementIds: ids,
      },
    })
    success.value = data.message
    requiresRelog.value = !!data.requiresRelog
    achievementInput.value = ''
  } catch (err: any) {
    error.value = err?.data?.message || err?.statusMessage || 'Failed to grant achievements'
  } finally {
    actionLoading.value = false
  }
}
</script>

<template>
  <div class="achievement-editor">
    <h3 class="editor-card__title">🏆 Achievements</h3>

    <UiMessage v-if="error" variant="error">{{ error }}</UiMessage>
    <UiMessage v-if="success" variant="success">{{ success }}</UiMessage>
    <UiMessage
      v-if="requiresRelog"
      variant="warning"
    >
      Player is online — they need to relog to see granted achievements.
    </UiMessage>

    <p class="form-hint">
      Enter achievement IDs separated by commas or spaces.
      Achievements are written directly to the database (no Eluna API available).
      Online players must relog to see changes.
    </p>

    <div class="achievement-form">
      <UiInput
        v-model="achievementInput"
        type="text"
        placeholder="e.g. 457, 458, 459, 2078"
      />
      <UiButton
        size="sm"
        :loading="actionLoading"
        :disabled="!achievementInput.trim()"
        @click="grantAchievements"
      >
        🏆 Grant Achievements
      </UiButton>
    </div>

    <div class="common-achievements">
      <h4 class="subsection-title">Common Achievement IDs</h4>
      <div class="achievement-hints">
        <span class="achievement-hint" title="Level 80">457 · Level 80</span>
        <span class="achievement-hint" title="Got My Mind On My Money (100g looted)">1176 · 100g Looted</span>
        <span class="achievement-hint" title="Explore Northrend">45 · Explore Northrend</span>
        <span class="achievement-hint" title="Loremaster of Northrend">41 · Loremaster Northrend</span>
        <span class="achievement-hint" title="The Fall of Naxxramas">576 · Naxxramas</span>
        <span class="achievement-hint" title="Champion of the Frozen Wastes">1658 · Champion FW</span>
        <span class="achievement-hint" title="The Undying">2187 · The Undying</span>
        <span class="achievement-hint" title="Herald of the Titans">3316 · Herald of Titans</span>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.achievement-editor {
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

.achievement-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.common-achievements {
  margin-top: $spacing-2;
  padding-top: $spacing-3;
  border-top: 1px solid $border-primary;
}

.subsection-title {
  font-size: $font-size-sm;
  font-weight: $font-weight-semibold;
  color: $text-secondary;
  margin: 0 0 $spacing-2;
}

.achievement-hints {
  display: flex;
  flex-wrap: wrap;
  gap: $spacing-2;
}

.achievement-hint {
  font-size: $font-size-xs;
  color: $text-muted;
  padding: $spacing-1 $spacing-2;
  background: $bg-primary;
  border-radius: $radius-sm;
  font-family: monospace;
  white-space: nowrap;
}
</style>
