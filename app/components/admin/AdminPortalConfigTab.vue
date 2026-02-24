<script setup lang="ts">
/**
 * AdminPortalConfigTab — Self-managed portal configuration editor
 *
 * Sections:
 *   1. Config Backend Status + Sync from Hardcoded Defaults
 *   2. Portal Settings (shop, Eluna, perk debuffs)
 *   3. Perk Groups (CRUD)
 *   4. Perks (CRUD, filterable by group)
 *   5. Shop Categories (CRUD)
 */
import UiSectionHeader from '~/components/ui/UiSectionHeader.vue'
import UiButton from '~/components/ui/UiButton.vue'
import UiMessage from '~/components/ui/UiMessage.vue'
import UiInput from '~/components/ui/UiInput.vue'
import UiSelect from '~/components/ui/UiSelect.vue'
import UiLoadingState from '~/components/ui/UiLoadingState.vue'
import UiEmptyState from '~/components/ui/UiEmptyState.vue'
import UiBadge from '~/components/ui/UiBadge.vue'
import { ref, computed, onMounted, watch } from 'vue'

// ─── Types ────────────────────────────────────────────────

interface BackendStatus {
  backend: string
  selfManaged: boolean
  directusEnabled: boolean
  dbStatus: {
    initialized: boolean
    settingsConfigured: boolean
    perkGroupCount: number
    perkCount: number
    shopCategoryCount: number
  } | null
}

interface PortalSettings {
  id: number
  shop_enabled: number
  shop_delivery_method: string
  shop_markup_percent: number
  shop_mail_subject: string
  shop_mail_body: string
  eluna_enabled: number
  eluna_shop_enabled: number
  eluna_gm_mail_enabled: number
  perk_fail_debuff_spell_id: number
  perk_fail_debuff_duration_ms: number
  perk_critfail_debuff_spell_id: number
  perk_critfail_debuff_duration_ms: number
  modified_by_user: number
  updated_at: string | null
}

interface PerkGroup {
  id: string
  label: string
  icon: string
  description: string
  enabled: number
  sort: number
  modified_by_user: number
  updated_at: string | null
}

interface Perk {
  id: string
  group_id: string
  name: string
  icon: string
  description: string
  success_message: string
  delivery_type: string
  game_id: number
  aura_duration_ms: number | null
  required_level: number
  requires_online: number
  one_time: number
  dice_sides: number
  roll_threshold: number
  daily_limit: number
  accent: string
  env_prefix: string
  rank_group: string | null
  mail_subject: string | null
  mail_body: string | null
  item_count: number | null
  fail_debuff_spell_id: number | null
  fail_debuff_duration_ms: number | null
  critfail_debuff_spell_id: number | null
  critfail_debuff_duration_ms: number | null
  teleport_map_id: number | null
  teleport_x: string | number | null
  teleport_y: string | number | null
  teleport_z: string | number | null
  teleport_o: string | number | null
  sort: number
  modified_by_user: number
  updated_at: string | null
}

interface ShopCategory {
  id: number
  slug: string
  sort: number
  modified_by_user: number
  updated_at: string | null
}

interface SyncReport {
  collection: string
  added: number
  updated: number
  skipped: number
  details: Array<{ id: string; action: string; reason?: string }>
}

// ─── State ────────────────────────────────────────────────

// General
const loading = ref(true)
const error = ref('')
const success = ref('')
const activeSection = ref<'overview' | 'settings' | 'perk-groups' | 'perks' | 'shop-categories'>('overview')

// Backend status
const backendStatus = ref<BackendStatus | null>(null)

// Sync
const syncing = ref(false)
const syncReports = ref<SyncReport[]>([])

// Settings
const settings = ref<PortalSettings | null>(null)
const savingSettings = ref(false)
const settingsForm = ref({
  shop_enabled: true,
  shop_delivery_method: 'mail',
  shop_markup_percent: 20,
  shop_mail_subject: 'Your Shop Purchase',
  shop_mail_body: 'Thank you for your purchase! Your items are attached.',
  eluna_enabled: true,
  eluna_shop_enabled: true,
  eluna_gm_mail_enabled: true,
  perk_fail_debuff_spell_id: 11196,
  perk_fail_debuff_duration_ms: 600000,
  perk_critfail_debuff_spell_id: 15007,
  perk_critfail_debuff_duration_ms: 600000,
})

// Perk Groups
const perkGroups = ref<PerkGroup[]>([])
const editingGroup = ref<PerkGroup | null>(null)
const showGroupForm = ref(false)
const savingGroup = ref(false)
const groupForm = ref({ id: '', label: '', icon: '📦', description: '', enabled: true, sort: 0 })
const deletingGroup = ref<string | null>(null)

// Perks
const perks = ref<Perk[]>([])
const perkFilterGroup = ref('')
const editingPerk = ref<Perk | null>(null)
const showPerkForm = ref(false)
const savingPerk = ref(false)
const deletingPerk = ref<string | null>(null)
const perkSearch = ref('')
const perkForm = ref(getEmptyPerkForm())

function getEmptyPerkForm() {
  return {
    id: '', group_id: '', name: '', icon: '📦', description: '', success_message: '',
    delivery_type: 'spell', game_id: 0, aura_duration_ms: null as number | null,
    required_level: 0, requires_online: false, one_time: false,
    dice_sides: 20, roll_threshold: 8, daily_limit: 5, accent: 'blue',
    env_prefix: '', rank_group: '' as string, mail_subject: '' as string, mail_body: '' as string,
    item_count: null as number | null,
    fail_debuff_spell_id: null as number | null, fail_debuff_duration_ms: null as number | null,
    critfail_debuff_spell_id: null as number | null, critfail_debuff_duration_ms: null as number | null,
    teleport_map_id: null as number | null, teleport_x: null as string | number | null,
    teleport_y: null as string | number | null, teleport_z: null as string | number | null, teleport_o: null as string | number | null,
    sort: 0,
  }
}

