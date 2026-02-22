/**
 * GET /api/characters/perk-config
 *
 * Returns the full public-facing perk configuration.
 * Combines the shared perk registry with resolved server config (env overrides).
 * The frontend uses this to render all available perk cards with accurate roll info.
 *
 * Only returns perks whose group is enabled.
 */

import { PERK_GROUPS, getActiveGroups, getPerksByGroup, type PerkGroup } from '#shared/utils/perks'

export default defineEventHandler(async () => {
  const { getPerkConfigAsync, getPerkRegistryAsync, getPerkGroupsAsync } = await import('#server/utils/config')
  const config = await getPerkConfigAsync()
  const registry = await getPerkRegistryAsync()
  const groupsMeta = await getPerkGroupsAsync()

  // Build the response — only include groups that are enabled
  const groups: Array<{
    id: PerkGroup
    label: string
    icon: string
    description: string
    perks: Array<{
      id: string
      name: string
      icon: string
      description: string
      successMessage: string
      deliveryType: string
      requiredLevel: number
      requiresOnline: boolean
      oneTime: boolean
      accent: string
      diceSides: number
      rollThreshold: number
      dailyLimit: number
      rankGroup?: string
    }>
  }> = []

  for (const groupId of getActiveGroups()) {
    if (!config.groups[groupId]?.enabled) continue

    const groupMeta = groupsMeta.find(g => g.id === groupId)!
    const perks = registry.filter(p => p.group === groupId)

    groups.push({
      id: groupId,
      label: groupMeta.label,
      icon: groupMeta.icon,
      description: groupMeta.description,
      perks: perks.map(perk => {
        const resolved = config.perks[perk.id]!
        return {
          id: perk.id,
          name: perk.name,
          icon: perk.icon,
          description: perk.description,
          successMessage: perk.successMessage,
          deliveryType: perk.deliveryType,
          requiredLevel: resolved.requiredLevel,
          requiresOnline: perk.requiresOnline,
          oneTime: perk.oneTime,
          accent: perk.accent,
          diceSides: resolved.diceSides,
          rollThreshold: resolved.rollThreshold,
          dailyLimit: resolved.dailyLimit,
          rankGroup: perk.rankGroup,
        }
      }),
    })
  }

  return {
    groups,
    penalties: {
      failDebuff: 'Weakened (10 min debuff)',
      critFailDebuff: 'Resurrection Sickness (10 min)',
    },
  }
})

