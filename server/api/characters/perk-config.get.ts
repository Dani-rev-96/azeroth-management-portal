/**
 * GET /api/characters/perk-config
 * Returns the public-facing perk configuration (dice sizes, thresholds, level requirements).
 * This allows the frontend to show accurate roll info without hardcoding values.
 */

export default defineEventHandler(async () => {
  const { getPerkConfig } = await import('#server/utils/config')
  const config = getPerkConfig()

  return {
    perks: {
      flying: {
        requiredLevel: config.flyingRequiredLevel,
        diceSides: config.flyingDiceSides,
        rollThreshold: config.flyingRollThreshold,
      },
      drakefire: {
        diceSides: config.drakefireDiceSides,
        rollThreshold: config.drakefireRollThreshold,
      },
    },
    penalties: {
      failDebuff: 'Weakened (10 min debuff)',
      critFailDebuff: 'Resurrection Sickness (10 min)',
    },
  }
})