// Shop Categories
const shopCategories = ref<ShopCategory[]>([])
const showCategoryForm = ref(false)
const savingCategory = ref(false)
const deletingCategory = ref<string | null>(null)
const categoryForm = ref({ slug: '', sort: 0 })

// ─── Computed ─────────────────────────────────────────────

const filteredPerks = computed(() => {
  let result = perks.value
  if (perkFilterGroup.value) {
    result = result.filter(p => p.group_id === perkFilterGroup.value)
  }
  if (perkSearch.value) {
    const q = perkSearch.value.toLowerCase()
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      p.id.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q)
    )
  }
  return result
})

const groupOptions = computed(() =>
  perkGroups.value.map(g => ({ value: g.id, label: `${g.icon} ${g.label}` }))
)

const sections = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'settings', label: 'Portal Settings', icon: '⚙️' },
  { id: 'perk-groups', label: 'Perk Groups', icon: '📂' },
  { id: 'perks', label: 'Perks', icon: '🎲' },
  { id: 'shop-categories', label: 'Shop Categories', icon: '🛒' },
]

// ─── Data Loading ─────────────────────────────────────────

async function loadBackendStatus() {
  try {
    backendStatus.value = await $fetch<BackendStatus>('/api/admin/portal-config/backend')
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Failed to load backend status'
  }
}

async function loadSettings() {
  try {
    const data = await $fetch<{ settings: PortalSettings | null }>('/api/admin/portal-config/settings')
    settings.value = data.settings
    if (data.settings) {
      settingsForm.value = {
        shop_enabled: data.settings.shop_enabled === 1,
        shop_delivery_method: data.settings.shop_delivery_method,
        shop_markup_percent: data.settings.shop_markup_percent,
        shop_mail_subject: data.settings.shop_mail_subject,
        shop_mail_body: data.settings.shop_mail_body,
        eluna_enabled: data.settings.eluna_enabled === 1,
        eluna_shop_enabled: data.settings.eluna_shop_enabled === 1,
        eluna_gm_mail_enabled: data.settings.eluna_gm_mail_enabled === 1,
        perk_fail_debuff_spell_id: data.settings.perk_fail_debuff_spell_id,
        perk_fail_debuff_duration_ms: data.settings.perk_fail_debuff_duration_ms,
        perk_critfail_debuff_spell_id: data.settings.perk_critfail_debuff_spell_id,
        perk_critfail_debuff_duration_ms: data.settings.perk_critfail_debuff_duration_ms,
      }
    }
  } catch (err: any) {
    console.error('Failed to load settings:', err)
  }
}

async function loadPerkGroups() {
  try {
    const data = await $fetch<{ groups: PerkGroup[] }>('/api/admin/portal-config/perk-groups')
    perkGroups.value = data.groups
  } catch (err: any) {
    console.error('Failed to load perk groups:', err)
  }
}

async function loadPerks() {
  try {
    const data = await $fetch<{ perks: Perk[] }>('/api/admin/portal-config/perks')
    perks.value = data.perks
  } catch (err: any) {
    console.error('Failed to load perks:', err)
  }
}

async function loadShopCategories() {
  try {
    const data = await $fetch<{ categories: ShopCategory[] }>('/api/admin/portal-config/shop-categories')
    shopCategories.value = data.categories
  } catch (err: any) {
    console.error('Failed to load shop categories:', err)
  }
}

async function loadAll() {
  loading.value = true
  await Promise.all([loadBackendStatus(), loadSettings(), loadPerkGroups(), loadPerks(), loadShopCategories()])
  loading.value = false
}

// ─── Sync ─────────────────────────────────────────────────

async function handleSync() {
  if (!confirm('Sync from hardcoded defaults?\n\nThis will:\n• Add new items from the latest app version\n• Update unmodified items to match latest defaults\n• Skip any items you have customized\n\nYour customizations are safe.')) return

  syncing.value = true
  error.value = ''
  success.value = ''
  syncReports.value = []

  try {
    const data = await $fetch<{ message: string; reports: SyncReport[] }>('/api/admin/portal-config/sync', { method: 'POST' })
    success.value = data.message
    syncReports.value = data.reports
    await loadAll()
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Sync failed'
  } finally {
    syncing.value = false
  }
}

// ─── Settings Actions ─────────────────────────────────────

async function saveSettings() {
  savingSettings.value = true
  error.value = ''
  success.value = ''

  try {
    await $fetch('/api/admin/portal-config/settings', {
      method: 'POST',
      body: settingsForm.value,
    })
    success.value = 'Portal settings saved'
    await loadSettings()
    await loadBackendStatus()
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Failed to save settings'
  } finally {
    savingSettings.value = false
  }
}

// ─── Perk Group Actions ──────────────────────────────────

function openGroupForm(group?: PerkGroup) {
  editingGroup.value = group || null
  groupForm.value = group
    ? { id: group.id, label: group.label, icon: group.icon, description: group.description, enabled: group.enabled === 1, sort: group.sort }
    : { id: '', label: '', icon: '📦', description: '', enabled: true, sort: perkGroups.value.length + 1 }
  showGroupForm.value = true
}

function closeGroupForm() {
  showGroupForm.value = false
  editingGroup.value = null
}

