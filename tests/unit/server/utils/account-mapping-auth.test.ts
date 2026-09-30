import { describe, it, expect } from 'vitest'
import { canDeleteMapping, resolveMappingExternalId } from '../../../../server/utils/account-mapping-auth'

describe('canDeleteMapping', () => {
  it('allows the owner to delete their own mapping', () => {
    expect(canDeleteMapping({ userId: 'sub-123', isGM: false, externalId: 'sub-123' })).toBe(true)
  })

  it('forbids non-GMs from deleting another user\'s mapping', () => {
    expect(canDeleteMapping({ userId: 'sub-123', isGM: false, externalId: 'sub-999' })).toBe(false)
  })

  it('allows GMs to delete any mapping', () => {
    expect(canDeleteMapping({ userId: 'gm-1', isGM: true, externalId: 'sub-999' })).toBe(true)
  })

  it('does not treat a display name as ownership (ids must match exactly)', () => {
    expect(canDeleteMapping({ userId: 'sub-123', isGM: false, externalId: 'SUB-123' })).toBe(false)
  })

  it('never matches an empty user id', () => {
    expect(canDeleteMapping({ userId: '', isGM: false, externalId: '' })).toBe(false)
  })
})

describe('resolveMappingExternalId', () => {
  it('uses the authenticated user id when the body has no externalId', () => {
    expect(resolveMappingExternalId('sub-123', undefined)).toBe('sub-123')
    expect(resolveMappingExternalId('sub-123', null)).toBe('sub-123')
    expect(resolveMappingExternalId('sub-123', '')).toBe('sub-123')
  })

  it('accepts a body externalId equal to the authenticated user id', () => {
    expect(resolveMappingExternalId('sub-123', 'sub-123')).toBe('sub-123')
  })

  it('rejects a body externalId for a different user', () => {
    expect(resolveMappingExternalId('sub-123', 'sub-999')).toBeNull()
    expect(resolveMappingExternalId('123', 123)).toBeNull()
  })
})
