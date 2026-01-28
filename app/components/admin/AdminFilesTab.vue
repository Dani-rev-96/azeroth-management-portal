<script setup lang="ts">
/**
 * AdminFilesTab - File management tab
 */
import { formatFileSize, formatDate } from '~/utils/format'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiProgressBar from '~/components/ui/UiProgressBar.vue'
import UiMessage from '~/components/ui/UiMessage.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'

export interface FileInfo {
  name: string
  size: number
  modified: string
}

export interface Props {
  files: FileInfo[]
  loading?: boolean
  uploading?: boolean
  uploadProgress?: number
  uploadError?: string
  uploadSuccess?: string
  deletingFile?: string
}

const props = withDefaults(defineProps<Props>(), {
  uploadProgress: 0,
})

const emit = defineEmits<{
  upload: [file: File]
  delete: [filename: string]
}>()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)

function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    selectedFile.value = target.files[0] || null
  }
}

function handleUpload() {
  if (selectedFile.value) {
    emit('upload', selectedFile.value)
  }
}

function handleDelete(filename: string) {
  if (confirm(`Are you sure you want to delete ${filename}?`)) {
    emit('delete', filename)
  }
}

// Clear selection after successful upload
watch(() => props.uploadSuccess, (success) => {
  if (success) {
    selectedFile.value = null
    if (fileInput.value) {
      fileInput.value.value = ''
    }
  }
})
</script>

<template>
  <section class="admin-files-tab">
    <UiSectionHeader
      title="File Management"
      subtitle="Manage public download files"
    />

    <!-- Upload Section -->
    <div class="upload-section">
      <h3 class="upload-section__title">Upload New File</h3>

      <form class="upload-form" @submit.prevent="handleUpload">
        <input
          ref="fileInput"
          type="file"
          class="file-input"
          @change="handleFileSelect"
        />

        <div v-if="selectedFile" class="selected-file">
          <span>📎 {{ selectedFile.name }}</span>
          <span class="selected-file__size">{{ formatFileSize(selectedFile.size) }}</span>
        </div>

        <UiButton
          type="submit"
          :disabled="!selectedFile || uploading"
          :loading="uploading"
        >
          📤 Upload File
        </UiButton>

        <UiProgressBar
          v-if="uploading"
          :value="uploadProgress"
          :max="100"
        />

        <UiMessage v-if="uploadError" variant="error">{{ uploadError }}</UiMessage>
        <UiMessage v-if="uploadSuccess" variant="success">{{ uploadSuccess }}</UiMessage>
      </form>
    </div>

    <!-- Files List Section -->
    <div class="files-section">
      <h3 class="files-section__title">Current Files</h3>

      <UiLoadingState v-if="loading" message="Loading files..." />

      <UiEmptyState
        v-else-if="files.length === 0"
        icon="📁"
        message="No files available"
      />

      <div v-else class="files-table-container">
        <table class="files-table">
          <thead>
            <tr>
              <th>Filename</th>
              <th>Size</th>
              <th>Last Modified</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="file in files" :key="file.name">
              <td>
                <span class="filename">{{ file.name }}</span>
              </td>
              <td>{{ formatFileSize(file.size) }}</td>
              <td>{{ formatDate(file.modified) }}</td>
              <td>
                <div class="file-actions">
                  <a
                    :href="`/api/downloads/${encodeURIComponent(file.name)}`"
                    class="download-link"
                    :download="file.name"
                  >
                    <UiButton size="sm" variant="ghost" as="span">
                      ⬇️ Download
                    </UiButton>
                  </a>
                  <UiButton
                    size="sm"
                    variant="danger"
                    :loading="deletingFile === file.name"
                    @click="handleDelete(file.name)"
                  >
                    🗑️ Delete
                  </UiButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </section>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.upload-section,
.files-section {
  margin-bottom: $spacing-8;

  &__title {
    font-size: $font-size-xl;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin: 0 0 $spacing-4;
  }
}

.upload-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  padding: $spacing-6;
  @include card-base;
}

.file-input {
  @include form-input;

  &::-webkit-file-upload-button {
    padding: $spacing-2 $spacing-4;
    background: rgba($blue-primary, 0.1);
    border: 1px solid $blue-primary;
    border-radius: $radius-md;
    color: $blue-light;
    cursor: pointer;
    margin-right: $spacing-4;
  }
}

.selected-file {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-3;
  background: $bg-primary;
  border: 1px solid $border-primary;
  border-radius: $radius-lg;
  color: $text-primary;

  &__size {
    color: $text-secondary;
    font-size: $font-size-sm;
  }
}

.files-table-container {
  @include table-container;
}

.files-table {
  @include table-base;
}

.filename {
  font-weight: $font-weight-semibold;
  color: $text-primary;
}

.file-actions {
  display: flex;
  gap: $spacing-2;
}

.download-link {
  text-decoration: none;
}
</style>
