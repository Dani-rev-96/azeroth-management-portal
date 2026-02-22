/**
 * Generate Directus import data from the current hardcoded perk registry,
 * shop categories, and default settings.
 *
 * Usage:
 *   node scripts/generate-directus-data.js
 *
 * Output:
 *   data/directus/import-portal-settings.json
 *   data/directus/import-perk-groups.json
 *   data/directus/import-perks.json
 *   data/directus/import-shop-categories.json
 *
 * These files can be imported into Directus via:
 *   POST /items/<collection>  (bulk create)
 * or via the Directus Data Studio import feature.
 */

const fs = require('fs')
const path = require('path')

// We can't use ESM imports from the shared/ directory directly,
// so we inline the data here from the hardcoded registry.
// This script is a one-shot data migration tool.

const OUTPUT_DIR = path.resolve(__dirname, '..', 'data', 'directus')

// ─── Portal Settings (singleton) ─────────────────────────

const portalSettings = {
  id: 1,
  shop_enabled: true,
  shop_delivery_method: 'mail',
  shop_markup_percent: 20,
  shop_mail_subject: 'Your Shop Purchase',
  shop_mail_body: 'Thank you for your purchase! Your items are attached.',
  eluna_enabled: true,
  eluna_shop_enabled: true,
  eluna_gm_mail_enabled: true,
  perk_fail_debuff_spell_id: 11196,
  perk_fail_debuff_duration_ms: 600000,
  perk_critfail_debuff_spell_id: 15007,
  perk_critfail_debuff_duration_ms: 600000,
}

// ─── Perk Groups ─────────────────────────────────────────

const perkGroups = [
  { id: 'mount',    label: 'Mounts & Abilities', icon: '🦅', description: 'Permanent mount and ability unlocks.',                             enabled: true, sort: 1 },
  { id: 'quest',    label: 'Quest Skips',        icon: '📜', description: 'Skip long quest chains by receiving key items directly.',           enabled: true, sort: 2 },
  { id: 'buffs',    label: 'Class Buffs',        icon: '✨', description: 'Receive powerful class buffs applied directly to your character.',  enabled: true, sort: 3 },
  { id: 'scrolls',  label: 'Stat Scrolls',       icon: '📃', description: 'Receive stat-boosting scrolls via in-game mail.',                  enabled: true, sort: 4 },
  { id: 'teleport', label: 'Teleport',           icon: '🌀', description: 'Teleport your character to a major capital city. Requires online.', enabled: true, sort: 5 },
]

// ─── Shop Categories ─────────────────────────────────────

const shopCategories = [
  'weapons', 'armor', 'consumables', 'trade_goods', 'gems',
  'recipes', 'glyphs', 'containers', 'mounts', 'miscellaneous',
].map((slug, i) => ({ slug, sort: i + 1 }))

// ─── Perks ───────────────────────────────────────────────

// Helper to create a perk object in Directus format
function perk(p) {
  return {
    id: p.id,
    group: p.group,
    name: p.name,
    icon: p.icon,
    description: p.description,
    success_message: p.successMessage,
    delivery_type: p.deliveryType,
    game_id: p.gameId,
    aura_duration_ms: p.auraDurationMs ?? null,
    required_level: p.requiredLevel,
    requires_online: p.requiresOnline,
    one_time: p.oneTime,
    dice_sides: p.defaultDiceSides,
    roll_threshold: p.defaultRollThreshold,
    daily_limit: p.defaultDailyLimit,
    accent: p.accent,
    env_prefix: p.envPrefix,
    rank_group: p.rankGroup ?? null,
    mail_subject: p.mailSubject ?? null,
    mail_body: p.mailBody ?? null,
    item_count: p.itemCount ?? null,
    fail_debuff_spell_id: p.failDebuffSpellId ?? null,
    fail_debuff_duration_ms: p.failDebuffDurationMs ?? null,
    critfail_debuff_spell_id: p.critFailDebuffSpellId ?? null,
    critfail_debuff_duration_ms: p.critFailDebuffDurationMs ?? null,
    teleport_map_id: p.teleportMapId ?? null,
    teleport_x: p.teleportX ?? null,
    teleport_y: p.teleportY ?? null,
    teleport_z: p.teleportZ ?? null,
    teleport_o: p.teleportO ?? null,
  }
}

// All perk data from the hardcoded registry, in display order
// This mirrors shared/utils/perks/*.ts exactly
let sortCounter = 0