async function saveGroup() {
  if (!groupForm.value.id.trim() || !groupForm.value.label.trim()) {
    error.value = 'Group ID and label are required'
    return
  }
  savingGroup.value = true
  error.value = ''

  try {
    await $fetch('/api/admin/portal-config/perk-groups', {
      method: 'POST',
      body: groupForm.value,
    })
    success.value = `Perk group "${groupForm.value.label}" saved`
    closeGroupForm()
    await loadPerkGroups()
    await loadBackendStatus()
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Failed to save perk group'
  } finally {
    savingGroup.value = false
  }
}

async function deleteGroup(group: PerkGroup) {
  if (!confirm(`Delete perk group "${group.label}"? This cannot be undone.`)) return
  deletingGroup.value = group.id
  error.value = ''

  try {
    await $fetch(`/api/admin/portal-config/perk-groups/${encodeURIComponent(group.id)}`, { method: 'DELETE' })
    success.value = `Perk group "${group.label}" deleted`
    await loadPerkGroups()
    await loadBackendStatus()
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Failed to delete perk group'
  } finally {
    deletingGroup.value = null
  }
}

// ─── Perk Actions ─────────────────────────────────────────

function openPerkForm(perk?: Perk) {
  editingPerk.value = perk || null
  if (perk) {
    perkForm.value = {
      id: perk.id, group_id: perk.group_id, name: perk.name, icon: perk.icon,
      description: perk.description, success_message: perk.success_message,
      delivery_type: perk.delivery_type, game_id: perk.game_id,
      aura_duration_ms: perk.aura_duration_ms, required_level: perk.required_level,
      requires_online: perk.requires_online === 1, one_time: perk.one_time === 1,
      dice_sides: perk.dice_sides, roll_threshold: perk.roll_threshold, daily_limit: perk.daily_limit,
      accent: perk.accent, env_prefix: perk.env_prefix,
      rank_group: perk.rank_group || '', mail_subject: perk.mail_subject || '', mail_body: perk.mail_body || '',
      item_count: perk.item_count, fail_debuff_spell_id: perk.fail_debuff_spell_id,
      fail_debuff_duration_ms: perk.fail_debuff_duration_ms,
      critfail_debuff_spell_id: perk.critfail_debuff_spell_id,
      critfail_debuff_duration_ms: perk.critfail_debuff_duration_ms,
      teleport_map_id: perk.teleport_map_id, teleport_x: perk.teleport_x,
      teleport_y: perk.teleport_y, teleport_z: perk.teleport_z, teleport_o: perk.teleport_o,
      sort: perk.sort,
    }
  } else {
    perkForm.value = {
      ...getEmptyPerkForm(),
      group_id: perkFilterGroup.value || (perkGroups.value[0]?.id ?? ''),
      sort: perks.value.length + 1,
    }
  }
  showPerkForm.value = true
}

function closePerkForm() {
  showPerkForm.value = false
  editingPerk.value = null
}

async function savePerk() {
  if (!perkForm.value.id.trim() || !perkForm.value.name.trim()) {
    error.value = 'Perk ID and name are required'
    return
  }
  savingPerk.value = true
  error.value = ''

  try {
    const body = {
      ...perkForm.value,
      rank_group: perkForm.value.rank_group || null,
      mail_subject: perkForm.value.mail_subject || null,
      mail_body: perkForm.value.mail_body || null,
    }
    await $fetch('/api/admin/portal-config/perks', { method: 'POST', body })
    success.value = `Perk "${perkForm.value.name}" saved`
    closePerkForm()
    await loadPerks()
    await loadBackendStatus()
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Failed to save perk'
  } finally {
    savingPerk.value = false
  }
}

async function deletePerk(perk: Perk) {
  if (!confirm(`Delete perk "${perk.name}"? This cannot be undone.`)) return
  deletingPerk.value = perk.id
  error.value = ''

  try {
    await $fetch(`/api/admin/portal-config/perks/${encodeURIComponent(perk.id)}`, { method: 'DELETE' })
    success.value = `Perk "${perk.name}" deleted`
    await loadPerks()
    await loadBackendStatus()
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Failed to delete perk'
  } finally {
    deletingPerk.value = null
  }
}

// ─── Shop Category Actions ────────────────────────────────

function openCategoryForm(cat?: ShopCategory) {
  categoryForm.value = cat
    ? { slug: cat.slug, sort: cat.sort }
    : { slug: '', sort: shopCategories.value.length + 1 }
  showCategoryForm.value = true
}

function closeCategoryForm() {
  showCategoryForm.value = false
}

async function saveCategory() {
  if (!categoryForm.value.slug.trim()) {
    error.value = 'Category slug is required'
    return
  }
  savingCategory.value = true
  error.value = ''

  try {
    await $fetch('/api/admin/portal-config/shop-categories', {
      method: 'POST',
      body: categoryForm.value,
    })
    success.value = `Shop category "${categoryForm.value.slug}" saved`
    closeCategoryForm()
    await loadShopCategories()
    await loadBackendStatus()
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Failed to save shop category'
  } finally {
    savingCategory.value = false
  }
}

async function deleteCategory(cat: ShopCategory) {
  if (!confirm(`Delete shop category "${cat.slug}"?`)) return
  deletingCategory.value = cat.slug
  error.value = ''

  try {
    await $fetch(`/api/admin/portal-config/shop-categories/${encodeURIComponent(cat.slug)}`, { method: 'DELETE' })
    success.value = `Shop category "${cat.slug}" deleted`
    await loadShopCategories()
    await loadBackendStatus()
  } catch (err: any) {
    error.value = err.data?.statusMessage || 'Failed to delete shop category'
  } finally {
    deletingCategory.value = null
  }
}

// ─── Init ─────────────────────────────────────────────────

onMounted(() => loadAll())
</script>

