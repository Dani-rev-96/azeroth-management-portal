import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { isUploadOverwriteFlag, MAX_PUBLIC_UPLOAD_BYTES, receivePublicFileUpload } from '#server/utils/uploads'

/**
 * POST /api/admin/files/upload[?overwrite=1]
 * Upload one file (multipart field `file`) to the public directory (GM only).
 * Streams to a `.part` temp file and renames it into place when complete;
 * responds 409 if the file exists and `overwrite` is not set.
 * Logic lives in server/utils/uploads.ts (receivePublicFileUpload).
 */
export default defineEventHandler(async (event) => {
  await getAuthenticatedFeatureUser(event, 'admin.files')

  const config = useRuntimeConfig()
  const query = getQuery(event)

  try {
    const result = await receivePublicFileUpload(event.node.req, {
      dir: config.public.publicPath,
      overwrite: isUploadOverwriteFlag(query.overwrite),
      maxBytes: MAX_PUBLIC_UPLOAD_BYTES,
    })
    console.log(`[Upload] Stored ${result.filename} (${result.size} bytes${result.replaced ? ', replaced' : ''})`)
    return { success: true, ...result }
  } catch (error: any) {
    if (error?.statusCode) {
      if (error.statusCode >= 500) console.error('[Upload] Failed:', error.statusMessage, error.data?.detail ?? '')
      throw error
    }

    console.error('[Upload] Unexpected error:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to upload file',
      data: { detail: error?.message },
    })
  }
})