const allPerks = [
  // ── Mount ──
  perk({ id: 'flying', group: 'mount', name: 'Old World Flying', icon: '🦅', description: 'Learn the ability to fly in Kalimdor and the Eastern Kingdoms.', successMessage: 'Old World Flying has been unlocked!', deliveryType: 'spell', gameId: 31700, requiredLevel: 60, requiresOnline: true, oneTime: true, defaultDiceSides: 20, defaultRollThreshold: 8, defaultDailyLimit: 0, accent: 'purple', envPrefix: 'FLYING' }),

  // ── Quest ──
  perk({ id: 'drakefire', group: 'quest', name: 'Drakefire Amulet', icon: '🐉', description: "Receive the Drakefire Amulet — grants access to Onyxia's Lair without completing the attunement chain.", successMessage: 'Drakefire Amulet has been sent! Check your in-game mailbox.', deliveryType: 'item', gameId: 16309, requiredLevel: 0, requiresOnline: true, oneTime: true, defaultDiceSides: 15, defaultRollThreshold: 8, defaultDailyLimit: 0, accent: 'orange', mailSubject: 'Drakefire Amulet', mailBody: 'The power of the Drakefire Amulet has been bestowed upon you. Use it wisely, hero.', itemCount: 1, envPrefix: 'DRAKEFIRE' }),

  // ── Buffs: Mark of the Wild ──
  perk({ id: 'buff-motw-r1', group: 'buffs', name: 'Mark of the Wild (Rank 1)', icon: '🌿', description: '+1 all attributes, +1 all resistances, +25 armor. Lasts 1 hour.', successMessage: 'Mark of the Wild has been applied!', deliveryType: 'aura', gameId: 1126, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'green', envPrefix: 'BUFF_MOTW_R1', rankGroup: 'buff-motw' }),
  perk({ id: 'buff-motw-r2', group: 'buffs', name: 'Mark of the Wild (Rank 2)', icon: '🌿', description: '+2 all attributes, +1 all resistances, +65 armor. Lasts 1 hour.', successMessage: 'Mark of the Wild has been applied!', deliveryType: 'aura', gameId: 5232, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 10, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'green', envPrefix: 'BUFF_MOTW_R2', rankGroup: 'buff-motw' }),
  perk({ id: 'buff-motw-r3', group: 'buffs', name: 'Mark of the Wild (Rank 3)', icon: '🌿', description: '+4 all attributes, +1 all resistances, +105 armor. Lasts 1 hour.', successMessage: 'Mark of the Wild has been applied!', deliveryType: 'aura', gameId: 6756, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 20, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'green', envPrefix: 'BUFF_MOTW_R3', rankGroup: 'buff-motw' }),
  perk({ id: 'buff-motw-r4', group: 'buffs', name: 'Mark of the Wild (Rank 4)', icon: '🌿', description: '+6 all attributes, +5 all resistances, +150 armor. Lasts 1 hour.', successMessage: 'Mark of the Wild has been applied!', deliveryType: 'aura', gameId: 5234, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 30, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'green', envPrefix: 'BUFF_MOTW_R4', rankGroup: 'buff-motw' }),
  perk({ id: 'buff-motw-r5', group: 'buffs', name: 'Mark of the Wild (Rank 5)', icon: '🌿', description: '+8 all attributes, +10 all resistances, +195 armor. Lasts 1 hour.', successMessage: 'Mark of the Wild has been applied!', deliveryType: 'aura', gameId: 8907, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 40, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'green', envPrefix: 'BUFF_MOTW_R5', rankGroup: 'buff-motw' }),
  perk({ id: 'buff-motw-r6', group: 'buffs', name: 'Gift of the Wild (Rank 1)', icon: '🌿', description: '+10 all attributes, +15 all resistances, +240 armor. Lasts 1 hour.', successMessage: 'Gift of the Wild has been applied!', deliveryType: 'aura', gameId: 21849, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 50, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'green', envPrefix: 'BUFF_MOTW_R6', rankGroup: 'buff-motw' }),
  perk({ id: 'buff-motw-r7', group: 'buffs', name: 'Gift of the Wild (Rank 2)', icon: '🌿', description: '+12 all attributes, +20 all resistances, +285 armor. Lasts 1 hour.', successMessage: 'Gift of the Wild has been applied!', deliveryType: 'aura', gameId: 21850, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 60, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'green', envPrefix: 'BUFF_MOTW_R7', rankGroup: 'buff-motw' }),
  perk({ id: 'buff-motw-r8', group: 'buffs', name: 'Gift of the Wild (Rank 3)', icon: '🌿', description: '+14 all attributes, +25 all resistances, +340 armor. Lasts 1 hour.', successMessage: 'Gift of the Wild has been applied!', deliveryType: 'aura', gameId: 26991, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 70, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'green', envPrefix: 'BUFF_MOTW_R8', rankGroup: 'buff-motw' }),
  perk({ id: 'buff-motw-r9', group: 'buffs', name: 'Gift of the Wild (Rank 4)', icon: '🌿', description: '+37 all attributes, +54 all resistances, +750 armor. Lasts 1 hour.', successMessage: 'Gift of the Wild has been applied!', deliveryType: 'aura', gameId: 48470, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 80, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'green', envPrefix: 'BUFF_MOTW', rankGroup: 'buff-motw' }),

  // ── Buffs: Fortitude ──
  perk({ id: 'buff-fort-r1', group: 'buffs', name: 'Power Word: Fortitude (Rank 1)', icon: '🛡️', description: '+3 Stamina. Lasts 30 min.', successMessage: 'Power Word: Fortitude has been applied!', deliveryType: 'aura', gameId: 1243, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_FORT_R1', rankGroup: 'buff-fort' }),
  perk({ id: 'buff-fort-r2', group: 'buffs', name: 'Power Word: Fortitude (Rank 2)', icon: '🛡️', description: '+8 Stamina. Lasts 30 min.', successMessage: 'Power Word: Fortitude has been applied!', deliveryType: 'aura', gameId: 1244, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 12, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_FORT_R2', rankGroup: 'buff-fort' }),
  perk({ id: 'buff-fort-r3', group: 'buffs', name: 'Power Word: Fortitude (Rank 3)', icon: '🛡️', description: '+20 Stamina. Lasts 30 min.', successMessage: 'Power Word: Fortitude has been applied!', deliveryType: 'aura', gameId: 1245, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 24, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_FORT_R3', rankGroup: 'buff-fort' }),
  perk({ id: 'buff-fort-r4', group: 'buffs', name: 'Power Word: Fortitude (Rank 4)', icon: '🛡️', description: '+32 Stamina. Lasts 30 min.', successMessage: 'Power Word: Fortitude has been applied!', deliveryType: 'aura', gameId: 2791, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 36, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_FORT_R4', rankGroup: 'buff-fort' }),
  perk({ id: 'buff-fort-r5', group: 'buffs', name: 'Prayer of Fortitude (Rank 1)', icon: '🛡️', description: '+43 Stamina. Lasts 1 hour.', successMessage: 'Prayer of Fortitude has been applied!', deliveryType: 'aura', gameId: 21562, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 48, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_FORT_R5', rankGroup: 'buff-fort' }),
  perk({ id: 'buff-fort-r6', group: 'buffs', name: 'Prayer of Fortitude (Rank 2)', icon: '🛡️', description: '+54 Stamina. Lasts 1 hour.', successMessage: 'Prayer of Fortitude has been applied!', deliveryType: 'aura', gameId: 21564, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 60, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_FORT_R6', rankGroup: 'buff-fort' }),
  perk({ id: 'buff-fort-r7', group: 'buffs', name: 'Prayer of Fortitude (Rank 3)', icon: '🛡️', description: '+79 Stamina. Lasts 1 hour.', successMessage: 'Prayer of Fortitude has been applied!', deliveryType: 'aura', gameId: 25392, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 70, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_FORT_R7', rankGroup: 'buff-fort' }),
  perk({ id: 'buff-fort-r8', group: 'buffs', name: 'Prayer of Fortitude (Rank 4)', icon: '🛡️', description: '+165 Stamina. Lasts 1 hour.', successMessage: 'Prayer of Fortitude has been applied!', deliveryType: 'aura', gameId: 48162, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 80, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_FORT', rankGroup: 'buff-fort' }),

  // ── Buffs: Divine Spirit ──
  perk({ id: 'buff-spirit-r1', group: 'buffs', name: 'Divine Spirit (Rank 1)', icon: '💫', description: '+17 Spirit. Lasts 30 min.', successMessage: 'Divine Spirit has been applied!', deliveryType: 'aura', gameId: 14752, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 30, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_SPIRIT_R1', rankGroup: 'buff-spirit' }),
  perk({ id: 'buff-spirit-r2', group: 'buffs', name: 'Divine Spirit (Rank 2)', icon: '💫', description: '+23 Spirit. Lasts 30 min.', successMessage: 'Divine Spirit has been applied!', deliveryType: 'aura', gameId: 14818, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 40, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_SPIRIT_R2', rankGroup: 'buff-spirit' }),
  perk({ id: 'buff-spirit-r3', group: 'buffs', name: 'Divine Spirit (Rank 3)', icon: '💫', description: '+33 Spirit. Lasts 30 min.', successMessage: 'Divine Spirit has been applied!', deliveryType: 'aura', gameId: 14819, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 50, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_SPIRIT_R3', rankGroup: 'buff-spirit' }),
  perk({ id: 'buff-spirit-r4', group: 'buffs', name: 'Prayer of Spirit (Rank 1)', icon: '💫', description: '+40 Spirit. Lasts 1 hour.', successMessage: 'Prayer of Spirit has been applied!', deliveryType: 'aura', gameId: 27681, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 60, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_SPIRIT_R4', rankGroup: 'buff-spirit' }),
  perk({ id: 'buff-spirit-r5', group: 'buffs', name: 'Prayer of Spirit (Rank 2)', icon: '💫', description: '+50 Spirit. Lasts 1 hour.', successMessage: 'Prayer of Spirit has been applied!', deliveryType: 'aura', gameId: 32999, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 70, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_SPIRIT_R5', rankGroup: 'buff-spirit' }),
  perk({ id: 'buff-spirit-r6', group: 'buffs', name: 'Prayer of Spirit (Rank 3)', icon: '💫', description: '+80 Spirit. Lasts 1 hour.', successMessage: 'Prayer of Spirit has been applied!', deliveryType: 'aura', gameId: 48074, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 80, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_SPIRIT', rankGroup: 'buff-spirit' }),

  // ── Buffs: Shadow Protection ──
  perk({ id: 'buff-shadow-prot-r1', group: 'buffs', name: 'Shadow Protection (Rank 1)', icon: '🌑', description: '+30 Shadow Resistance. Lasts 10 min.', successMessage: 'Shadow Protection has been applied!', deliveryType: 'aura', gameId: 976, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 30, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'purple', envPrefix: 'BUFF_SHADOW_PROT_R1', rankGroup: 'buff-shadow-prot' }),
  perk({ id: 'buff-shadow-prot-r2', group: 'buffs', name: 'Shadow Protection (Rank 2)', icon: '🌑', description: '+45 Shadow Resistance. Lasts 10 min.', successMessage: 'Shadow Protection has been applied!', deliveryType: 'aura', gameId: 10957, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 42, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'purple', envPrefix: 'BUFF_SHADOW_PROT_R2', rankGroup: 'buff-shadow-prot' }),
  perk({ id: 'buff-shadow-prot-r3', group: 'buffs', name: 'Prayer of Shadow Protection (Rank 1)', icon: '🌑', description: '+60 Shadow Resistance. Lasts 20 min.', successMessage: 'Prayer of Shadow Protection has been applied!', deliveryType: 'aura', gameId: 27683, auraDurationMs: 1200000, failDebuffDurationMs: 1200000, requiredLevel: 56, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'purple', envPrefix: 'BUFF_SHADOW_PROT_R3', rankGroup: 'buff-shadow-prot' }),
  perk({ id: 'buff-shadow-prot-r4', group: 'buffs', name: 'Shadow Protection (Rank 4)', icon: '🌑', description: '+70 Shadow Resistance. Lasts 10 min.', successMessage: 'Shadow Protection has been applied!', deliveryType: 'aura', gameId: 25433, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 68, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'purple', envPrefix: 'BUFF_SHADOW_PROT_R4', rankGroup: 'buff-shadow-prot' }),
  perk({ id: 'buff-shadow-prot-r5', group: 'buffs', name: 'Prayer of Shadow Protection (Rank 2)', icon: '🌑', description: '+130 Shadow Resistance. Lasts 20 min.', successMessage: 'Prayer of Shadow Protection has been applied!', deliveryType: 'aura', gameId: 48170, auraDurationMs: 1200000, failDebuffDurationMs: 1200000, requiredLevel: 77, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'purple', envPrefix: 'BUFF_SHADOW_PROT', rankGroup: 'buff-shadow-prot' }),

  // ── Buffs: Arcane Intellect ──
  perk({ id: 'buff-ai-r1', group: 'buffs', name: 'Arcane Intellect (Rank 1)', icon: '🔮', description: '+2 Intellect. Lasts 30 min.', successMessage: 'Arcane Intellect has been applied!', deliveryType: 'aura', gameId: 1459, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_AI_R1', rankGroup: 'buff-ai' }),
  perk({ id: 'buff-ai-r2', group: 'buffs', name: 'Arcane Intellect (Rank 2)', icon: '🔮', description: '+7 Intellect. Lasts 30 min.', successMessage: 'Arcane Intellect has been applied!', deliveryType: 'aura', gameId: 1460, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 14, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_AI_R2', rankGroup: 'buff-ai' }),
  perk({ id: 'buff-ai-r3', group: 'buffs', name: 'Arcane Intellect (Rank 3)', icon: '🔮', description: '+15 Intellect. Lasts 30 min.', successMessage: 'Arcane Intellect has been applied!', deliveryType: 'aura', gameId: 1461, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 28, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_AI_R3', rankGroup: 'buff-ai' }),
  perk({ id: 'buff-ai-r4', group: 'buffs', name: 'Arcane Intellect (Rank 4)', icon: '🔮', description: '+22 Intellect. Lasts 30 min.', successMessage: 'Arcane Intellect has been applied!', deliveryType: 'aura', gameId: 10156, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 42, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_AI_R4', rankGroup: 'buff-ai' }),
  perk({ id: 'buff-ai-r5', group: 'buffs', name: 'Arcane Brilliance (Rank 1)', icon: '🔮', description: '+31 Intellect. Lasts 1 hour.', successMessage: 'Arcane Brilliance has been applied!', deliveryType: 'aura', gameId: 23028, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 56, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_AI_R5', rankGroup: 'buff-ai' }),
  perk({ id: 'buff-ai-r6', group: 'buffs', name: 'Arcane Brilliance (Rank 2)', icon: '🔮', description: '+40 Intellect. Lasts 1 hour.', successMessage: 'Arcane Brilliance has been applied!', deliveryType: 'aura', gameId: 27127, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 70, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_AI_R6', rankGroup: 'buff-ai' }),
  perk({ id: 'buff-ai-r7', group: 'buffs', name: 'Arcane Brilliance (Rank 3)', icon: '🔮', description: '+60 Intellect. Lasts 1 hour.', successMessage: 'Arcane Brilliance has been applied!', deliveryType: 'aura', gameId: 43002, auraDurationMs: 3600000, failDebuffDurationMs: 3600000, requiredLevel: 80, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_AI', rankGroup: 'buff-ai' }),

  // ── Buffs: Blessing of Kings ──
  perk({ id: 'buff-kings-r1', group: 'buffs', name: 'Blessing of Kings', icon: '👑', description: '+10% all attributes. Lasts 10 min.', successMessage: 'Blessing of Kings has been applied!', deliveryType: 'aura', gameId: 20217, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 20, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'gold', envPrefix: 'BUFF_KINGS_R1', rankGroup: 'buff-kings' }),
  perk({ id: 'buff-kings-r2', group: 'buffs', name: 'Greater Blessing of Kings', icon: '👑', description: '+10% all attributes. Lasts 30 min.', successMessage: 'Greater Blessing of Kings has been applied!', deliveryType: 'aura', gameId: 25898, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 60, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'gold', envPrefix: 'BUFF_KINGS', rankGroup: 'buff-kings' }),

  // ── Buffs: Blessing of Might ──
  perk({ id: 'buff-might-r1', group: 'buffs', name: 'Blessing of Might (Rank 1)', icon: '⚔️', description: '+20 Attack Power. Lasts 10 min.', successMessage: 'Blessing of Might has been applied!', deliveryType: 'aura', gameId: 19740, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'red', envPrefix: 'BUFF_MIGHT_R1', rankGroup: 'buff-might' }),
  perk({ id: 'buff-might-r2', group: 'buffs', name: 'Blessing of Might (Rank 2)', icon: '⚔️', description: '+35 Attack Power. Lasts 10 min.', successMessage: 'Blessing of Might has been applied!', deliveryType: 'aura', gameId: 19834, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 12, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'red', envPrefix: 'BUFF_MIGHT_R2', rankGroup: 'buff-might' }),
  perk({ id: 'buff-might-r3', group: 'buffs', name: 'Blessing of Might (Rank 3)', icon: '⚔️', description: '+55 Attack Power. Lasts 10 min.', successMessage: 'Blessing of Might has been applied!', deliveryType: 'aura', gameId: 19835, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 22, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'red', envPrefix: 'BUFF_MIGHT_R3', rankGroup: 'buff-might' }),
  perk({ id: 'buff-might-r4', group: 'buffs', name: 'Blessing of Might (Rank 4)', icon: '⚔️', description: '+85 Attack Power. Lasts 10 min.', successMessage: 'Blessing of Might has been applied!', deliveryType: 'aura', gameId: 19836, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 32, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'red', envPrefix: 'BUFF_MIGHT_R4', rankGroup: 'buff-might' }),
  perk({ id: 'buff-might-r5', group: 'buffs', name: 'Blessing of Might (Rank 5)', icon: '⚔️', description: '+115 Attack Power. Lasts 10 min.', successMessage: 'Blessing of Might has been applied!', deliveryType: 'aura', gameId: 19837, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 42, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'red', envPrefix: 'BUFF_MIGHT_R5', rankGroup: 'buff-might' }),
  perk({ id: 'buff-might-r6', group: 'buffs', name: 'Greater Blessing of Might (Rank 1)', icon: '⚔️', description: '+185 Attack Power. Lasts 30 min.', successMessage: 'Greater Blessing of Might has been applied!', deliveryType: 'aura', gameId: 25782, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 52, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'red', envPrefix: 'BUFF_MIGHT_R6', rankGroup: 'buff-might' }),
  perk({ id: 'buff-might-r7', group: 'buffs', name: 'Greater Blessing of Might (Rank 2)', icon: '⚔️', description: '+220 Attack Power. Lasts 30 min.', successMessage: 'Greater Blessing of Might has been applied!', deliveryType: 'aura', gameId: 25916, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 60, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'red', envPrefix: 'BUFF_MIGHT_R7', rankGroup: 'buff-might' }),
  perk({ id: 'buff-might-r8', group: 'buffs', name: 'Greater Blessing of Might (Rank 3)', icon: '⚔️', description: '+264 Attack Power. Lasts 30 min.', successMessage: 'Greater Blessing of Might has been applied!', deliveryType: 'aura', gameId: 27141, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 70, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'red', envPrefix: 'BUFF_MIGHT_R8', rankGroup: 'buff-might' }),
  perk({ id: 'buff-might-r9', group: 'buffs', name: 'Greater Blessing of Might (Rank 4)', icon: '⚔️', description: '+550 Attack Power. Lasts 30 min.', successMessage: 'Greater Blessing of Might has been applied!', deliveryType: 'aura', gameId: 48934, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 80, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'red', envPrefix: 'BUFF_MIGHT', rankGroup: 'buff-might' }),

  // ── Buffs: Blessing of Wisdom ──
  perk({ id: 'buff-wisdom-r1', group: 'buffs', name: 'Blessing of Wisdom (Rank 1)', icon: '📖', description: '+10 mana per 5 sec. Lasts 10 min.', successMessage: 'Blessing of Wisdom has been applied!', deliveryType: 'aura', gameId: 19742, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 15, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_WISDOM_R1', rankGroup: 'buff-wisdom' }),
  perk({ id: 'buff-wisdom-r2', group: 'buffs', name: 'Blessing of Wisdom (Rank 2)', icon: '📖', description: '+15 mana per 5 sec. Lasts 10 min.', successMessage: 'Blessing of Wisdom has been applied!', deliveryType: 'aura', gameId: 19850, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 24, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_WISDOM_R2', rankGroup: 'buff-wisdom' }),
  perk({ id: 'buff-wisdom-r3', group: 'buffs', name: 'Blessing of Wisdom (Rank 3)', icon: '📖', description: '+20 mana per 5 sec. Lasts 10 min.', successMessage: 'Blessing of Wisdom has been applied!', deliveryType: 'aura', gameId: 19852, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 34, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_WISDOM_R3', rankGroup: 'buff-wisdom' }),
  perk({ id: 'buff-wisdom-r4', group: 'buffs', name: 'Blessing of Wisdom (Rank 4)', icon: '📖', description: '+27 mana per 5 sec. Lasts 10 min.', successMessage: 'Blessing of Wisdom has been applied!', deliveryType: 'aura', gameId: 19853, auraDurationMs: 600000, failDebuffDurationMs: 600000, requiredLevel: 44, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_WISDOM_R4', rankGroup: 'buff-wisdom' }),
  perk({ id: 'buff-wisdom-r5', group: 'buffs', name: 'Greater Blessing of Wisdom (Rank 1)', icon: '📖', description: '+33 mana per 5 sec. Lasts 30 min.', successMessage: 'Greater Blessing of Wisdom has been applied!', deliveryType: 'aura', gameId: 25894, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 54, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_WISDOM_R5', rankGroup: 'buff-wisdom' }),
  perk({ id: 'buff-wisdom-r6', group: 'buffs', name: 'Greater Blessing of Wisdom (Rank 2)', icon: '📖', description: '+41 mana per 5 sec. Lasts 30 min.', successMessage: 'Greater Blessing of Wisdom has been applied!', deliveryType: 'aura', gameId: 25918, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 60, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_WISDOM_R6', rankGroup: 'buff-wisdom' }),
  perk({ id: 'buff-wisdom-r7', group: 'buffs', name: 'Greater Blessing of Wisdom (Rank 3)', icon: '📖', description: '+49 mana per 5 sec. Lasts 30 min.', successMessage: 'Greater Blessing of Wisdom has been applied!', deliveryType: 'aura', gameId: 27143, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 70, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_WISDOM_R7', rankGroup: 'buff-wisdom' }),
  perk({ id: 'buff-wisdom-r8', group: 'buffs', name: 'Greater Blessing of Wisdom (Rank 4)', icon: '📖', description: '+92 mana per 5 sec. Lasts 30 min.', successMessage: 'Greater Blessing of Wisdom has been applied!', deliveryType: 'aura', gameId: 48938, auraDurationMs: 1800000, failDebuffDurationMs: 1800000, requiredLevel: 80, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 3, accent: 'blue', envPrefix: 'BUFF_WISDOM', rankGroup: 'buff-wisdom' }),

  // ── Scrolls: Intellect ──
  ...scrollTier('intellect', 'Intellect', 'blue', [955, 2290, 4419, 10308, 27499, 33458, 37091, 37092]),
  // ── Scrolls: Strength ──
  ...scrollTier('strength', 'Strength', 'red', [954, 2289, 4426, 10310, 27503, 33462, 43465, 43466]),
  // ── Scrolls: Agility ──
  ...scrollTier('agility', 'Agility', 'green', [3012, 1477, 4425, 10309, 27498, 33457, 43463, 43464]),
  // ── Scrolls: Stamina ──
  ...scrollTier('stamina', 'Stamina', 'orange', [1180, 1711, 4422, 10307, 27502, 33461, 37093, 37094]),
  // ── Scrolls: Spirit ──
  ...scrollTier('spirit', 'Spirit', 'purple', [1181, 1712, 4424, 10306, 27501, 33460, 37097, 37098]),
  // ── Scrolls: Protection ──
  ...scrollTier('protection', 'Protection', 'orange', [3013, 1478, 4421, 10305, 27500, 33459, 43467, 43468]),

  // ── Teleport ──
  perk({ id: 'teleport-stormwind', group: 'teleport', name: 'Teleport: Stormwind', icon: '🏰', description: 'Teleport to Stormwind City, the human capital.', successMessage: 'You are being teleported to Stormwind City!', deliveryType: 'teleport', gameId: 0, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 5, accent: 'blue', envPrefix: 'TP_STORMWIND', failDebuffSpellId: 1604, failDebuffDurationMs: 60000, teleportMapId: 0, teleportX: -8833.38, teleportY: 628.62, teleportZ: 94.00, teleportO: 0 }),
  perk({ id: 'teleport-ironforge', group: 'teleport', name: 'Teleport: Ironforge', icon: '⛏️', description: 'Teleport to Ironforge, the dwarven stronghold.', successMessage: 'You are being teleported to Ironforge!', deliveryType: 'teleport', gameId: 0, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 5, accent: 'orange', envPrefix: 'TP_IRONFORGE', failDebuffSpellId: 1604, failDebuffDurationMs: 60000, teleportMapId: 0, teleportX: -4918.88, teleportY: -940.41, teleportZ: 501.56, teleportO: 0 }),
  perk({ id: 'teleport-darnassus', group: 'teleport', name: 'Teleport: Darnassus', icon: '🌳', description: 'Teleport to Darnassus, the night elf capital.', successMessage: 'You are being teleported to Darnassus!', deliveryType: 'teleport', gameId: 0, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 5, accent: 'purple', envPrefix: 'TP_DARNASSUS', failDebuffSpellId: 1604, failDebuffDurationMs: 60000, teleportMapId: 1, teleportX: 9951.52, teleportY: 2280.32, teleportZ: 1341.39, teleportO: 0 }),
  perk({ id: 'teleport-exodar', group: 'teleport', name: 'Teleport: The Exodar', icon: '💎', description: 'Teleport to The Exodar, the draenei capital.', successMessage: 'You are being teleported to The Exodar!', deliveryType: 'teleport', gameId: 0, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 5, accent: 'blue', envPrefix: 'TP_EXODAR', failDebuffSpellId: 1604, failDebuffDurationMs: 60000, teleportMapId: 530, teleportX: -3965.7, teleportY: -11653.6, teleportZ: -138.84, teleportO: 0 }),
  perk({ id: 'teleport-orgrimmar', group: 'teleport', name: 'Teleport: Orgrimmar', icon: '🔥', description: 'Teleport to Orgrimmar, the orcish capital.', successMessage: 'You are being teleported to Orgrimmar!', deliveryType: 'teleport', gameId: 0, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 5, accent: 'red', envPrefix: 'TP_ORGRIMMAR', failDebuffSpellId: 1604, failDebuffDurationMs: 60000, teleportMapId: 1, teleportX: 1676.21, teleportY: -4315.29, teleportZ: 61.52, teleportO: 0 }),
  perk({ id: 'teleport-thunder-bluff', group: 'teleport', name: 'Teleport: Thunder Bluff', icon: '🦬', description: 'Teleport to Thunder Bluff, the tauren capital.', successMessage: 'You are being teleported to Thunder Bluff!', deliveryType: 'teleport', gameId: 0, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 5, accent: 'orange', envPrefix: 'TP_THUNDER_BLUFF', failDebuffSpellId: 1604, failDebuffDurationMs: 60000, teleportMapId: 1, teleportX: -1274.45, teleportY: 71.86, teleportZ: 128.16, teleportO: 0 }),
  perk({ id: 'teleport-undercity', group: 'teleport', name: 'Teleport: Undercity', icon: '💀', description: 'Teleport to the Undercity, the Forsaken capital.', successMessage: 'You are being teleported to the Undercity!', deliveryType: 'teleport', gameId: 0, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 5, accent: 'purple', envPrefix: 'TP_UNDERCITY', failDebuffSpellId: 1604, failDebuffDurationMs: 60000, teleportMapId: 0, teleportX: 1586.48, teleportY: 239.56, teleportZ: -52.15, teleportO: 0 }),
  perk({ id: 'teleport-silvermoon', group: 'teleport', name: 'Teleport: Silvermoon City', icon: '🌅', description: 'Teleport to Silvermoon City, the blood elf capital.', successMessage: 'You are being teleported to Silvermoon City!', deliveryType: 'teleport', gameId: 0, requiredLevel: 0, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 5, accent: 'red', envPrefix: 'TP_SILVERMOON', failDebuffSpellId: 1604, failDebuffDurationMs: 60000, teleportMapId: 530, teleportX: 9473.03, teleportY: -7279.67, teleportZ: 14.21, teleportO: 0 }),
  perk({ id: 'teleport-shattrath', group: 'teleport', name: 'Teleport: Shattrath City', icon: '☀️', description: 'Teleport to Shattrath City, the neutral hub of Outland.', successMessage: 'You are being teleported to Shattrath City!', deliveryType: 'teleport', gameId: 0, requiredLevel: 58, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 5, accent: 'orange', envPrefix: 'TP_SHATTRATH', failDebuffSpellId: 1604, failDebuffDurationMs: 60000, teleportMapId: 530, teleportX: -1838.16, teleportY: 5301.89, teleportZ: -12.43, teleportO: 0 }),
  perk({ id: 'teleport-dalaran', group: 'teleport', name: 'Teleport: Dalaran', icon: '🔮', description: 'Teleport to Dalaran, the floating city of Northrend.', successMessage: 'You are being teleported to Dalaran!', deliveryType: 'teleport', gameId: 0, requiredLevel: 68, requiresOnline: true, oneTime: false, defaultDiceSides: 6, defaultRollThreshold: 2, defaultDailyLimit: 5, accent: 'purple', envPrefix: 'TP_DALARAN', failDebuffSpellId: 1604, failDebuffDurationMs: 60000, teleportMapId: 571, teleportX: 5804.14, teleportY: 624.77, teleportZ: 647.77, teleportO: 0 }),
].map((p, i) => ({ ...p, sort: i + 1 }))

// ─── Scroll generator ────────────────────────────────────

function scrollTier(stat, label, accent, itemIds) {
  const tiers = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
  const levels = [0, 15, 30, 40, 50, 60, 60, 70]
  const limits = [10, 10, 10, 8, 8, 5, 5, 3]
  const dices  = [4, 4, 4, 4, 4, 4, 4, 6]
  const prefixMap = {
    intellect: 'SCROLL_INT',
    strength: 'SCROLL_STR',
    agility: 'SCROLL_AGI',
    stamina: 'SCROLL_STA',
    spirit: 'SCROLL_SPI',
    protection: 'SCROLL_PROT',
  }
  const prefix = prefixMap[stat]
  const rankGroup = `scroll-${stat.substring(0, 3)}`

  return tiers.map((tier, i) => perk({
    id: `scroll-${stat}-${tier.toLowerCase()}`,
    group: 'scrolls',
    name: `Scroll of ${label} ${tier}`,
    icon: '📜',
    description: `Scroll of ${label} ${tier}. Delivered directly to your bags.`,
    successMessage: `Scroll of ${label} ${tier} has been delivered to your bags!`,
    deliveryType: 'bag-item',
    gameId: itemIds[i],
    requiredLevel: levels[i],
    requiresOnline: true,
    oneTime: false,
    defaultDiceSides: dices[i],
    defaultRollThreshold: 2,
    defaultDailyLimit: limits[i],
    accent,
    mailSubject: `Scroll of ${label} ${tier}`,
    mailBody: i === 7 ? `A scroll of greater power arrives for you, hero.` : `A scroll of power arrives for you, hero.`,
    itemCount: 5,
    envPrefix: `${prefix}_${tier}`,
    rankGroup,
  }))
}

// ─── Write output ────────────────────────────────────────

fs.mkdirSync(OUTPUT_DIR, { recursive: true })

function write(filename, data) {
  const filepath = path.join(OUTPUT_DIR, filename)
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`  ✅ ${filename} (${Array.isArray(data) ? data.length + ' items' : 'singleton'})`)
}

console.log('Generating Directus import data...\n')

write('import-portal-settings.json', portalSettings)
write('import-perk-groups.json', perkGroups)
write('import-perks.json', allPerks)
write('import-shop-categories.json', shopCategories)

console.log(`\nDone! Files written to ${OUTPUT_DIR}/`)
console.log('\nTo import into Directus:')
console.log('  1. Apply schema:  npx directus schema apply data/directus/schema.json')
console.log('  2. Import data via Directus API or Data Studio:')
console.log('     POST /items/portal_settings  ← import-portal-settings.json')
console.log('     POST /items/perk_groups      ← import-perk-groups.json')
console.log('     POST /items/perks            ← import-perks.json (after perk_groups)')
console.log('     POST /items/shop_categories  ← import-shop-categories.json')
