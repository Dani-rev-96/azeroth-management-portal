import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// ─── Environment Variable Parsing Logic ─────────────────────────────────────────

// Test the config parsing patterns used in server/utils/config/index.ts
// without importing the module directly (avoids Nuxt/Directus dependencies)

describe('Config: Auth DB Config Parsing', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function getAuthDbConfig() {
    return {
      host: process.env.NUXT_DB_AUTH_HOST || 'localhost',
      port: parseInt(process.env.NUXT_DB_AUTH_PORT || '3306', 10),
      user: process.env.NUXT_DB_AUTH_USER || 'acore',
      password: process.env.NUXT_DB_AUTH_PASSWORD || 'acore',
      database: 'acore_auth',
    }
  }

  it('returns defaults when no env vars set', () => {
    delete process.env.NUXT_DB_AUTH_HOST
    delete process.env.NUXT_DB_AUTH_PORT
    delete process.env.NUXT_DB_AUTH_USER
    delete process.env.NUXT_DB_AUTH_PASSWORD

    const config = getAuthDbConfig()
    expect(config.host).toBe('localhost')
    expect(config.port).toBe(3306)
    expect(config.user).toBe('acore')
    expect(config.password).toBe('acore')
    expect(config.database).toBe('acore_auth')
  })

  it('reads custom values from env vars', () => {
    process.env.NUXT_DB_AUTH_HOST = 'db.example.com'
    process.env.NUXT_DB_AUTH_PORT = '3307'
    process.env.NUXT_DB_AUTH_USER = 'custom_user'
    process.env.NUXT_DB_AUTH_PASSWORD = 'secret'

    const config = getAuthDbConfig()
    expect(config.host).toBe('db.example.com')
    expect(config.port).toBe(3307)
    expect(config.user).toBe('custom_user')
    expect(config.password).toBe('secret')
  })

  it('database name is always acore_auth', () => {
    const config = getAuthDbConfig()
    expect(config.database).toBe('acore_auth')
  })
})

describe('Config: Realm Parsing', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function getRealms(): Record<string, any> {
    const realms: Record<string, any> = {}
    for (let i = 0; i < 10; i++) {
      const prefix = `NUXT_DB_REALM_${i}_`
      const id = process.env[`${prefix}ID`]
      const name = process.env[`${prefix}NAME`]
      if (!id || !name) continue

      realms[id] = {
        id,
        name,
        description: process.env[`${prefix}DESCRIPTION`] || '',
        dbHost: process.env[`${prefix}HOST`] || 'localhost',
        dbPort: parseInt(process.env[`${prefix}PORT`] || '3306', 10),
        dbUser: process.env[`${prefix}USER`] || 'acore',
        dbPassword: process.env[`${prefix}PASSWORD`] || 'acore',
      }
    }
    return realms
  }

  it('returns empty when no realm env vars set', () => {
    // Clear all NUXT_DB_REALM_* vars
    for (let i = 0; i < 10; i++) {
      delete process.env[`NUXT_DB_REALM_${i}_ID`]
      delete process.env[`NUXT_DB_REALM_${i}_NAME`]
    }
    const realms = getRealms()
    expect(Object.keys(realms)).toHaveLength(0)
  })

  it('parses single realm from env vars', () => {
    process.env.NUXT_DB_REALM_0_ID = '1'
    process.env.NUXT_DB_REALM_0_NAME = 'TestRealm'
    process.env.NUXT_DB_REALM_0_HOST = 'db.local'
    process.env.NUXT_DB_REALM_0_PORT = '3306'

    const realms = getRealms()
    expect(Object.keys(realms)).toHaveLength(1)
    expect(realms['1']).toBeDefined()
    expect(realms['1'].name).toBe('TestRealm')
    expect(realms['1'].dbHost).toBe('db.local')
  })

  it('parses multiple realms', () => {
    process.env.NUXT_DB_REALM_0_ID = '1'
    process.env.NUXT_DB_REALM_0_NAME = 'Realm One'
    process.env.NUXT_DB_REALM_1_ID = '2'
    process.env.NUXT_DB_REALM_1_NAME = 'Realm Two'

    const realms = getRealms()
    expect(Object.keys(realms)).toHaveLength(2)
    expect(realms['1'].name).toBe('Realm One')
    expect(realms['2'].name).toBe('Realm Two')
  })

  it('skips realms without both ID and NAME', () => {
    process.env.NUXT_DB_REALM_0_ID = '1'
    // Missing NAME
    process.env.NUXT_DB_REALM_1_NAME = 'Orphan'
    // Missing ID
    process.env.NUXT_DB_REALM_2_ID = '3'
    process.env.NUXT_DB_REALM_2_NAME = 'Valid'

    const realms = getRealms()
    expect(Object.keys(realms)).toHaveLength(1)
    expect(realms['3']).toBeDefined()
  })

  it('supports up to 10 realms (0-9)', () => {
    for (let i = 0; i < 10; i++) {
      process.env[`NUXT_DB_REALM_${i}_ID`] = String(i + 1)
      process.env[`NUXT_DB_REALM_${i}_NAME`] = `Realm ${i + 1}`
    }

    const realms = getRealms()
    expect(Object.keys(realms)).toHaveLength(10)
  })

  it('defaults to localhost:3306/acore for DB connection', () => {
    process.env.NUXT_DB_REALM_0_ID = '1'
    process.env.NUXT_DB_REALM_0_NAME = 'Default'

    const realms = getRealms()
    expect(realms['1'].dbHost).toBe('localhost')
    expect(realms['1'].dbPort).toBe(3306)
    expect(realms['1'].dbUser).toBe('acore')
    expect(realms['1'].dbPassword).toBe('acore')
  })
})

