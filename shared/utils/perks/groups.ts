/**
 * Perk group metadata
 *
 * Each group can be toggled via environment variables.
 */

import type { PerkGroupMeta } from './types'

export const PERK_GROUPS: PerkGroupMeta[] = [
  {
    id: 'mount',
    label: 'Mounts & Abilities',
    icon: '🦅',
    description: 'Permanent mount and ability unlocks.',
    envKey: 'NUXT_PERK_GROUP_MOUNT_ENABLED',
  },
  {
    id: 'quest',
    label: 'Quest Skips',
    icon: '📜',
    description: 'Skip long quest chains by receiving key items directly.',
    envKey: 'NUXT_PERK_GROUP_QUEST_ENABLED',
  },
  {
    id: 'buffs',
    label: 'Class Buffs',
    icon: '✨',
    description: 'Receive powerful class buffs applied directly to your character.',
    envKey: 'NUXT_PERK_GROUP_BUFFS_ENABLED',
  },
  {
    id: 'scrolls',
    label: 'Stat Scrolls',
    icon: '📃',
    description: 'Receive stat-boosting scrolls via in-game mail.',
    envKey: 'NUXT_PERK_GROUP_SCROLLS_ENABLED',
  },
  {
    id: 'teleport',
    label: 'Teleport',
    icon: '🌀',
    description: 'Teleport your character to a major capital city. Requires online.',
    envKey: 'NUXT_PERK_GROUP_TELEPORT_ENABLED',
  },
]