<template>
  <section class="portal-config-tab">
    <!-- Messages -->
    <UiMessage v-if="error" variant="error" dismissible @dismiss="error = ''">{{ error }}</UiMessage>
    <UiMessage v-if="success" variant="success" dismissible @dismiss="success = ''">{{ success }}</UiMessage>

    <UiLoadingState v-if="loading" message="Loading portal configuration..." />

    <template v-else>
      <!-- Section Nav -->
      <nav class="section-nav">
        <button
          v-for="sec in sections"
          :key="sec.id"
          :class="['section-nav__btn', { 'section-nav__btn--active': activeSection === sec.id }]"
          @click="activeSection = sec.id as any"
        >
          <span class="section-nav__icon">{{ sec.icon }}</span>
          <span>{{ sec.label }}</span>
        </button>
      </nav>

      <!-- ═══════════ OVERVIEW ═══════════ -->
      <div v-if="activeSection === 'overview'" class="section">
        <UiSectionHeader title="Config Backend Overview" subtitle="Current configuration backend status and sync controls" />

        <div v-if="backendStatus" class="overview-grid">
          <div class="status-card">
            <div class="status-card__header">
              <span class="status-card__icon">🔌</span>
              <h4 class="status-card__title">Backend Mode</h4>
            </div>
            <div class="status-card__body">
              <UiBadge :variant="backendStatus.selfManaged ? 'success' : 'warning'">
                {{ backendStatus.backend }}
              </UiBadge>
              <p class="status-card__hint">
                <template v-if="backendStatus.backend === 'self-managed'">
                  Configuration is stored in a local SQLite database. Manage it below.
                </template>
                <template v-else-if="backendStatus.backend === 'directus'">
                  Configuration is loaded from Directus CMS. Switch to <code>NUXT_CONFIG_BACKEND=self-managed</code> to use the built-in editor.
                </template>
                <template v-else>
                  Configuration uses environment variables and hardcoded defaults. Switch to <code>NUXT_CONFIG_BACKEND=self-managed</code> to use the built-in editor.
                </template>
              </p>
            </div>
          </div>

          <div v-if="backendStatus.dbStatus" class="status-card">
            <div class="status-card__header">
              <span class="status-card__icon">📦</span>
              <h4 class="status-card__title">Database Status</h4>
            </div>
            <div class="status-card__body">
              <div class="db-stats">
                <div class="db-stat">
                  <span class="db-stat__label">Settings</span>
                  <UiBadge :variant="backendStatus.dbStatus.settingsConfigured ? 'success' : 'warning'" size="sm">
                    {{ backendStatus.dbStatus.settingsConfigured ? 'Configured' : 'Not set' }}
                  </UiBadge>
                </div>
                <div class="db-stat">
                  <span class="db-stat__label">Perk Groups</span>
                  <span class="db-stat__value">{{ backendStatus.dbStatus.perkGroupCount }}</span>
                </div>
                <div class="db-stat">
                  <span class="db-stat__label">Perks</span>
                  <span class="db-stat__value">{{ backendStatus.dbStatus.perkCount }}</span>
                </div>
                <div class="db-stat">
                  <span class="db-stat__label">Shop Categories</span>
                  <span class="db-stat__value">{{ backendStatus.dbStatus.shopCategoryCount }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Sync from Defaults -->
        <div class="sync-section">
          <h4 class="sync-section__title">🔄 Sync from Hardcoded Defaults</h4>
          <p class="sync-section__desc">
            Populate or update the database with the latest defaults bundled with the app.
            Items you have customized (<UiBadge variant="warning" size="sm">modified</UiBadge>) will be preserved.
            Only unmodified entries and new entries are affected.
          </p>
          <div class="sync-section__actions">
            <UiButton :loading="syncing" variant="admin" @click="handleSync">
              🔄 Sync from Defaults
            </UiButton>
          </div>

          <!-- Sync Reports -->
          <div v-if="syncReports.length > 0" class="sync-reports">
            <div v-for="report in syncReports" :key="report.collection" class="sync-report">
              <h5 class="sync-report__title">{{ report.collection }}</h5>
              <div class="sync-report__stats">
                <span class="sync-report__stat sync-report__stat--added">+{{ report.added }} added</span>
                <span class="sync-report__stat sync-report__stat--updated">↻{{ report.updated }} updated</span>
                <span class="sync-report__stat sync-report__stat--skipped">⏭{{ report.skipped }} skipped</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ═══════════ SETTINGS ═══════════ -->
      <div v-if="activeSection === 'settings'" class="section">
        <UiSectionHeader title="Portal Settings" subtitle="Shop, Eluna, and perk debuff configuration" />

        <div v-if="!settings" class="empty-hint">
          <UiEmptyState icon="⚙️" title="No Settings Yet" message="Sync from defaults or create settings manually.">
            <template #action>
              <UiButton variant="admin" @click="handleSync">🔄 Sync from Defaults</UiButton>
            </template>
          </UiEmptyState>
        </div>

        <form v-else class="settings-form" @submit.prevent="saveSettings">
          <div class="form-grid">
            <!-- Shop Settings -->
            <h4 class="form-grid__heading">🛒 Shop</h4>
            <div class="form-field form-field--checkbox">
              <label class="checkbox-label">
                <input v-model="settingsForm.shop_enabled" type="checkbox" />
                <span>Shop Enabled</span>
              </label>
            </div>
            <div class="form-field">
              <label class="form-label">Delivery Method</label>
              <UiSelect v-model="settingsForm.shop_delivery_method" :options="[
                { value: 'mail', label: 'Mail' },
                { value: 'bag', label: 'Bag (direct)' },
                { value: 'both', label: 'Both (user choice)' },
              ]" />
            </div>
            <div class="form-field">
              <label class="form-label">Markup Percent</label>
              <UiInput v-model.number="settingsForm.shop_markup_percent" type="number" />
            </div>
            <div class="form-field form-field--full">
              <label class="form-label">Mail Subject</label>
              <UiInput v-model="settingsForm.shop_mail_subject" />
            </div>
            <div class="form-field form-field--full">
              <label class="form-label">Mail Body</label>
              <UiInput v-model="settingsForm.shop_mail_body" />
            </div>

            <!-- Eluna Settings -->
            <h4 class="form-grid__heading">⚡ Eluna</h4>
            <div class="form-field form-field--checkbox">
              <label class="checkbox-label">
                <input v-model="settingsForm.eluna_enabled" type="checkbox" />
                <span>Eluna Enabled</span>
              </label>
            </div>
            <div class="form-field form-field--checkbox">
              <label class="checkbox-label">
                <input v-model="settingsForm.eluna_shop_enabled" type="checkbox" />
                <span>Eluna Shop Enabled</span>
              </label>
            </div>
            <div class="form-field form-field--checkbox">
              <label class="checkbox-label">
                <input v-model="settingsForm.eluna_gm_mail_enabled" type="checkbox" />
                <span>Eluna GM Mail Enabled</span>
              </label>
            </div>

            <!-- Debuff Settings -->
            <h4 class="form-grid__heading">💀 Perk Debuffs (Global Defaults)</h4>
            <div class="form-field">
              <label class="form-label">Fail Debuff Spell ID</label>
              <UiInput v-model.number="settingsForm.perk_fail_debuff_spell_id" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Fail Debuff Duration (ms)</label>
              <UiInput v-model.number="settingsForm.perk_fail_debuff_duration_ms" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Crit-Fail Debuff Spell ID</label>
              <UiInput v-model.number="settingsForm.perk_critfail_debuff_spell_id" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Crit-Fail Debuff Duration (ms)</label>
              <UiInput v-model.number="settingsForm.perk_critfail_debuff_duration_ms" type="number" />
            </div>
          </div>

          <div class="form-actions">
            <UiButton type="submit" variant="admin" :loading="savingSettings">💾 Save Settings</UiButton>
          </div>
        </form>
      </div>

      <!-- ═══════════ PERK GROUPS ═══════════ -->
      <div v-if="activeSection === 'perk-groups'" class="section">
        <UiSectionHeader title="Perk Groups" subtitle="Manage perk group categories">
          <template #actions>
            <UiButton variant="admin" size="sm" @click="openGroupForm()">+ New Group</UiButton>
          </template>
        </UiSectionHeader>

        <UiEmptyState v-if="perkGroups.length === 0" icon="📂" title="No Perk Groups" message="Sync from defaults or create groups manually." />

        <div v-else class="items-grid">
          <div v-for="group in perkGroups" :key="group.id" class="item-card">
            <div class="item-card__header">
              <span class="item-card__icon">{{ group.icon }}</span>
              <div class="item-card__info">
                <span class="item-card__name">{{ group.label }}</span>
                <span class="item-card__id">{{ group.id }}</span>
              </div>
              <UiBadge v-if="group.modified_by_user" variant="warning" size="sm">modified</UiBadge>
              <UiBadge :variant="group.enabled ? 'success' : 'error'" size="sm">
                {{ group.enabled ? 'Enabled' : 'Disabled' }}
              </UiBadge>
            </div>
            <p v-if="group.description" class="item-card__desc">{{ group.description }}</p>
            <div class="item-card__meta">
              <span>Sort: {{ group.sort }}</span>
              <span v-if="group.updated_at">Updated: {{ group.updated_at }}</span>
            </div>
            <div class="item-card__actions">
              <UiButton size="sm" @click="openGroupForm(group)">Edit</UiButton>
              <UiButton variant="danger" size="sm" :disabled="deletingGroup === group.id" @click="deleteGroup(group)">
                {{ deletingGroup === group.id ? '...' : 'Delete' }}
              </UiButton>
            </div>
          </div>
        </div>

        <!-- Group Form Modal -->
        <div v-if="showGroupForm" class="form-panel">
          <h3 class="form-panel__title">{{ editingGroup ? 'Edit' : 'Create' }} Perk Group</h3>
          <div class="form-grid">
            <div class="form-field">
              <label class="form-label">ID</label>
              <UiInput v-model="groupForm.id" :disabled="!!editingGroup" placeholder="e.g. buffs" />
            </div>
            <div class="form-field">
              <label class="form-label">Label</label>
              <UiInput v-model="groupForm.label" placeholder="e.g. Class Buffs" />
            </div>
            <div class="form-field">
              <label class="form-label">Icon</label>
              <UiInput v-model="groupForm.icon" placeholder="e.g. ✨" />
            </div>
            <div class="form-field">
              <label class="form-label">Sort</label>
              <UiInput v-model.number="groupForm.sort" type="number" />
            </div>
            <div class="form-field form-field--full">
              <label class="form-label">Description</label>
              <UiInput v-model="groupForm.description" placeholder="Short description" />
            </div>
            <div class="form-field form-field--checkbox">
              <label class="checkbox-label">
                <input v-model="groupForm.enabled" type="checkbox" />
                <span>Enabled</span>
              </label>
            </div>
          </div>
          <div class="form-panel__actions">
            <UiButton variant="ghost" size="sm" @click="closeGroupForm">Cancel</UiButton>
            <UiButton variant="admin" size="sm" :loading="savingGroup" @click="saveGroup">Save</UiButton>
          </div>
        </div>
      </div>

      <!-- ═══════════ PERKS ═══════════ -->
      <div v-if="activeSection === 'perks'" class="section">
        <UiSectionHeader title="Perks" :subtitle="`${filteredPerks.length} perk(s)`">
          <template #actions>
            <UiButton variant="admin" size="sm" @click="openPerkForm()">+ New Perk</UiButton>
          </template>
        </UiSectionHeader>

        <!-- Filters -->
        <div class="filter-bar">
          <UiSelect v-model="perkFilterGroup" :options="[{ value: '', label: 'All Groups' }, ...groupOptions]" class="filter-select" />
          <UiInput v-model="perkSearch" placeholder="Search perks..." class="filter-search" />
        </div>

        <UiEmptyState v-if="filteredPerks.length === 0" icon="🎲" title="No Perks Found" message="Sync from defaults, change filters, or create a new perk." />

        <div v-else class="perks-table-container">
          <table class="perks-table">
            <thead>
              <tr>
                <th>Perk</th>
                <th>Group</th>
                <th>Type</th>
                <th>Game ID</th>
                <th>Dice</th>
                <th>Limit</th>
                <th>Lvl</th>
                <th style="width: 50px"></th>
                <th style="width: 120px"></th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="perk in filteredPerks" :key="perk.id">
                <td>
                  <span class="perk-name">{{ perk.icon }} {{ perk.name }}</span>
                  <span class="perk-id">{{ perk.id }}</span>
                </td>
                <td><UiBadge size="sm">{{ perk.group_id }}</UiBadge></td>
                <td><UiBadge :variant="perk.delivery_type === 'aura' ? 'success' : perk.delivery_type === 'teleport' ? 'warning' : 'info'" size="sm">{{ perk.delivery_type }}</UiBadge></td>
                <td class="mono">{{ perk.game_id }}</td>
                <td class="mono">{{ perk.roll_threshold }}/d{{ perk.dice_sides }}</td>
                <td class="mono">{{ perk.daily_limit === 0 ? '∞' : perk.daily_limit }}/day</td>
                <td class="mono">{{ perk.required_level || '-' }}</td>
                <td>
                  <UiBadge v-if="perk.modified_by_user" variant="warning" size="sm">mod</UiBadge>
                </td>
                <td>
                  <div class="row-actions">
                    <UiButton size="sm" @click="openPerkForm(perk)">Edit</UiButton>
                    <UiButton variant="danger" size="sm" :disabled="deletingPerk === perk.id" @click="deletePerk(perk)">
                      {{ deletingPerk === perk.id ? '...' : '✕' }}
                    </UiButton>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Perk Form Modal -->
        <div v-if="showPerkForm" class="form-panel form-panel--wide">
          <h3 class="form-panel__title">{{ editingPerk ? 'Edit' : 'Create' }} Perk</h3>
          <div class="form-grid form-grid--3col">
            <!-- Basic -->
            <div class="form-field">
              <label class="form-label">ID</label>
              <UiInput v-model="perkForm.id" :disabled="!!editingPerk" placeholder="e.g. buff-motw-r1" />
            </div>
            <div class="form-field">
              <label class="form-label">Name</label>
              <UiInput v-model="perkForm.name" placeholder="Display name" />
            </div>
            <div class="form-field">
              <label class="form-label">Group</label>
              <UiSelect v-model="perkForm.group_id" :options="groupOptions" />
            </div>
            <div class="form-field">
              <label class="form-label">Icon</label>
              <UiInput v-model="perkForm.icon" />
            </div>
            <div class="form-field">
              <label class="form-label">Delivery Type</label>
              <UiSelect v-model="perkForm.delivery_type" :options="[
                { value: 'spell', label: 'Spell (permanent)' },
                { value: 'item', label: 'Item (mail)' },
                { value: 'bag-item', label: 'Bag Item (direct)' },
                { value: 'aura', label: 'Aura (buff)' },
                { value: 'teleport', label: 'Teleport' },
              ]" />
            </div>
            <div class="form-field">
              <label class="form-label">Game ID</label>
              <UiInput v-model.number="perkForm.game_id" type="number" />
            </div>
            <div class="form-field form-field--full">
              <label class="form-label">Description</label>
              <UiInput v-model="perkForm.description" />
            </div>
            <div class="form-field form-field--full">
              <label class="form-label">Success Message</label>
              <UiInput v-model="perkForm.success_message" />
            </div>

            <!-- Dice / Limits -->
            <h4 class="form-grid__heading">Dice & Limits</h4>
            <div class="form-field">
              <label class="form-label">Dice Sides</label>
              <UiInput v-model.number="perkForm.dice_sides" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Roll Threshold</label>
              <UiInput v-model.number="perkForm.roll_threshold" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Daily Limit (0=unlimited)</label>
              <UiInput v-model.number="perkForm.daily_limit" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Required Level</label>
              <UiInput v-model.number="perkForm.required_level" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Sort</label>
              <UiInput v-model.number="perkForm.sort" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Accent Color</label>
              <UiInput v-model="perkForm.accent" placeholder="blue, green, purple..." />
            </div>
            <div class="form-field form-field--checkbox">
              <label class="checkbox-label"><input v-model="perkForm.requires_online" type="checkbox" /> Requires Online</label>
            </div>
            <div class="form-field form-field--checkbox">
              <label class="checkbox-label"><input v-model="perkForm.one_time" type="checkbox" /> One-Time Only</label>
            </div>

            <!-- Optional fields -->
            <h4 class="form-grid__heading">Optional Fields</h4>
            <div class="form-field">
              <label class="form-label">Env Prefix</label>
              <UiInput v-model="perkForm.env_prefix" placeholder="BUFF_MOTW_R1" />
            </div>
            <div class="form-field">
              <label class="form-label">Rank Group</label>
              <UiInput v-model="perkForm.rank_group" placeholder="Group for rank dedup" />
            </div>
            <div class="form-field">
              <label class="form-label">Aura Duration (ms)</label>
              <UiInput v-model.number="perkForm.aura_duration_ms" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Item Count</label>
              <UiInput v-model.number="perkForm.item_count" type="number" />
            </div>
            <div class="form-field form-field--full">
              <label class="form-label">Mail Subject</label>
              <UiInput v-model="perkForm.mail_subject" />
            </div>
            <div class="form-field form-field--full">
              <label class="form-label">Mail Body</label>
              <UiInput v-model="perkForm.mail_body" />
            </div>

            <!-- Debuff overrides -->
            <h4 class="form-grid__heading">Per-Perk Debuff Overrides</h4>
            <div class="form-field">
              <label class="form-label">Fail Debuff Spell ID</label>
              <UiInput v-model.number="perkForm.fail_debuff_spell_id" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Fail Debuff Duration (ms)</label>
              <UiInput v-model.number="perkForm.fail_debuff_duration_ms" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Crit-Fail Spell ID</label>
              <UiInput v-model.number="perkForm.critfail_debuff_spell_id" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">Crit-Fail Duration (ms)</label>
              <UiInput v-model.number="perkForm.critfail_debuff_duration_ms" type="number" />
            </div>

            <!-- Teleport -->
            <h4 class="form-grid__heading">Teleport Coordinates</h4>
            <div class="form-field">
              <label class="form-label">Map ID</label>
              <UiInput v-model.number="perkForm.teleport_map_id" type="number" />
            </div>
            <div class="form-field">
              <label class="form-label">X</label>
              <UiInput v-model.number="perkForm.teleport_x" type="number" :step="0.01" />
            </div>
            <div class="form-field">
              <label class="form-label">Y</label>
              <UiInput v-model.number="perkForm.teleport_y" type="number" :step="0.01" />
            </div>
            <div class="form-field">
              <label class="form-label">Z</label>
              <UiInput v-model.number="perkForm.teleport_z" type="number" :step="0.01" />
            </div>
            <div class="form-field">
              <label class="form-label">Orientation</label>
              <UiInput v-model.number="perkForm.teleport_o" type="number" :step="0.01" />
            </div>
          </div>

          <div class="form-panel__actions">
            <UiButton variant="ghost" size="sm" @click="closePerkForm">Cancel</UiButton>
            <UiButton variant="admin" size="sm" :loading="savingPerk" @click="savePerk">Save Perk</UiButton>
          </div>
        </div>
      </div>

      <!-- ═══════════ SHOP CATEGORIES ═══════════ -->
      <div v-if="activeSection === 'shop-categories'" class="section">
        <UiSectionHeader title="Shop Categories" subtitle="Manage item shop categories and ordering">
          <template #actions>
            <UiButton variant="admin" size="sm" @click="openCategoryForm()">+ New Category</UiButton>
          </template>
        </UiSectionHeader>

        <UiEmptyState v-if="shopCategories.length === 0" icon="🛒" title="No Shop Categories" message="Sync from defaults or add categories manually." />

        <div v-else class="items-grid items-grid--compact">
          <div v-for="cat in shopCategories" :key="cat.slug" class="item-card item-card--compact">
            <div class="item-card__header">
              <span class="item-card__icon">🏷️</span>
              <div class="item-card__info">
                <span class="item-card__name">{{ cat.slug }}</span>
                <span class="item-card__id">Sort: {{ cat.sort }}</span>
              </div>
              <UiBadge v-if="cat.modified_by_user" variant="warning" size="sm">modified</UiBadge>
            </div>
            <div class="item-card__actions">
              <UiButton size="sm" @click="openCategoryForm(cat)">Edit</UiButton>
              <UiButton variant="danger" size="sm" :disabled="deletingCategory === cat.slug" @click="deleteCategory(cat)">
                {{ deletingCategory === cat.slug ? '...' : 'Delete' }}
              </UiButton>
            </div>
          </div>
        </div>

        <!-- Category Form -->
        <div v-if="showCategoryForm" class="form-panel">
          <h3 class="form-panel__title">{{ categoryForm.slug ? 'Edit' : 'Create' }} Shop Category</h3>
          <div class="form-grid">
            <div class="form-field">
              <label class="form-label">Slug</label>
              <UiInput v-model="categoryForm.slug" placeholder="e.g. weapons" />
            </div>
            <div class="form-field">
              <label class="form-label">Sort Order</label>
              <UiInput v-model.number="categoryForm.sort" type="number" />
            </div>
          </div>
          <div class="form-panel__actions">
            <UiButton variant="ghost" size="sm" @click="closeCategoryForm">Cancel</UiButton>
            <UiButton variant="admin" size="sm" :loading="savingCategory" @click="saveCategory">Save</UiButton>
          </div>
        </div>
      </div>
    </template>
  </section>
