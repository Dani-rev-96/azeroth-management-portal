<template>
  <div v-if="show" class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <h3>{{ title }}</h3>
      <p class="modal-description">{{ description }}</p>

      <div v-if="action === 'rename'" class="form-group">
        <label>New Character Name</label>
        <input
          v-model="newName"
          type="text"
          placeholder="Enter new name"
          maxlength="12"
        />
      </div>

      <div v-if="error" class="error-message">
        {{ error }}
      </div>
      <div v-if="success" class="success-message">
        {{ success }}
      </div>

      <div class="modal-actions">
        <button @click="$emit('close')" class="cancel-button">Cancel</button>
        <button
          @click="handleConfirm"
          :disabled="loading"
          class="confirm-button"
        >
          {{ loading ? 'Processing...' : 'Confirm' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { WoWCharacter, RealmId } from '~/types'

const props = defineProps<{
  show: boolean
  character: WoWCharacter | null
  action: 'rename' | 'undelete'
  realmId: RealmId | undefined
}>()

const emit = defineEmits<{
  close: []
  success: []
}>()

const loading = ref(false)
const error = ref('')
const success = ref('')
const newName = ref('')

const title = computed(() => {
  if (props.action === 'rename') {
    return `Rename ${props.character?.name}`
  } else {
    return `Undelete ${props.character?.name}`
  }
})

const description = computed(() => {
  if (props.action === 'rename') {
    return 'Choose a new name for your character. This action may require GM approval.'
  } else {
    return 'Restore this deleted character. This action may require GM approval.'
  }
})

// Reset form when modal closes
watch(() => props.show, (isShowing) => {
  if (!isShowing) {
    newName.value = ''
    error.value = ''
    success.value = ''
  }
})

const handleConfirm = async () => {
  if (!props.character) return

  if (props.action === 'rename' && !newName.value) {
    error.value = 'Please enter a new character name'
    return
  }

  loading.value = true
  error.value = ''
  success.value = ''

  try {
    await $fetch('/api/characters/action', {
      method: 'POST',
      body: {
        characterId: props.character.guid,
        action: props.action,
        realmId: props.realmId,
        newName: props.action === 'rename' ? newName.value : undefined
      }
    })

    success.value = `${props.action === 'rename' ? 'Rename' : 'Undelete'} request submitted successfully!`

    setTimeout(() => {
      emit('success')
      emit('close')
    }, 2000)
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Action failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1e293b;
  border: 1px solid #334155;
  padding: 2rem;
  border-radius: 1rem;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;

  h3 {
    margin: 0 0 0.5rem 0;
    font-size: 1.5rem;
    color: #e2e8f0;
  }

  .modal-description {
    margin-bottom: 1.5rem;
    color: #94a3b8;
    font-size: 0.95rem;
  }

  .form-group {
    margin-bottom: 1rem;

    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #e2e8f0;
    }

    input {
      width: 100%;
      padding: 0.75rem 1rem;
      background: #0f172a;
      border: 1px solid #334155;
      border-radius: 0.5rem;
      color: #e2e8f0;
      font-size: 1rem;
      transition: border-color 0.2s;

      &:focus {
        outline: none;
        border-color: #60a5fa;
      }

      &::placeholder {
        color: #64748b;
      }
    }
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;

    button {
      flex: 1;
      padding: 1rem 2rem;
      border: none;
      border-radius: 0.5rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .cancel-button {
      background: rgba(148, 163, 184, 0.1);
      color: #94a3b8;
      border: 1px solid #334155;

      &:hover {
        background: rgba(148, 163, 184, 0.2);
        border-color: #475569;
      }
    }

    .confirm-button {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      color: white;

      &:hover:not(:disabled) {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }
  }
}
</style>
