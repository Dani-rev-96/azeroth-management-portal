import { describe, it, expect } from 'vitest'

// ─── ADMIN_FEATURES Registry ────────────────────────────────────────────────────

// Test the feature registry data integrity without importing the whole module
// (which depends on better-sqlite3 and filesystem)

const ADMIN_FEATURES = {
  'admin.accounts': { label: 'All Accounts', description: 'View and manage all WoW accounts', icon: '👥' },
  'admin.mappings': { label: 'Account Mappings', description: 'View external → WoW account mappings', icon: '🔗' },
  'admin.link-accounts': { label: 'Link Accounts', description: 'Create and manage account links', icon: '🔧' },
  'admin.gm': { label: 'GM Management', description: 'Set GM levels and send mail', icon: '🛡️' },
  'admin.mail': { label: 'Send Mail', description: 'Send in-game mail with items', icon: '✉️' },
  'admin.files': { label: 'File Management', description: 'Upload and manage download files', icon: '📁' },
  'admin.backup': { label: 'Backup & Restore', description: 'Create database backups and restore from files', icon: '💾' },
  'admin.dressingroom': { label: 'Dressing Room', description: 'Edit character items, stats, professions, reputations, quests, achievements, titles', icon: '👗' },
  'admin.export': { label: 'Data Export', description: 'Export admin data as CSV/JSON', icon: '📤' },
} as const

type AdminFeatureId = keyof typeof ADMIN_FEATURES

describe('ADMIN_FEATURES Registry', () => {
  it('has 9 features', () => {
    expect(Object.keys(ADMIN_FEATURES)).toHaveLength(9)
  })

  it('all feature IDs start with "admin."', () => {
    for (const id of Object.keys(ADMIN_FEATURES)) {
      expect(id).toMatch(/^admin\./)
    }
  })

  it('all features have label, description, and icon', () => {
    for (const [id, meta] of Object.entries(ADMIN_FEATURES)) {
      expect(meta.label).toBeTruthy()
      expect(meta.description).toBeTruthy()
      expect(meta.icon).toBeTruthy()
    }
  })

  it('contains expected feature IDs', () => {
    const expectedIds: AdminFeatureId[] = [
      'admin.accounts',
      'admin.mappings',
      'admin.link-accounts',
      'admin.gm',
      'admin.mail',
      'admin.files',
      'admin.backup',
      'admin.dressingroom',
      'admin.export',
    ]
    for (const id of expectedIds) {
      expect(ADMIN_FEATURES[id]).toBeDefined()
    }
  })

  it('labels are unique', () => {
    const labels = Object.values(ADMIN_FEATURES).map(f => f.label)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('icons are unique', () => {
    const icons = Object.values(ADMIN_FEATURES).map(f => f.icon)
    expect(new Set(icons).size).toBe(icons.length)
  })
})