</template>

<style scoped lang="scss">
@use '~/styles/variables' as *;
@use '~/styles/mixins' as *;

.portal-config-tab {
  display: flex;
  flex-direction: column;
  gap: $spacing-4;
}

// Section Nav
.section-nav {
  display: flex;
  gap: $spacing-2;
  flex-wrap: wrap;
  margin-bottom: $spacing-4;
  padding-bottom: $spacing-3;
  border-bottom: 1px solid $border-primary;

  &__btn {
    display: flex;
    align-items: center;
    gap: $spacing-2;
    padding: $spacing-2 $spacing-4;
    border-radius: $radius-lg;
    border: 1px solid $border-primary;
    background: transparent;
    color: $text-secondary;
    font-size: $font-size-sm;
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      border-color: $text-secondary;
      color: $text-primary;
    }

    &--active {
      background: rgba($orange-primary, 0.12);
      border-color: $orange-primary;
      color: $orange-light;
    }
  }

  &__icon {
    font-size: $font-size-base;
  }
}

.section {
  animation: fadeIn $transition-slow;
}

// Overview
.overview-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: $spacing-4;
  margin-bottom: $spacing-6;
}

.status-card {
  @include card-base;

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-3;
    margin-bottom: $spacing-3;
  }

  &__icon { font-size: $font-size-2xl; }
  &__title { font-size: $font-size-base; font-weight: $font-weight-semibold; color: $text-primary; margin: 0; }
  &__hint { font-size: $font-size-sm; color: $text-secondary; margin-top: $spacing-2; line-height: 1.5; code { background: $bg-tertiary; padding: 1px $spacing-1; border-radius: $radius-sm; font-size: $font-size-xs; } }
}

