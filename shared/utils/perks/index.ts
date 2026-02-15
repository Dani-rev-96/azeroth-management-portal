/**
 * Centralized Perk Registry — Barrel export
 *
 * Re-exports types, group metadata, per-group perk arrays,
 * the combined PERK_REGISTRY, and helper look-up functions.
 *
 * Import from '~~/shared/utils/perks' (unchanged for consumers).
 */

// ─── Re-export types ──────────────────────────────────
export type { PerkGroup, PerkDeliveryType, PerkDefinition, PerkGroupMeta } from './types'

// ─── Re-export group metadata ─────────────────────────
export { PERK_GROUPS } from './groups'

// ─── Re-export per-group perk arrays (for direct access) ──
export { MOUNT_PERKS } from './mount'
export { QUEST_PERKS } from './quest'
export { BUFF_PERKS } from './buffs'
export { SCROLL_PERKS } from './scrolls'
export { TELEPORT_PERKS } from './teleport'

// ─── Combined registry ───────────────────────────────
import type { PerkDefinition, PerkGroup, PerkGroupMeta } from './types'
import { PERK_GROUPS } from './groups'
import { MOUNT_PERKS } from './mount'
import { QUEST_PERKS } from './quest'
import { BUFF_PERKS } from './buffs'
import { SCROLL_PERKS } from './scrolls'
import { TELEPORT_PERKS } from './teleport'

/**
 * All perks across all groups, in display order.
 * Built by concatenating the per-group arrays.
 */
export const PERK_REGISTRY: PerkDefinition[] = [
  ...MOUNT_PERKS,
  ...QUEST_PERKS,
  ...BUFF_PERKS,
  ...SCROLL_PERKS,
  ...TELEPORT_PERKS,
]

// ─── Helper functions ─────────────────────────────────

/** Look up a perk by its unique ID */
export function getPerkById(id: string): PerkDefinition | undefined {
  return PERK_REGISTRY.find(p => p.id === id)
}

/** Get all perks in a specific group */
export function getPerksByGroup(group: PerkGroup): PerkDefinition[] {
  return PERK_REGISTRY.filter(p => p.group === group)
}

/** Get the group metadata by group ID */
export function getPerkGroupMeta(group: PerkGroup): PerkGroupMeta | undefined {
  return PERK_GROUPS.find(g => g.id === group)
}

/** Get all unique group IDs that have at least one perk */
export function getActiveGroups(): PerkGroup[] {
  const groups = new Set(PERK_REGISTRY.map(p => p.group))
  // Preserve display order from PERK_GROUPS
  return PERK_GROUPS.filter(g => groups.has(g.id)).map(g => g.id)
}
