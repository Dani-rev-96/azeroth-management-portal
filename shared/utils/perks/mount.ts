/**
 * Mount & Ability perks — Permanent ability unlocks
 */

import type { PerkDefinition } from './types'

export const MOUNT_PERKS: PerkDefinition[] = [
  {
    id: 'flying',
    group: 'mount',
    name: 'Old World Flying',
    icon: '🦅',
    description: 'Learn the ability to fly in Kalimdor and the Eastern Kingdoms.',
    successMessage: 'Old World Flying has been unlocked!',
    deliveryType: 'spell',
    gameId: 31700, // Old World Flying spell
    requiredLevel: 60,
    requiresOnline: true,
    oneTime: true,
    defaultDiceSides: 20,
    defaultRollThreshold: 8,
    defaultDailyLimit: 0, // unlimited attempts (one-time perk)
    accent: 'purple',
    envPrefix: 'FLYING',
  },
]