.db-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-3;
}

.db-stat {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: $spacing-2;
  background: $bg-primary;
  border-radius: $radius-md;

  &__label { font-size: $font-size-sm; color: $text-secondary; }
  &__value { font-size: $font-size-sm; font-weight: $font-weight-semibold; color: $text-primary; font-family: monospace; }
}

// Sync
.sync-section {
  @include card-base;
  border: 1px solid rgba($blue-primary, 0.2);

  &__title { font-size: $font-size-base; font-weight: $font-weight-semibold; color: $text-primary; margin: 0 0 $spacing-2; }
  &__desc { font-size: $font-size-sm; color: $text-secondary; line-height: 1.6; margin: 0 0 $spacing-4; }
  &__actions { margin-bottom: $spacing-3; }
}

.sync-reports {
  display: flex;
  flex-direction: column;
  gap: $spacing-2;
  margin-top: $spacing-4;
  padding-top: $spacing-4;
  border-top: 1px solid $border-primary;
}

.sync-report {
  display: flex;
  align-items: center;
  gap: $spacing-4;
  padding: $spacing-2 $spacing-3;
  background: $bg-primary;
  border-radius: $radius-md;

  &__title { font-size: $font-size-sm; font-weight: $font-weight-semibold; color: $text-primary; min-width: 140px; margin: 0; }
  &__stats { display: flex; gap: $spacing-3; }
  &__stat {
    font-size: $font-size-xs;
    font-family: monospace;
    &--added { color: $success-light; }
    &--updated { color: $blue-light; }
    &--skipped { color: $warning-light; }
  }
}

