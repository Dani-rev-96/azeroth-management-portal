/**
 * POST /api/characters/learn-mount
 *
 * DEPRECATED — Forwards to the unified /api/characters/activate-perk endpoint.
 * Kept for backwards compatibility.
 */

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  // Forward to unified endpoint
  const response = await $fetch('/api/characters/activate-perk', {
    method: 'POST',
    headers: Object.fromEntries(
      Object.entries(event.node.req.headers).filter(([, v]) => typeof v === 'string') as [string, string][],
    ),
    body: {
      perkId: 'flying',
      characterGuid: body.characterGuid,
      realmId: body.realmId,
    },
  })

  return response
})
