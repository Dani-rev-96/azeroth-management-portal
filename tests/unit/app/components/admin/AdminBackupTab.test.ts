import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import AdminBackupTab from '../../../../../app/components/admin/AdminBackupTab.vue'

const DATABASES = [
  { type: 'auth', name: 'acore_auth', host: 'auth-db', sizeBytes: 1024 },
  { type: 'characters', name: 'acore_characters', realmId: '1', realmName: 'Blizzlike', host: 'realm1-db', sizeBytes: 2048 },
]

const PORTAL_DATABASES = [
  { key: 'mappings', name: 'Account Mappings', path: '/data/sqlite/mappings.db', sizeBytes: 4096, exists: true },
]

function stubLists(restoreEnabled: boolean) {
  const fetchMock = vi.fn(async (url: string) => {
    if (url === '/api/admin/backup/list') return { databases: DATABASES, restoreEnabled }
    if (url === '/api/admin/backup/portal-list') return { databases: PORTAL_DATABASES, restoreEnabled }
    throw new Error(`unexpected $fetch ${url}`)
  })
  vi.stubGlobal('$fetch', fetchMock)
  return fetchMock
}

async function mountTab() {
  const wrapper = mount(AdminBackupTab, { props: { realms: [{ id: '1', name: 'Blizzlike' }] } })
  await flushPromises()
  return wrapper
}

describe('AdminBackupTab', () => {
  const originalFetch = globalThis.fetch
  const originalCreateObjectURL = URL.createObjectURL
  const originalRevokeObjectURL = URL.revokeObjectURL

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:mock')
    URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    // Not vi.unstubAllGlobals(): tests/setup.ts stubs the Vue auto-import globals
    globalThis.fetch = originalFetch
    URL.createObjectURL = originalCreateObjectURL
    URL.revokeObjectURL = originalRevokeObjectURL
    vi.stubGlobal('$fetch', vi.fn())
  })

  it('shows a Download button per database card', async () => {
    stubLists(false)
    const wrapper = await mountTab()
    expect(wrapper.find('[data-testid="backup-card-auth"] button').text()).toContain('Download')
    expect(wrapper.find('[data-testid="backup-card-characters-1"] button').text()).toContain('Download')
  })

  it('hides both restore forms and explains the flag when restore is disabled', async () => {
    stubLists(false)
    const wrapper = await mountTab()
    expect(wrapper.find('[data-testid="restore-disabled"]').text()).toContain('BACKUP_RESTORE_ENABLED=true')
    expect(wrapper.find('[data-testid="portal-restore-disabled"]').exists()).toBe(true)
    expect(wrapper.find('#restore-file').exists()).toBe(false)
    expect(wrapper.find('#portal-restore-file').exists()).toBe(false)
  })

  it('shows the restore forms with a typed confirmation when restore is enabled', async () => {
    stubLists(true)
    const wrapper = await mountTab()
    expect(wrapper.find('[data-testid="restore-disabled"]').exists()).toBe(false)
    expect(wrapper.find('#restore-file').exists()).toBe(true)
    expect(wrapper.find('#restore-confirm').attributes('placeholder')).toBe('acore_auth')
    expect(wrapper.find('#portal-restore-confirm').attributes('placeholder')).toBe('mappings')
  })

  it('requests one database per download and uses the server filename', async () => {
    stubLists(false)
    const fetchSpy = vi.fn(async () => new Response(new Blob(['gz']), {
      status: 200,
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': 'attachment; filename="acore_characters-realm1-2026-09-30T12-00-00Z.sql.gz"',
      },
    }))
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    const wrapper = await mountTab()

    await wrapper.find('[data-testid="backup-card-characters-1"] button').trigger('click')
    await flushPromises()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('/api/admin/backup/create')
    expect(JSON.parse(init.body as string)).toEqual({ database: 'characters', realmId: '1' })
    expect(wrapper.text()).toContain('Backup downloaded: acore_characters-realm1-2026-09-30T12-00-00Z.sql.gz')
  })

  it('shows the server error message when a backup fails', async () => {
    stubLists(false)
    globalThis.fetch = vi.fn(async () => new Response(
      JSON.stringify({ statusCode: 500, statusMessage: 'mysqldump failed for acore_auth: Access denied' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )) as unknown as typeof fetch
    const wrapper = await mountTab()

    await wrapper.find('[data-testid="backup-card-auth"] button').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('acore_auth: mysqldump failed for acore_auth: Access denied')
  })
})
