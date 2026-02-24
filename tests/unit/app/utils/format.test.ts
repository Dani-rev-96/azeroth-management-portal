import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  capitalize,
  truncate,
  formatNumber,
  formatPercentage,
  pluralize,
  debounce,
} from '../../../../app/utils/format'

// ─── capitalize ─────────────────────────────────────────────────────────────────

describe('capitalize', () => {
  it('capitalizes the first letter of a lowercase string', () => {
    expect(capitalize('hello')).toBe('Hello')
  })

  it('returns empty string for empty input', () => {
    expect(capitalize('')).toBe('')
  })

  it('handles already capitalized string', () => {
    expect(capitalize('Hello')).toBe('Hello')
  })

  it('handles single character', () => {
    expect(capitalize('a')).toBe('A')
  })

  it('does not change the rest of the string', () => {
    expect(capitalize('hELLO wORLD')).toBe('HELLO wORLD')
  })

  it('handles string starting with number', () => {
    expect(capitalize('123abc')).toBe('123abc')
  })

  it('handles string with special characters', () => {
    expect(capitalize('!test')).toBe('!test')
  })
})

// ─── truncate ───────────────────────────────────────────────────────────────────

describe('truncate', () => {
  it('returns the string unchanged if shorter than maxLength', () => {
    expect(truncate('hello', 10)).toBe('hello')
  })

  it('returns the string unchanged if equal to maxLength', () => {
    expect(truncate('hello', 5)).toBe('hello')
  })

  it('truncates and adds ellipsis when longer than maxLength', () => {
    expect(truncate('hello world', 8)).toBe('hello...')
  })

  it('handles empty string', () => {
    expect(truncate('', 5)).toBe('')
  })

  it('handles maxLength of 3 (minimum for ellipsis)', () => {
    expect(truncate('hello', 3)).toBe('...')
  })

  it('handles maxLength of 4', () => {
    expect(truncate('hello', 4)).toBe('h...')
  })

  it('handles very long strings', () => {
    const long = 'a'.repeat(1000)
    const result = truncate(long, 10)
    expect(result.length).toBe(10)
    expect(result.endsWith('...')).toBe(true)
  })
})

// ─── formatNumber ───────────────────────────────────────────────────────────────

describe('formatNumber', () => {
  it('formats small numbers without separators', () => {
    expect(formatNumber(42)).toBe('42')
  })

  it('formats thousands with locale separator', () => {
    // toLocaleString is locale-dependent; just verify it's a string
    const result = formatNumber(1234567)
    expect(result).toBeTruthy()
    expect(result).toContain('1')
    expect(result).toContain('234')
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })

  it('formats negative numbers', () => {
    const result = formatNumber(-1234)
    expect(result).toContain('1')
    expect(result).toContain('234')
  })
})

// ─── formatPercentage ───────────────────────────────────────────────────────────

describe('formatPercentage', () => {
  it('calculates basic percentage', () => {
    expect(formatPercentage(50, 100)).toBe('50.0%')
  })

  it('returns 0% when total is zero', () => {
    expect(formatPercentage(50, 0)).toBe('0%')
  })

  it('handles 100%', () => {
    expect(formatPercentage(100, 100)).toBe('100.0%')
  })

  it('handles fractional percentages', () => {
    expect(formatPercentage(1, 3)).toBe('33.3%')
  })

  it('respects custom decimal places', () => {
    expect(formatPercentage(1, 3, 2)).toBe('33.33%')
  })

  it('handles zero decimals', () => {
    expect(formatPercentage(50, 100, 0)).toBe('50%')
  })

  it('handles value greater than total', () => {
    expect(formatPercentage(200, 100)).toBe('200.0%')
  })
})

// ─── pluralize ──────────────────────────────────────────────────────────────────

describe('pluralize', () => {
  it('returns singular for count of 1', () => {
    expect(pluralize(1, 'item')).toBe('item')
  })

  it('returns plural with -s for count of 0', () => {
    expect(pluralize(0, 'item')).toBe('items')
  })

  it('returns plural with -s for count > 1', () => {
    expect(pluralize(5, 'item')).toBe('items')
  })

  it('uses custom plural form', () => {
    expect(pluralize(2, 'child', 'children')).toBe('children')
  })

  it('uses custom plural form for 0', () => {
    expect(pluralize(0, 'person', 'people')).toBe('people')
  })

  it('returns singular for count of 1 with custom plural', () => {
    expect(pluralize(1, 'child', 'children')).toBe('child')
  })

  it('handles negative counts as plural', () => {
    expect(pluralize(-1, 'item')).toBe('items')
  })
})

// ─── debounce ───────────────────────────────────────────────────────────────────

describe('debounce', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not call function immediately', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced()
    expect(fn).not.toHaveBeenCalled()
  })

  it('calls function after delay', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced()
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('resets timer on subsequent calls', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced()
    vi.advanceTimersByTime(50)
    debounced()
    vi.advanceTimersByTime(50)
    expect(fn).not.toHaveBeenCalled()

    vi.advanceTimersByTime(50)
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('passes arguments to the original function', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('hello', 42)
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledWith('hello', 42)
  })

  it('uses the last call arguments', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('first')
    debounced('second')
    debounced('third')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledWith('third')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('can be called again after delay', () => {
    const fn = vi.fn()
    const debounced = debounce(fn, 100)

    debounced('call1')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(1)

    debounced('call2')
    vi.advanceTimersByTime(100)
    expect(fn).toHaveBeenCalledTimes(2)
  })
})
