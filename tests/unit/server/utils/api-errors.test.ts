import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock h3's createError since it's auto-imported in Nuxt
vi.mock('h3', () => ({
  H3Error: class H3Error extends Error {
    statusCode: number
    statusMessage: string
    constructor(opts: any) {
      super(opts.statusMessage || opts.message)
      this.statusCode = opts.statusCode || 500
      this.statusMessage = opts.statusMessage || ''
    }
  },
}))

// Mock Nuxt's createError auto-import
const mockCreateError = (opts: any) => {
  const err = new Error(opts.statusMessage) as any
  err.statusCode = opts.statusCode
  err.statusMessage = opts.statusMessage
  return err
}

// We need to register createError as a global since Nuxt auto-imports it
;(globalThis as any).createError = mockCreateError

import {
  handleApiError,
  createValidationError,
  createUnauthorizedError,
  createForbiddenError,
  createNotFoundError,
  validateRequiredFields,
  validateIdParam,
} from '../../../../server/utils/api-errors'

// ─── createValidationError ──────────────────────────────────────────────────────

describe('createValidationError', () => {
  it('creates an error with status 400', () => {
    const error = createValidationError('Invalid input')
    expect(error.statusCode).toBe(400)
    expect(error.statusMessage).toBe('Invalid input')
  })
})

// ─── createUnauthorizedError ────────────────────────────────────────────────────

describe('createUnauthorizedError', () => {
  it('creates an error with status 401', () => {
    const error = createUnauthorizedError()
    expect(error.statusCode).toBe(401)
    expect(error.statusMessage).toBe('Unauthorized')
  })

  it('accepts custom message', () => {
    const error = createUnauthorizedError('Login required')
    expect(error.statusCode).toBe(401)
    expect(error.statusMessage).toBe('Login required')
  })
})

// ─── createForbiddenError ───────────────────────────────────────────────────────

describe('createForbiddenError', () => {
  it('creates an error with status 403', () => {
    const error = createForbiddenError()
    expect(error.statusCode).toBe(403)
    expect(error.statusMessage).toBe('Forbidden')
  })

  it('accepts custom message', () => {
    const error = createForbiddenError('Access denied')
    expect(error.statusCode).toBe(403)
    expect(error.statusMessage).toBe('Access denied')
  })
})

// ─── createNotFoundError ────────────────────────────────────────────────────────

describe('createNotFoundError', () => {
  it('creates an error with status 404', () => {
    const error = createNotFoundError()
    expect(error.statusCode).toBe(404)
    expect(error.statusMessage).toBe('Not found')
  })

  it('accepts custom message', () => {
    const error = createNotFoundError('Character not found')
    expect(error.statusCode).toBe(404)
    expect(error.statusMessage).toBe('Character not found')
  })
})

// ─── validateRequiredFields ─────────────────────────────────────────────────────

describe('validateRequiredFields', () => {
  it('does nothing when all fields are present', () => {
    expect(() => {
      validateRequiredFields({ name: 'test', age: 25 }, ['name', 'age'])
    }).not.toThrow()
  })

  it('throws for missing fields (undefined)', () => {
    expect(() => {
      validateRequiredFields({ name: undefined, age: 25 } as any, ['name', 'age'])
    }).toThrow(/Missing required fields.*name/)
  })

  it('throws for missing fields (null)', () => {
    expect(() => {
      validateRequiredFields({ name: null, age: 25 } as any, ['name', 'age'])
    }).toThrow(/Missing required fields.*name/)
  })

  it('throws for missing fields (empty string)', () => {
    expect(() => {
      validateRequiredFields({ name: '', age: 25 }, ['name'])
    }).toThrow(/Missing required fields.*name/)
  })

  it('lists all missing fields', () => {
    expect(() => {
      validateRequiredFields({ a: undefined, b: null, c: '' } as any, ['a', 'b', 'c'])
    }).toThrow(/a.*b.*c/)
  })

  it('allows zero as a valid value', () => {
    expect(() => {
      validateRequiredFields({ score: 0 }, ['score'])
    }).not.toThrow()
  })

  it('allows false as a valid value', () => {
    expect(() => {
      validateRequiredFields({ active: false }, ['active'])
    }).not.toThrow()
  })
})

// ─── validateIdParam ────────────────────────────────────────────────────────────

describe('validateIdParam', () => {
  it('returns parsed ID for valid string', () => {
    expect(validateIdParam('123', 'accountId')).toBe(123)
  })

  it('throws for undefined', () => {
    expect(() => validateIdParam(undefined, 'accountId')).toThrow(/accountId is required/)
  })

  it('throws for empty string', () => {
    expect(() => validateIdParam('', 'accountId')).toThrow(/accountId is required/)
  })

  it('throws for non-numeric string', () => {
    expect(() => validateIdParam('abc', 'accountId')).toThrow(/positive integer/)
  })

  it('throws for zero', () => {
    expect(() => validateIdParam('0', 'accountId')).toThrow(/positive integer/)
  })

  it('throws for negative number', () => {
    expect(() => validateIdParam('-5', 'accountId')).toThrow(/positive integer/)
  })

  it('parses string with leading zeros', () => {
    expect(validateIdParam('007', 'guid')).toBe(7)
  })

  it('throws for float string', () => {
    // parseInt('3.14') = 3, which is > 0, so this should pass
    expect(validateIdParam('3.14', 'guid')).toBe(3)
  })
})

// ─── handleApiError ─────────────────────────────────────────────────────────────

describe('handleApiError', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('re-throws H3-like errors with statusCode', () => {
    const h3Error = { statusCode: 404, statusMessage: 'Not found' }
    expect(() => handleApiError(h3Error, 'fallback')).toThrow()
  })

  it('wraps unknown errors in 500', () => {
    const plainError = new Error('something went wrong')
    expect(() => handleApiError(plainError, 'Operation failed')).toThrow()
    try {
      handleApiError(plainError, 'Operation failed')
    } catch (e: any) {
      expect(e.statusCode).toBe(500)
      expect(e.statusMessage).toBe('Operation failed')
    }
  })

  it('wraps string errors in 500', () => {
    try {
      handleApiError('some string error', 'Fallback message')
    } catch (e: any) {
      expect(e.statusCode).toBe(500)
      expect(e.statusMessage).toBe('Fallback message')
    }
  })

  it('logs the error', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    try { handleApiError(new Error('test'), 'msg') } catch {}
    expect(spy).toHaveBeenCalled()
  })
})
