<template>
  <div class="downloads-page">
    <header class="page-header">
      <div class="header-content">
        <h1>📦 Downloads</h1>
        <p class="subtitle">Game client and patches</p>
      </div>
    </header>

    <main class="content-section">
      <section class="downloads-list">
        <div v-if="loading" class="loading">
          <p>Loading available downloads...</p>
        </div>

        <div v-else-if="error" class="error-state">
          <p>{{ error }}</p>
        </div>

        <div v-else-if="files.length === 0" class="empty-state">
          <p>No downloads available at this time</p>
        </div>

        <div v-else class="files-grid">
          <article v-for="file in files" :key="file.name" class="file-card">
            <div class="file-icon">
              <span v-if="file.name.endsWith('.7z') || file.name.endsWith('.zip')">📦</span>
              <span v-else-if="file.name.endsWith('.exe')">⚙️</span>
              <span v-else-if="file.name.endsWith('.pdf')">📄</span>
              <span v-else>📁</span>
            </div>
            <div class="file-info">
              <h3>{{ file.name }}</h3>
              <div class="file-meta">
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
                <span class="file-date">{{ formatDate(file.modified) }}</span>
              </div>
              <p v-if="getFileDescription(file.name)" class="file-description">
                {{ getFileDescription(file.name) }}
              </p>
            </div>
            <div class="file-actions">
              <a
                :href="`/api/downloads/${encodeURIComponent(file.name)}`"
                class="download-btn"
                :download="file.name"
              >
                ⬇️ Download
              </a>
            </div>
          </article>
        </div>
      </section>
    </main>
  </div>
</template>

<script setup lang="ts">
interface FileInfo {
  name: string
  size: number
  modified: string
}

const loading = ref(true)
const error = ref('')
const files = ref<FileInfo[]>([])

async function fetchFiles() {
  loading.value = true
  error.value = ''

  try {
    const { data, error: fetchError } = await useFetch<FileInfo[]>('/api/downloads/list')

    if (fetchError.value) {
      error.value = 'Failed to load downloads'
      return
    }

    files.value = data.value || []
  } catch (err) {
    console.error('Failed to fetch files:', err)
    error.value = 'Failed to load downloads'
  } finally {
    loading.value = false
  }
}

function formatFileSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let size = bytes
  let unitIndex = 0

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024
    unitIndex++
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString()
}

function getFileDescription(filename: string): string {
  const descriptions: Record<string, string> = {
    'world-of-warcraft-3.3.5a-hd.7z': 'World of Warcraft 3.3.5a HD Client - Full game installation',
  }
  return descriptions[filename] || ''
}

onMounted(() => {
  fetchFiles()
})
</script>

<style scoped>
.downloads-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  margin-bottom: 2rem;
}

.header-content h1 {
  font-size: 2.5rem;
  margin: 0 0 0.5rem 0;
  background: linear-gradient(to right, #60a5fa, #a78bfa);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.subtitle {
  color: #94a3b8;
  font-size: 1.1rem;
  margin: 0;
}

.content-section {
  margin-top: 2rem;
}

.loading, .error-state, .empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: #94a3b8;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
}

.error-state {
  color: #fca5a5;
}

.files-grid {
  display: grid;
  gap: 1.5rem;
}

.file-card {
  display: flex;
  gap: 1.5rem;
  align-items: center;
  padding: 2rem;
  background: #1e293b;
  border: 1px solid #334155;
  border-radius: 0.75rem;
  transition: all 0.2s;
}

.file-card:hover {
  border-color: #475569;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.file-icon {
  font-size: 3rem;
  flex-shrink: 0;
}

.file-info {
  flex: 1;
}

.file-info h3 {
  color: #e2e8f0;
  font-size: 1.25rem;
  margin: 0 0 0.5rem 0;
  word-break: break-word;
}

.file-meta {
  display: flex;
  gap: 1.5rem;
  margin-bottom: 0.5rem;
}

.file-size, .file-date {
  color: #94a3b8;
  font-size: 0.9rem;
}

.file-size {
  font-weight: 600;
}

.file-description {
  color: #94a3b8;
  font-size: 0.95rem;
  margin: 0.5rem 0 0 0;
  line-height: 1.5;
}

.file-actions {
  flex-shrink: 0;
}

.download-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
  color: white;
  text-decoration: none;
  border-radius: 0.5rem;
  font-weight: 600;
  transition: all 0.2s;
  white-space: nowrap;
}

.download-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

@media (max-width: 768px) {
  .file-card {
    flex-direction: column;
    text-align: center;
  }

  .file-meta {
    justify-content: center;
  }
}
</style>
