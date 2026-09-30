import type { Server } from 'node:http'
import { disableRequestTimeout } from '#server/utils/uploads'

/**
 * Node's http.Server kills requests that take longer than `requestTimeout`
 * (300 s by default), which aborts large uploads. Nitro does not expose the
 * server, so grab it from the first request's socket and disable the limit.
 * headersTimeout stays in place to protect against slowloris.
 */
export default defineNitroPlugin((nitroApp) => {
  let done = false
  nitroApp.hooks.hook('request', (event) => {
    if (done) return
    const server = (event.node.req.socket as { server?: Server } | undefined)?.server
    if (!server) return
    done = true
    if (disableRequestTimeout(server)) {
      console.log('[http] requestTimeout disabled for long uploads/downloads')
    }
  })
})
