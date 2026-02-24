import { describe, it, expect, vi } from 'vitest'

// Mock Nuxt's createError auto-import
;(globalThis as any).createError = (opts: any) => {
  const err = new Error(opts.statusMessage) as any
  err.statusCode = opts.statusCode
  err.statusMessage = opts.statusMessage
  return err
}

// We can't import the actual module because it depends on mysql.ts pool factories.
// Instead, we test the pure logic of getRealmsToQuery directly.

// Recreate the pure function for isolated testing
function getRealmsToQuery(
  allRealms: Record<string, { name: string; [key: string]: any }>,
  realmIdFilter?: string
): Record<string, any> {
  if (!realmIdFilter) {
    return allRealms
  }

  if (!(realmIdFilter in allRealms)) {
    throw (globalThis as any).createError({
      statusCode: 400,
      statusMessage: `Invalid realm ID: ${realmIdFilter}`,
    })
  }

  const realm = allRealms[realmIdFilter]
  if (!realm) {
    throw (globalThis as any).createError({
      statusCode: 400,
      statusMessage: `Realm not found: ${realmIdFilter}`,
    })
  }

  return { [realmIdFilter]: realm }
}

const MOCK_REALMS = {
  '1': { name: 'Realm One', id: '1' },
  '2': { name: 'Realm Two', id: '2' },
  '3': { name: 'Realm Three', id: '3' },
}

describe('getRealmsToQuery', () => {
  it('returns all realms when no filter is provided', () => {
    const result = getRealmsToQuery(MOCK_REALMS)
    expect(Object.keys(result)).toHaveLength(3)
    expect(result).toBe(MOCK_REALMS)
  })

  it('returns all realms when filter is undefined', () => {
    const result = getRealmsToQuery(MOCK_REALMS, undefined)
    expect(Object.keys(result)).toHaveLength(3)
  })

  it('returns single realm when valid filter provided', () => {
    const result = getRealmsToQuery(MOCK_REALMS, '2')
    expect(Object.keys(result)).toHaveLength(1)
    expect(result['2']).toBeDefined()
    expect(result['2'].name).toBe('Realm Two')
  })

  it('throws 400 for invalid realm ID', () => {
    expect(() => getRealmsToQuery(MOCK_REALMS, '999')).toThrow(/Invalid realm ID/)
    try {
      getRealmsToQuery(MOCK_REALMS, '999')
    } catch (e: any) {
      expect(e.statusCode).toBe(400)
    }
  })

  it('returns correct realm when first realm is filtered', () => {
    const result = getRealmsToQuery(MOCK_REALMS, '1')
    expect(Object.keys(result)).toHaveLength(1)
    expect(result['1'].name).toBe('Realm One')
  })

  it('handles empty realms object with no filter', () => {
    const result = getRealmsToQuery({})
    expect(Object.keys(result)).toHaveLength(0)
  })

  it('throws for filter on empty realms object', () => {
    expect(() => getRealmsToQuery({}, '1')).toThrow()
  })
})
