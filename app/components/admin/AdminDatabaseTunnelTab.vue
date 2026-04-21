<script setup lang="ts">
/**
 * AdminDatabaseTunnelTab
 *
 * Grantees of the `admin.db-tunnel` feature pick a target database and click
 * "Create Tunnel". The backend returns static SSH + DB credentials that the
 * user pastes into DBeaver (or any tool that supports SSH tunnels).
 *
 * v1: credentials are shared across all grantees. The API shape is already
 * per-request so v2 can swap in per-user ephemeral keys without UI changes.
 */
import UiButton from '~/components/ui/UiButton.vue'
import UiMessage from '~/components/ui/UiMessage.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'

interface TargetMeta {
  id: string
  label: string
  type: 'postgres' | 'mysql'
  database: string
}

interface TargetsResponse {
  enabled: boolean
  targets: TargetMeta[]
}

interface ConnectionResponse {
  ssh: {
    host: string
    port: number
    username: string
    privateKey: string
    hostFingerprint?: string
  }
  target: {
    id: string
    label: string
    type: 'postgres' | 'mysql'
    host: string
    port: number
    database: string
    username: string
    password: string
  }
}

const enabled = ref(true)
const loadingTargets = ref(false)
const targets = ref<TargetMeta[]>([])
const selectedTargetId = ref<string>('')

const creating = ref(false)
const error = ref('')
const connection = ref<ConnectionResponse | null>(null)

const targetOptions = computed(() =>
  targets.value.map(t => ({ value: t.id, label: t.label }))
)

onMounted(async () => {
  await loadTargets()
})

async function loadTargets() {
  loadingTargets.value = true
  error.value = ''
  try {
    const data = await $fetch<TargetsResponse>('/api/admin/db-tunnel/targets')
    targets.value = data.targets
    enabled.value = data.enabled
    if (data.targets.length > 0 && !selectedTargetId.value) {
      selectedTargetId.value = data.targets[0]!.id
    }
  } catch (e: unknown) {
    console.error('Failed to load DB tunnel targets', e)
    error.value = 'Failed to load tunnel targets.'
  } finally {
    loadingTargets.value = false
  }
}

async function createTunnel() {
  if (!selectedTargetId.value) return
  creating.value = true
  error.value = ''
  connection.value = null
  try {
    connection.value = await $fetch<ConnectionResponse>('/api/admin/db-tunnel/connection', {
      method: 'POST',
      body: { targetId: selectedTargetId.value },
    })
  } catch (e: unknown) {
    const msg = (e as { statusMessage?: string; message?: string })?.statusMessage
      || (e as { message?: string })?.message
      || 'Failed to create tunnel'
    error.value = msg
  } finally {
    creating.value = false
  }
}

function clearConnection() {
  connection.value = null
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text)
  } catch (e) {
    console.error('Clipboard write failed', e)
  }
}

