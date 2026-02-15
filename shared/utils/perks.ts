/**
 * Centralized Perk Registry
 *
 * Defines all character perks used by both server and frontend.
 * Each perk belongs to a group that can be toggled via environment variables.
 *
 * Delivery types:
 * - 'spell'  → Inserts into web_spell_requests (Eluna teaches the spell permanently)
 * - 'item'   → Inserts into web_item_requests (mailed to the character)
 * - 'aura'   → Inserts into web_aura_requests (temporary buff applied in-game)
 *
 * Groups (toggleable via NUXT_PERK_GROUP_<GROUP>_ENABLED):
 * - mount   → Permanent mount/ability unlocks
 * - quest   → Quest chain skip items
 * - buffs   → Class buff auras (temporary, repeatable)
 * - scrolls → Stat scroll items (mailed, repeatable)
 */

// ─── Types ────────────────────────────────────────────

export type PerkGroup = 'mount' | 'quest' | 'buffs' | 'scrolls'

export type PerkDeliveryType = 'spell' | 'item' | 'aura'

export interface PerkDefinition {
  /** Unique machine-readable perk identifier */
  id: string
  /** Which group this perk belongs to (used for enable/disable) */
  group: PerkGroup
  /** Display name shown in the UI */
  name: string
  /** UI icon (emoji) */
  icon: string
  /** Description shown when the perk is available */
  description: string
  /** Message shown on successful activation */
  successMessage: string
  /** How the perk is delivered in-game */
  deliveryType: PerkDeliveryType
  /** Spell ID (for spell/aura types) OR item entry (for item type) */
  gameId: number
  /** For aura delivery: duration in ms (0 = permanent) */
  auraDurationMs?: number
  /** Minimum character level required (0 = no requirement) */
  requiredLevel: number
  /** Whether the character must be online */
  requiresOnline: boolean
  /** Whether this perk can only be activated once (permanent unlock) */
  oneTime: boolean
  /** Default dice sides (e.g. 20 = d20) */
  defaultDiceSides: number
  /** Default minimum roll to succeed */
  defaultRollThreshold: number
  /** Default max activations per day (0 = unlimited) */
  defaultDailyLimit: number
  /** UI accent color */
  accent: string
  /** For item delivery: mail subject */
  mailSubject?: string
  /** For item delivery: mail body text */
  mailBody?: string
  /** For item delivery: how many to send */
  itemCount?: number
  /** Environment variable prefix for overriding dice/threshold/daily (e.g. 'FLYING' → NUXT_PERK_FLYING_DICE_SIDES) */
  envPrefix: string
}

// ─── Group metadata ───────────────────────────────────

export interface PerkGroupMeta {
  id: PerkGroup
  label: string
  icon: string
  description: string
  /** Environment variable to toggle this group: NUXT_PERK_GROUP_<ID>_ENABLED */
  envKey: string
}

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
]

// ─── Perk definitions ─────────────────────────────────