// ─── Perk Config Resolution ─────────────────────────────────────────────────────

describe('Config: Perk Config Resolution', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function resolvePerPerkConfig(envPrefix: string, perk: { defaultDiceSides: number; defaultRollThreshold: number; defaultDailyLimit: number; requiredLevel: number }) {
    return {
      diceSides: parseInt(process.env[`NUXT_PERK_${envPrefix}_DICE_SIDES`] || String(perk.defaultDiceSides), 10),
      rollThreshold: parseInt(process.env[`NUXT_PERK_${envPrefix}_ROLL_THRESHOLD`] || String(perk.defaultRollThreshold), 10),
      dailyLimit: parseInt(process.env[`NUXT_PERK_${envPrefix}_DAILY_LIMIT`] || String(perk.defaultDailyLimit), 10),
      requiredLevel: parseInt(process.env[`NUXT_PERK_${envPrefix}_REQUIRED_LEVEL`] || String(perk.requiredLevel), 10),
    }
  }

  const defaultPerk = {
    defaultDiceSides: 20,
    defaultRollThreshold: 8,
    defaultDailyLimit: 5,
    requiredLevel: 60,
  }

  it('returns defaults when no env overrides', () => {
    const config = resolvePerPerkConfig('FLYING', defaultPerk)
    expect(config.diceSides).toBe(20)
    expect(config.rollThreshold).toBe(8)
    expect(config.dailyLimit).toBe(5)
    expect(config.requiredLevel).toBe(60)
  })

  it('reads overrides from env', () => {
    process.env.NUXT_PERK_FLYING_DICE_SIDES = '10'
    process.env.NUXT_PERK_FLYING_ROLL_THRESHOLD = '3'
    process.env.NUXT_PERK_FLYING_DAILY_LIMIT = '2'
    process.env.NUXT_PERK_FLYING_REQUIRED_LEVEL = '70'

    const config = resolvePerPerkConfig('FLYING', defaultPerk)
    expect(config.diceSides).toBe(10)
    expect(config.rollThreshold).toBe(3)
    expect(config.dailyLimit).toBe(2)
    expect(config.requiredLevel).toBe(70)
  })

  it('partial overrides keep defaults for unset values', () => {
    process.env.NUXT_PERK_FLYING_DICE_SIDES = '6'

    const config = resolvePerPerkConfig('FLYING', defaultPerk)
    expect(config.diceSides).toBe(6) // overridden
    expect(config.rollThreshold).toBe(8) // default
    expect(config.dailyLimit).toBe(5) // default
    expect(config.requiredLevel).toBe(60) // default
  })
})

// ─── Perk Group Toggle ──────────────────────────────────────────────────────────

describe('Config: Perk Group Toggles', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  function isGroupEnabled(envKey: string): boolean {
    return process.env[envKey] !== 'false'
  }

  it('groups default to enabled', () => {
    delete process.env.NUXT_PERK_GROUP_MOUNT_ENABLED
    expect(isGroupEnabled('NUXT_PERK_GROUP_MOUNT_ENABLED')).toBe(true)
  })

  it('groups can be explicitly disabled', () => {
    process.env.NUXT_PERK_GROUP_MOUNT_ENABLED = 'false'
    expect(isGroupEnabled('NUXT_PERK_GROUP_MOUNT_ENABLED')).toBe(false)
  })

  it('groups can be explicitly enabled', () => {
    process.env.NUXT_PERK_GROUP_MOUNT_ENABLED = 'true'
    expect(isGroupEnabled('NUXT_PERK_GROUP_MOUNT_ENABLED')).toBe(true)
  })

  it('any non-"false" value is treated as enabled', () => {
    process.env.NUXT_PERK_GROUP_MOUNT_ENABLED = '1'
    expect(isGroupEnabled('NUXT_PERK_GROUP_MOUNT_ENABLED')).toBe(true)

    process.env.NUXT_PERK_GROUP_MOUNT_ENABLED = 'yes'
    expect(isGroupEnabled('NUXT_PERK_GROUP_MOUNT_ENABLED')).toBe(true)
  })
})
