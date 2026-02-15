/**
 * Perk system type definitions
 *
 * Shared by server and frontend.
 */

export type PerkGroup = 'mount' | 'quest' | 'buffs' | 'scrolls' | 'teleport'

export type PerkDeliveryType = 'spell' | 'item' | 'bag-item' | 'aura' | 'teleport'

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
  /**
   * Optional rank group identifier. Perks sharing the same rankGroup are alternative
   * ranks of the same buff/effect. The UI shows only the highest-level rank that
   * the character qualifies for and hides the rest.
   */
  rankGroup?: string
  /**
   * Per-perk debuff overrides. When set, these override the global debuff config
   * from getPerkConfig(). Useful for group-specific fail penalties:
   * - Teleport fails → Dazed (movement speed reduction)
   * - Buff fails → debuff duration matches the buff's own duration
   */
  failDebuffSpellId?: number
  failDebuffDurationMs?: number
  critFailDebuffSpellId?: number
  critFailDebuffDurationMs?: number
  /** For teleport delivery: map ID */
  teleportMapId?: number
  /** For teleport delivery: X coordinate */
  teleportX?: number
  /** For teleport delivery: Y coordinate */
  teleportY?: number
  /** For teleport delivery: Z coordinate */
  teleportZ?: number
  /** For teleport delivery: orientation (facing direction) */
  teleportO?: number
}

export interface PerkGroupMeta {
  id: PerkGroup
  label: string
  icon: string
  description: string
  /** Environment variable to toggle this group: NUXT_PERK_GROUP_<ID>_ENABLED */
  envKey: string
}