export const PERK_REGISTRY: PerkDefinition[] = [
  // ════════════════════════════════════════════
  //  GROUP: mount — Permanent ability unlocks
  // ════════════════════════════════════════════
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

  // ════════════════════════════════════════════
  //  GROUP: quest — Attunement / quest chain skips
  // ════════════════════════════════════════════
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

  // ════════════════════════════════════════════
  //  GROUP: buffs — Class buffs (aura-based, repeatable)
  //  Applied via Eluna player:AddAura()
  // ════════════════════════════════════════════

  // ── Druid ──
  {
    id: 'buff-mark-of-the-wild',
    group: 'buffs',
    name: 'Gift of the Wild',
    icon: '🌿',
    description: '+37 all attributes, +54 all resistances, +750 armor. Lasts 1 hour.',
    successMessage: 'Gift of the Wild has been applied!',
    deliveryType: 'aura',
    gameId: 48470, // Gift of the Wild (Rank 4) — 1hr party/raid version
    auraDurationMs: 3600000,
    requiredLevel: 0,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'green',
    envPrefix: 'BUFF_MOTW',
  },

  // ── Priest ──
  {
    id: 'buff-fortitude',
    group: 'buffs',
    name: 'Prayer of Fortitude',
    icon: '🛡️',
    description: '+165 Stamina. Lasts 1 hour.',
    successMessage: 'Prayer of Fortitude has been applied!',
    deliveryType: 'aura',
    gameId: 48162, // Prayer of Fortitude (Rank 4)
    auraDurationMs: 3600000,
    requiredLevel: 0,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'blue',
    envPrefix: 'BUFF_FORT',
  },
  {
    id: 'buff-divine-spirit',
    group: 'buffs',
    name: 'Prayer of Spirit',
    icon: '💫',
    description: '+80 Spirit. Lasts 1 hour.',
    successMessage: 'Prayer of Spirit has been applied!',
    deliveryType: 'aura',
    gameId: 48074, // Prayer of Spirit (Rank 3)
    auraDurationMs: 3600000,
    requiredLevel: 0,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'blue',
    envPrefix: 'BUFF_SPIRIT',
  },
  {
    id: 'buff-shadow-protection',
    group: 'buffs',
    name: 'Prayer of Shadow Protection',
    icon: '🌑',
    description: '+130 Shadow Resistance. Lasts 20 min.',
    successMessage: 'Prayer of Shadow Protection has been applied!',
    deliveryType: 'aura',
    gameId: 48170, // Prayer of Shadow Protection (Rank 3)
    auraDurationMs: 1200000,
    requiredLevel: 0,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'purple',
    envPrefix: 'BUFF_SHADOW_PROT',
  },

  // ── Mage ──
  {
    id: 'buff-arcane-intellect',
    group: 'buffs',
    name: 'Arcane Intellect',
    icon: '🔮',
    description: '+60 Intellect. Lasts 30 min.',
    successMessage: 'Arcane Intellect has been applied!',
    deliveryType: 'aura',
    gameId: 42995, // Arcane Intellect (Rank 7)
    auraDurationMs: 1800000,
    requiredLevel: 0,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'blue',
    envPrefix: 'BUFF_AI',
  },

  // ── Paladin ──
  {
    id: 'buff-blessing-of-kings',
    group: 'buffs',
    name: 'Greater Blessing of Kings',
    icon: '👑',
    description: '+10% all stats. Lasts 30 min.',
    successMessage: 'Greater Blessing of Kings has been applied!',
    deliveryType: 'aura',
    gameId: 25898, // Greater Blessing of Kings
    auraDurationMs: 1800000,
    requiredLevel: 0,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'orange',
    envPrefix: 'BUFF_KINGS',
  },
  {
    id: 'buff-blessing-of-might',
    group: 'buffs',
    name: 'Greater Blessing of Might',
    icon: '⚔️',
    description: '+550 Attack Power. Lasts 30 min.',
    successMessage: 'Greater Blessing of Might has been applied!',
    deliveryType: 'aura',
    gameId: 48934, // Greater Blessing of Might (Rank 5)
    auraDurationMs: 1800000,
    requiredLevel: 0,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'red',
    envPrefix: 'BUFF_MIGHT',
  },
  {
    id: 'buff-blessing-of-wisdom',
    group: 'buffs',
    name: 'Greater Blessing of Wisdom',
    icon: '📘',
    description: '+92 mana per 5 seconds. Lasts 30 min.',
    successMessage: 'Greater Blessing of Wisdom has been applied!',
    deliveryType: 'aura',
    gameId: 48938, // Greater Blessing of Wisdom (Rank 4)
    auraDurationMs: 1800000,
    requiredLevel: 0,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'blue',
    envPrefix: 'BUFF_WISDOM',
  },

  // ════════════════════════════════════════════
  //  GROUP: scrolls — Stat scrolls (item-based, repeatable)
  //  Mailed via web_item_requests
  //  Two tiers: VII (level 60+) and VIII (level 70+)
  // ════════════════════════════════════════════

  // ── Intellect ──
  {
    id: 'scroll-intellect-vii',
    group: 'scrolls',
    name: 'Scroll of Intellect VII',
    icon: '📜',
    description: '+32 Intellect for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Intellect VII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 37091,
    requiredLevel: 60,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 4,
    defaultRollThreshold: 2,
    defaultDailyLimit: 5,
    accent: 'blue',
    mailSubject: 'Scroll of Intellect VII',
    mailBody: 'A scroll of power arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_INT_VII',
  },
  {
    id: 'scroll-intellect-viii',
    group: 'scrolls',
    name: 'Scroll of Intellect VIII',
    icon: '📜',
    description: '+48 Intellect for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Intellect VIII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 37092,
    requiredLevel: 70,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'blue',
    mailSubject: 'Scroll of Intellect VIII',
    mailBody: 'A scroll of greater power arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_INT_VIII',
  },

  // ── Strength ──
  {
    id: 'scroll-strength-vii',
    group: 'scrolls',
    name: 'Scroll of Strength VII',
    icon: '📜',
    description: '+25 Strength for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Strength VII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 43465,
    requiredLevel: 60,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 4,
    defaultRollThreshold: 2,
    defaultDailyLimit: 5,
    accent: 'red',
    mailSubject: 'Scroll of Strength VII',
    mailBody: 'A scroll of might arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_STR_VII',
  },
  {
    id: 'scroll-strength-viii',
    group: 'scrolls',
    name: 'Scroll of Strength VIII',
    icon: '📜',
    description: '+30 Strength for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Strength VIII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 43466,
    requiredLevel: 70,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'red',
    mailSubject: 'Scroll of Strength VIII',
    mailBody: 'A scroll of greater might arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_STR_VIII',
  },

  // ── Agility ──
  {
    id: 'scroll-agility-vii',
    group: 'scrolls',
    name: 'Scroll of Agility VII',
    icon: '📜',
    description: '+25 Agility for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Agility VII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 43463,
    requiredLevel: 60,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 4,
    defaultRollThreshold: 2,
    defaultDailyLimit: 5,
    accent: 'green',
    mailSubject: 'Scroll of Agility VII',
    mailBody: 'A scroll of swiftness arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_AGI_VII',
  },
  {
    id: 'scroll-agility-viii',
    group: 'scrolls',
    name: 'Scroll of Agility VIII',
    icon: '📜',
    description: '+30 Agility for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Agility VIII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 43464,
    requiredLevel: 70,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'green',
    mailSubject: 'Scroll of Agility VIII',
    mailBody: 'A scroll of greater swiftness arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_AGI_VIII',
  },

  // ── Stamina ──
  {
    id: 'scroll-stamina-vii',
    group: 'scrolls',
    name: 'Scroll of Stamina VII',
    icon: '📜',
    description: '+63 Stamina for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Stamina VII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 37093,
    requiredLevel: 60,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 4,
    defaultRollThreshold: 2,
    defaultDailyLimit: 5,
    accent: 'orange',
    mailSubject: 'Scroll of Stamina VII',
    mailBody: 'A scroll of vitality arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_STA_VII',
  },
  {
    id: 'scroll-stamina-viii',
    group: 'scrolls',
    name: 'Scroll of Stamina VIII',
    icon: '📜',
    description: '+132 Stamina for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Stamina VIII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 37094,
    requiredLevel: 70,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'orange',
    mailSubject: 'Scroll of Stamina VIII',
    mailBody: 'A scroll of greater vitality arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_STA_VIII',
  },

  // ── Spirit ──
  {
    id: 'scroll-spirit-vii',
    group: 'scrolls',
    name: 'Scroll of Spirit VII',
    icon: '📜',
    description: '+40 Spirit for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Spirit VII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 37097,
    requiredLevel: 60,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 4,
    defaultRollThreshold: 2,
    defaultDailyLimit: 5,
    accent: 'purple',
    mailSubject: 'Scroll of Spirit VII',
    mailBody: 'A scroll of enlightenment arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_SPI_VII',
  },
  {
    id: 'scroll-spirit-viii',
    group: 'scrolls',
    name: 'Scroll of Spirit VIII',
    icon: '📜',
    description: '+64 Spirit for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Spirit VIII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 37098,
    requiredLevel: 70,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'purple',
    mailSubject: 'Scroll of Spirit VIII',
    mailBody: 'A scroll of greater enlightenment arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_SPI_VIII',
  },

  // ── Protection (Armor) ──
  {
    id: 'scroll-protection-vii',
    group: 'scrolls',
    name: 'Scroll of Protection VII',
    icon: '📜',
    description: '+340 Armor for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Protection VII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 43467,
    requiredLevel: 60,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 4,
    defaultRollThreshold: 2,
    defaultDailyLimit: 5,
    accent: 'orange',
    mailSubject: 'Scroll of Protection VII',
    mailBody: 'A scroll of warding arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_PROT_VII',
  },
  {
    id: 'scroll-protection-viii',
    group: 'scrolls',
    name: 'Scroll of Protection VIII',
    icon: '📜',
    description: '+750 Armor for 30 min. Delivered via mail.',
    successMessage: 'Scroll of Protection VIII has been sent! Check your mailbox.',
    deliveryType: 'item',
    gameId: 43468,
    requiredLevel: 70,
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: 6,
    defaultRollThreshold: 2,
    defaultDailyLimit: 3,
    accent: 'orange',
    mailSubject: 'Scroll of Protection VIII',
    mailBody: 'A scroll of greater warding arrives for you, hero.',
    itemCount: 5,
    envPrefix: 'SCROLL_PROT_VIII',
  },
]

// ─── Helpers ──────────────────────────────────────────

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
