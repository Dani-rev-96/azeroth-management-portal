import { createWriteStream } from 'fs'
import { promises as fs } from 'fs'
import { join, basename } from 'path'
import Busboy from 'busboy'
import type { Readable } from 'stream'

/**
 * POST /api/admin/files/upload
 * Upload a file to the public directory (GM only)
 * Supports large files (up to 50GB) via streaming - does NOT load file into memory
 */
export default defineEventHandler(async (event) => {
  try {
    // Authenticate and check GM status
    await getAuthenticatedGM(event)

    const config = useRuntimeConfig()
    const publicDir = config.public.publicPath

    console.log('Upload attempt - publicDir:', publicDir)

    // Ensure directory exists
    try {
      await fs.mkdir(publicDir, { recursive: true })
    } catch (mkdirError: any) {
      console.error('Failed to create directory:', mkdirError)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to create upload directory',
        data: { detail: mkdirError.message },
      })
    }

    // Get the raw request from event
    const contentType = getHeader(event, 'content-type')

    if (!contentType || !contentType.includes('multipart/form-data')) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid content type',
        data: { detail: 'Expected multipart/form-data' },
      })
    }

    // Stream the request body with busboy
    return new Promise((resolve, reject) => {
      const busboy = Busboy({
        headers: {
          'content-type': contentType,
        },
        limits: {
          fileSize: 53687091200, // 50GB limit
        },
      })

      let uploadedFile: { filename: string; size: number } | null = null
      let hasError = false

      busboy.on('file', (fieldname, fileStream, info) => {
        const { filename, encoding, mimeType } = info

        if (!filename) {
          fileStream.resume() // Drain the stream
          reject(createError({
            statusCode: 400,
            statusMessage: 'No filename provided',
          }))
          hasError = true
          return
        }

        // Security: sanitize filename
        const safeFilename = basename(filename)
        const filePath = join(publicDir, safeFilename)

        console.log('Streaming file:', {
          safeFilename,
          filePath,
          encoding,
          mimeType
        })

        const writeStream = createWriteStream(filePath)
        let uploadedBytes = 0

        fileStream.on('data', (chunk) => {
          uploadedBytes += chunk.length
        })

        fileStream.on('limit', () => {
          writeStream.destroy()
          fs.unlink(filePath).catch(() => {}) // Clean up partial file
          reject(createError({
            statusCode: 413,
            statusMessage: 'File too large',
            data: { detail: 'Maximum file size is 50GB' },
          }))
          hasError = true
        })

        fileStream.on('error', (error) => {
          console.error('File stream error:', error)
          writeStream.destroy()
          fs.unlink(filePath).catch(() => {})
          reject(createError({
            statusCode: 500,
            statusMessage: 'Stream error',
            data: { detail: error.message },
          }))
          hasError = true
        })

        writeStream.on('error', (error) => {
          console.error('Write stream error:', error)
          fs.unlink(filePath).catch(() => {})
          reject(createError({
            statusCode: 500,
            statusMessage: 'Failed to write file',
            data: { detail: error.message },
          }))
          hasError = true
        })

        writeStream.on('finish', () => {
          if (!hasError) {
            uploadedFile = {
              filename: safeFilename,
              size: uploadedBytes,
            }
            console.log('File write complete:', uploadedFile)
          }
        })

        // Pipe the file stream to disk
        fileStream.pipe(writeStream)
      })

      busboy.on('finish', () => {
        if (!hasError && uploadedFile) {
          resolve({
            success: true,
            filename: uploadedFile.filename,
            size: uploadedFile.size,
          })
        } else if (!hasError) {
          reject(createError({
            statusCode: 400,
            statusMessage: 'No file uploaded',
          }))
        }
      })

      busboy.on('error', (error) => {
        console.error('Busboy error:', error)
        reject(createError({
          statusCode: 500,
          statusMessage: 'Upload parsing error',
          data: { detail: error.message },
        }))
      })

      // Get the request body as a readable stream and pipe to busboy
      const nodeReq = event.node.req as Readable
      nodeReq.pipe(busboy)
    })
  } catch (error: any) {
    // Log detailed error for debugging
    console.error('Error uploading file:', {
      message: error.message,
      stack: error.stack,
      statusCode: error.statusCode,
    })

    if (error.statusCode) {
      throw error
    }

    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to upload file',
      data: { detail: error.message },
    })
  }
})
