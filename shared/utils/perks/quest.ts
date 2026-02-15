/**
 * Quest perks — Attunement / quest chain skips
 */

import type { PerkDefinition } from './types'

export const QUEST_PERKS: PerkDefinition[] = [
  {
    id: 'drakefire',
    group: 'quest',
    name: 'Drakefire Amulet',
    icon: '🐉',
    description: "Receive the Drakefire Amulet — grants access to Onyxia's Lair without completing the attunement chain.",
    successMessage: 'Drakefire Amulet has been sent! Check your in-game mailbox.',
    deliveryType: 'item',
    gameId: 16309,
    requiredLevel: 0,
    requiresOnline: true,
    oneTime: true,
    defaultDiceSides: 15,
    defaultRollThreshold: 8,
    defaultDailyLimit: 0,
    accent: 'orange',
    mailSubject: 'Drakefire Amulet',
    mailBody: 'The power of the Drakefire Amulet has been bestowed upon you. Use it wisely, hero.',
    itemCount: 1,
    envPrefix: 'DRAKEFIRE',
  },
]
