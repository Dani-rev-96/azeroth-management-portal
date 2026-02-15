/**
 * POST /api/characters/grant-item
 *
 * DEPRECATED — Forwards to the unified /api/characters/activate-perk endpoint.
 * Kept for backwards compatibility. Maps known item IDs to perk IDs.
 */

const ITEM_TO_PERK: Record<number, string> = {
  16309: 'drakefire',
}

export default defineEventHandler(async (event) => {
  const body = await readBody(event)
  const perkId = ITEM_TO_PERK[body.itemId]

  if (!perkId) {
    throw createError({ statusCode: 400, statusMessage: 'This item cannot be granted as a perk.' })
  }

  const response = await $fetch('/api/characters/activate-perk', {
    method: 'POST',
    headers: Object.fromEntries(
      Object.entries(event.node.req.headers).filter(([, v]) => typeof v === 'string') as [string, string][],
    ),
    body: {
      perkId,
      characterGuid: body.characterGuid,
      realmId: body.realmId,
    },
  })

  return response
})
