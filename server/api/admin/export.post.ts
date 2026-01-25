import { exportMappings, exportForDirectus, exportToSQL } from '#server/utils/export'

/**
 * POST /api/admin/export
 * Export account mappings for backup or migration
 * Body: { format: 'json' | 'directus' | 'postgres' | 'mysql' }
 */
export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const format = body.format || 'json'

  try {
    let result

    switch (format) {
      case 'directus':
        result = exportForDirectus()
        break
      case 'postgres':
        result = exportToSQL('postgres')
        break
      case 'mysql':
        result = exportToSQL('mysql')
        break
      case 'json':
      default:
        result = exportMappings()
        break
    }

    return {
      success: true,
      ...result,
    }
  } catch (error) {
    console.error('Export error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to export mappings',
    })
  }
})
