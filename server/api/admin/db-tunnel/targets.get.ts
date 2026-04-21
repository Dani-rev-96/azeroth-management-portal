/**
 * GET /api/admin/db-tunnel/targets
 * List DB targets available through the SSH tunnel. Metadata only — no
 * credentials are returned from this endpoint.
 */
import { getAuthenticatedFeatureUser } from '#server/utils/auth'
import { getDbTunnelConfig } from '#server/utils/config'

export default defineEventHandler(async (event) => {
  await getAuthenticatedFeatureUser(event, 'admin.db-tunnel')

  const config = getDbTunnelConfig()

  return {
    enabled: config.enabled,
    targets: config.targets.map(t => ({
      id: t.id,
      label: t.label,
      type: t.type,
      database: t.database,
    })),
  }
})
