import { handlePublicFileDownload } from '#server/utils/downloads'

/**
 * GET|HEAD /api/downloads/[filename]
 * Stream a file from the public directory with Range/If-Range/ETag support.
 * Logic lives in server/utils/downloads.ts (handlePublicFileDownload).
 */
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  await handlePublicFileDownload(event.node.req, event.node.res, {
    dir: config.public.publicPath,
    filename: getRouterParam(event, 'filename', { decode: true }),
  })
})