// Items grid (groups, categories)
.items-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: $spacing-3;

  &--compact {
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  }
}

.item-card {
  @include card-base;
  display: flex;
  flex-direction: column;
  gap: $spacing-3;

  &--compact { gap: $spacing-2; }

  &__header {
    display: flex;
    align-items: center;
    gap: $spacing-3;
  }

  &__icon { font-size: $font-size-2xl; flex-shrink: 0; }

  &__info {
    flex: 1;
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  &__name { font-weight: $font-weight-semibold; color: $text-primary; }
  &__id { font-size: $font-size-xs; color: $text-muted; font-family: monospace; }
  &__desc { font-size: $font-size-sm; color: $text-secondary; line-height: 1.4; }

  &__meta {
    display: flex;
    gap: $spacing-3;
    font-size: $font-size-xs;
    color: $text-muted;
  }

  &__actions {
    display: flex;
    gap: $spacing-2;
    margin-top: auto;
  }
}

// Form panel (inline editing forms)
.form-panel {
  @include card-base;
  border: 1px solid rgba($orange-primary, 0.2);
  margin-top: $spacing-4;

  &--wide { max-width: none; }

  &__title {
    font-size: $font-size-lg;
    font-weight: $font-weight-semibold;
    color: $text-primary;
    margin: 0 0 $spacing-4;
  }

  &__actions {
    display: flex;
    justify-content: flex-end;
    gap: $spacing-2;
    padding-top: $spacing-4;
    border-top: 1px solid $border-primary;
  }
}

// Form grid
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: $spacing-4;

  &--3col { grid-template-columns: 1fr 1fr 1fr; }

  &__heading {
    grid-column: 1 / -1;
    font-size: $font-size-sm;
    font-weight: $font-weight-semibold;
    color: $orange-light;
    margin: $spacing-2 0 0;
    padding-top: $spacing-3;
    border-top: 1px solid $border-primary;

    &:first-child {
      border-top: none;
      padding-top: 0;
      margin-top: 0;
    }
  }

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
    &--3col { grid-template-columns: 1fr; }
  }
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: $spacing-1;

  &--full { grid-column: 1 / -1; }
  &--checkbox { justify-content: center; }
}

