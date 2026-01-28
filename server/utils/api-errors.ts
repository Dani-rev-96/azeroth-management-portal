/**
 * API Error Handling Utilities
 * Consistent error handling across API routes
 */

import { H3Error } from 'h3'

/**
 * Handle API errors with consistent formatting
 * Re-throws H3 errors, wraps others in 500 error
 */
export function handleApiError(error: unknown, fallbackMessage: string): never {
  console.error(fallbackMessage, error)

  // If it's already an H3 error, re-throw it
  if (error instanceof H3Error) {
    throw error
  }

  // Check if it looks like an H3 error object
  if (error && typeof error === 'object' && 'statusCode' in error) {
    throw error
  }

  // Wrap unknown errors
  throw createError({
    statusCode: 500,
    statusMessage: fallbackMessage,
  })
}

/**
 * Create a validation error with 400 status
 */
export function createValidationError(message: string): H3Error {
  return createError({
    statusCode: 400,
    statusMessage: message,
  })
}

/**
 * Create an unauthorized error with 401 status
 */
export function createUnauthorizedError(message: string = 'Unauthorized'): H3Error {
  return createError({
    statusCode: 401,
    statusMessage: message,
  })
}

/**
 * Create a forbidden error with 403 status
 */
export function createForbiddenError(message: string = 'Forbidden'): H3Error {
  return createError({
    statusCode: 403,
    statusMessage: message,
  })
}

/**
 * Create a not found error with 404 status
 */
export function createNotFoundError(message: string = 'Not found'): H3Error {
  return createError({
    statusCode: 404,
    statusMessage: message,
  })
}

/**
 * Validate required body fields
 */
export function validateRequiredFields<T extends Record<string, unknown>>(
  body: T,
  fields: (keyof T)[]
): void {
  const missing = fields.filter(field => body[field] === undefined || body[field] === null || body[field] === '')

  if (missing.length > 0) {
    throw createValidationError(`Missing required fields: ${missing.join(', ')}`)
  }
}

/**
 * Validate ID parameter
 */
export function validateIdParam(value: string | undefined, name: string): number {
  if (!value) {
    throw createValidationError(`${name} is required`)
  }

  const id = parseInt(value, 10)

  if (isNaN(id) || id <= 0) {
    throw createValidationError(`${name} must be a positive integer`)
  }

  return id
}