function downloadKey() {
  if (!connection.value) return
  const blob = new Blob([connection.value.ssh.privateKey], { type: 'application/x-pem-file' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'db-tunnel.pem'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="db-tunnel-tab">
    <UiSectionHeader
      title="Database Tunnel"
      subtitle="Create an SSH tunnel to connect a local DB client (e.g. DBeaver) to an in-cluster database."
    />

    <UiMessage variant="warning">
      <strong>Security:</strong> The connection info you receive here is sensitive.
      Treat the private key and DB password like any other credential — do not share them,
      do not commit them to version control, and close the tunnel in your client when you are
      done. Access is audited server-side.
    </UiMessage>

    <UiLoadingState v-if="loadingTargets" message="Loading targets..." />

    <UiEmptyState
      v-else-if="!enabled"
      icon="🔌"
      title="Tunnel not configured"
      message="The DB tunnel is not configured on this server. Ask an operator to set NUXT_DB_TUNNEL_SSH_* environment variables."
    />

    <UiEmptyState
      v-else-if="targets.length === 0"
      icon="🗄️"
      title="No targets available"
      message="No database targets are configured for the tunnel."
    />

    <template v-else>
      <div class="tunnel-form">
        <div class="form-field">
          <label class="form-label" for="tunnel-target">Target database</label>
          <UiSelect
            id="tunnel-target"
            v-model="selectedTargetId"
            :options="targetOptions"
            placeholder="Select a database"
          />
        </div>

        <div class="tunnel-actions">
          <UiButton
            :loading="creating"
            :disabled="!selectedTargetId"
            @click="createTunnel"
          >
            🔌 Create Tunnel
          </UiButton>
          <UiButton
            v-if="connection"
            variant="ghost"
            @click="clearConnection"
          >
            Clear
          </UiButton>
        </div>

        <UiMessage v-if="error" variant="error" dismissible @dismiss="error = ''">
          {{ error }}
        </UiMessage>
      </div>

      <div v-if="connection" class="tunnel-result">
        <UiSectionHeader title="SSH Tunnel" subtitle="Paste these values into DBeaver's 'SSH' tab." />
        <div class="field-grid">
          <div class="field-row">
            <span class="field-label">Host</span>
            <code class="field-value">{{ connection.ssh.host }}</code>
            <UiButton size="sm" variant="ghost" @click="copyText(connection.ssh.host)">Copy</UiButton>
          </div>
          <div class="field-row">
            <span class="field-label">Port</span>
            <code class="field-value">{{ connection.ssh.port }}</code>
            <UiButton size="sm" variant="ghost" @click="copyText(String(connection.ssh.port))">Copy</UiButton>
          </div>
          <div class="field-row">
            <span class="field-label">User</span>
            <code class="field-value">{{ connection.ssh.username }}</code>
            <UiButton size="sm" variant="ghost" @click="copyText(connection.ssh.username)">Copy</UiButton>
          </div>
          <div class="field-row">
            <span class="field-label">Auth method</span>
            <code class="field-value">Public key (no password)</code>
          </div>
          <div class="field-row">
            <span class="field-label">Private key</span>
            <span class="field-value field-value--muted">Download and point DBeaver at the .pem file.</span>
            <UiButton size="sm" variant="secondary" @click="downloadKey">⬇ Download .pem</UiButton>
          </div>
          <div v-if="connection.ssh.hostFingerprint" class="field-row">
            <span class="field-label">Host fingerprint</span>
            <code class="field-value">{{ connection.ssh.hostFingerprint }}</code>
          </div>
        </div>

        <UiSectionHeader
          title="Database"
          subtitle="Paste these values into DBeaver's main connection tab. The host/port are resolved on the bastion side."
        />
        <div class="field-grid">
          <div class="field-row">
            <span class="field-label">Driver</span>
            <code class="field-value">{{ connection.target.type === 'postgres' ? 'PostgreSQL' : 'MySQL' }}</code>
          </div>
          <div class="field-row">
            <span class="field-label">Host</span>
            <code class="field-value">{{ connection.target.host }}</code>
            <UiButton size="sm" variant="ghost" @click="copyText(connection.target.host)">Copy</UiButton>
          </div>
          <div class="field-row">
            <span class="field-label">Port</span>
            <code class="field-value">{{ connection.target.port }}</code>
            <UiButton size="sm" variant="ghost" @click="copyText(String(connection.target.port))">Copy</UiButton>
          </div>
          <div class="field-row">
            <span class="field-label">Database</span>
            <code class="field-value">{{ connection.target.database }}</code>
            <UiButton size="sm" variant="ghost" @click="copyText(connection.target.database)">Copy</UiButton>
          </div>
          <div class="field-row">
            <span class="field-label">User</span>
            <code class="field-value">{{ connection.target.username }}</code>
            <UiButton size="sm" variant="ghost" @click="copyText(connection.target.username)">Copy</UiButton>
          </div>
          <div class="field-row">
            <span class="field-label">Password</span>
            <code class="field-value field-value--secret">••••••••</code>
            <UiButton size="sm" variant="ghost" @click="copyText(connection.target.password)">Copy</UiButton>
          </div>
        </div>

        <details class="instructions">
          <summary>DBeaver quick-start</summary>
          <ol>
            <li>New connection → pick <strong>{{ connection.target.type === 'postgres' ? 'PostgreSQL' : 'MySQL' }}</strong>.</li>
            <li>On the <strong>Main</strong> tab, enter the values from the "Database" section above.
              Host stays as shown ({{ connection.target.host }}) — DBeaver will resolve it on the bastion.</li>
            <li>Switch to the <strong>SSH</strong> tab, tick "Use SSH tunnel", choose <em>Public Key</em>
              authentication, and enter the SSH host/port/user. Select the downloaded <code>db-tunnel.pem</code>
              file as the private key.</li>
            <li v-if="connection.target.type === 'mysql'">
              On the <strong>Driver properties</strong> tab set <code>useSSL=false</code> and
              <code>allowPublicKeyRetrieval=true</code> — the in-cluster MySQL uses a self-signed
              certificate that DBeaver's default SSL settings will reject (symptom:
              <em>"Communications link failure, 0 bytes"</em>).
            </li>
            <li>Click <strong>Test Connection</strong> then <strong>Finish</strong>.</li>
          </ol>
        </details>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.db-tunnel-tab {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.tunnel-form {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
  max-width: 48rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
}

.form-label {
  font-weight: $font-weight-semibold;
  font-size: $font-size-sm;
  color: $text-secondary;
}

.tunnel-actions {
  display: flex;
  gap: $spacing-3;
}

.tunnel-result {
  display: flex;
  flex-direction: column;
  gap: $spacing-6;
}

.field-grid {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  max-width: 48rem;
}

.field-row {
  display: grid;
  grid-template-columns: 10rem 1fr auto;
  align-items: center;
  gap: $spacing-3;
  padding: $spacing-2 $spacing-3;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.03);
}

.field-label {
  font-weight: $font-weight-semibold;
  color: $text-secondary;
  font-size: $font-size-sm;
}

.field-value {
  font-family: $font-family-mono;
  font-size: $font-size-sm;
  color: $text-primary;
  word-break: break-all;

  &--muted {
    color: $text-secondary;
    font-family: inherit;
  }

  &--secret {
    letter-spacing: 0.2em;
  }
}

.instructions {
  max-width: 48rem;
  padding: $spacing-3 $spacing-4;
  border-radius: $radius-md;
  background: rgba(255, 255, 255, 0.03);

  summary {
    cursor: pointer;
    font-weight: $font-weight-semibold;
  }

  ol {
    margin: $spacing-3 0 0;
    padding-left: $spacing-5;
    line-height: 1.6;
  }
}
</style>