.form-label {
  font-size: $font-size-sm;
  font-weight: $font-weight-medium;
  color: $text-secondary;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: $spacing-2;
  cursor: pointer;
  font-size: $font-size-sm;
  color: $text-primary;

  input[type="checkbox"] {
    width: 16px;
    height: 16px;
    accent-color: $orange-primary;
    cursor: pointer;
  }
}

.settings-form {
  @include card-base;
}

.form-actions {
  padding-top: $spacing-4;
  border-top: 1px solid $border-primary;
  margin-top: $spacing-2;
}

// Perks table
.filter-bar {
  display: flex;
  gap: $spacing-3;
  margin-bottom: $spacing-4;
  flex-wrap: wrap;
}

.filter-select { max-width: 250px; }
.filter-search { flex: 1; min-width: 200px; }

.perks-table-container { @include table-container; }
.perks-table { @include table-base; }

.perk-name {
  font-weight: $font-weight-semibold;
  color: $text-primary;
  display: block;
}

.perk-id {
  font-size: $font-size-xs;
  color: $text-muted;
  font-family: monospace;
}

.mono { font-family: monospace; font-size: $font-size-sm; }

.row-actions {
  display: flex;
  gap: $spacing-1;
}

.empty-hint {
  @include card-base;
  padding: $spacing-8;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
