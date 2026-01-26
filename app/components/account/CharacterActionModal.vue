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
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  max-width: 500px;
  width: 90%;
  max-height: 90vh;
  overflow-y: auto;

  h3 {
    margin: 0 0 1rem 0;
    font-size: 1.5rem;
  }

  .modal-description {
    margin-bottom: 1.5rem;
    color: #666;
  }

  .form-group {
    margin-bottom: 1rem;

    label {
      display: block;
      margin-bottom: 0.5rem;
      font-weight: 600;
      color: #333;
    }

    input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 1rem;

      &:focus {
        outline: none;
        border-color: #2196f3;
      }
    }
  }

  .modal-actions {
    display: flex;
    gap: 1rem;
    margin-top: 1.5rem;

    button {
      flex: 1;
      padding: 0.75rem;
      border: none;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
    }

    .cancel-button {
      background: #e0e0e0;
      color: #333;

      &:hover {
        background: #d0d0d0;
      }
    }

    .confirm-button {
      background: #2196f3;
      color: white;

      &:hover:not(:disabled) {
        background: #1976d2;
      }

      &:disabled {
        background: #ccc;
        cursor: not-allowed;
      }
    }
  }
}

.error-message,
.success-message {
  padding: 0.75rem;
  border-radius: 4px;
  margin-bottom: 1rem;
}

.error-message {
  background: #ffebee;
  border: 1px solid #ffcdd2;
  color: #c62828;
}

.success-message {
  background: #e8f5e9;
  border: 1px solid #c8e6c9;
  color: #2e7d32;
}
</style>
