/**
 * POST /api/admin/db-tunnel/connection
 * Body: { targetId: string }
 *
 * Returns the full SSH + DB connection info for the requested target so the
 * caller can paste it into DBeaver (or any tool that supports SSH tunnels).
 *
 * In v1 the credentials are static and shared across all grantees — the
 * feature grant itself is the access control. The endpoint is still gated
 * per-request so revoking the grant immediately cuts off future fetches.
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getDbTunnelConfig } from '#server/utils/config'

interface Body {
  targetId?: string
}

export default defineEventHandler(async (event) => {
  const { username } = await getAuthenticatedFeatureUser(event, 'admin.db-tunnel')

  const body = await readBody<Body>(event)
  const targetId = body?.targetId
  if (!targetId || typeof targetId !== 'string') {
    throw createError({ statusCode: 400, statusMessage: 'targetId is required' })
  }

  const config = getDbTunnelConfig()
  if (!config.enabled) {
    throw createError({
      statusCode: 503,
      statusMessage: 'DB tunnel is not configured on this server',
    })
  }

  const target = config.targets.find(t => t.id === targetId)
  if (!target) {
    throw createError({ statusCode: 404, statusMessage: `Unknown target: ${targetId}` })
  }

  console.log(`[DbTunnel] ${username} requested connection info for target "${target.id}" (${target.type} ${target.host}:${target.port}/${target.database})`)

  return {
    ssh: {
      host: config.ssh.host,
      port: config.ssh.port,
      username: config.ssh.username,
      privateKey: config.ssh.privateKey,
      hostFingerprint: config.ssh.hostFingerprint,
    },
    target: {
      id: target.id,
      label: target.label,
      type: target.type,
      host: target.host,
      port: target.port,
      database: target.database,
      username: target.username,
      password: target.password,
    },
  }
})
