/**
 * POST /api/admin/portal-config/sync
 * Merge hardcoded app defaults into the self-managed database.
 *
 * Merge strategy:
 *   - New items → INSERT (from hardcoded)
 *   - Existing items with modified_by_user=0 → UPDATE (safe overwrite)
 *   - Existing items with modified_by_user=1 → SKIP (user-customized)
 *   - Items only in DB → KEEP (user-added, not in hardcoded)
 *
 * This is safe to run at any time and will never corrupt user data.
 */
export default defineEventHandler(async (event) => {
  const { getAuthenticatedFeatureUser } = await import('#server/utils/auth')
  await getAuthenticatedFeatureUser(event, 'admin.portal-config')

  const body = await readBody(event)

  // Optional: allow syncing only specific collections
  const collections = body?.collections as string[] | undefined
  const validCollections = ['portal_settings', 'perk_groups', 'perks', 'shop_categories']

  if (collections) {
    for (const c of collections) {
      if (!validCollections.includes(c)) {
        throw createError({ statusCode: 400, statusMessage: `Invalid collection: ${c}. Valid: ${validCollections.join(', ')}` })
      }
    }
  }

  const {
    syncSettingsFromDefaults,
    syncPerkGroupsFromDefaults,
    syncPerksFromDefaults,
    syncShopCategoriesFromDefaults,
  } = await import('#server/utils/portal-config-db')

  const { PERK_GROUPS, PERK_REGISTRY } = await import('#shared/utils/perks')

  const shouldSync = (name: string) => !collections || collections.includes(name)
  const reports = []

  // 1. Portal settings
  if (shouldSync('portal_settings')) {
    reports.push(syncSettingsFromDefaults({
      shop_enabled: 1,
      shop_delivery_method: 'mail',
      shop_markup_percent: 20,
      shop_mail_subject: 'Your Shop Purchase',
      shop_mail_body: 'Thank you for your purchase! Your items are attached.',
      eluna_enabled: 1,
      eluna_shop_enabled: 1,
      eluna_gm_mail_enabled: 1,
      perk_fail_debuff_spell_id: 11196,
      perk_fail_debuff_duration_ms: 600000,
      perk_critfail_debuff_spell_id: 15007,
      perk_critfail_debuff_duration_ms: 600000,
    }))
  }

  // 2. Perk groups (must be before perks due to FK)
  if (shouldSync('perk_groups')) {
    const perkGroupDefaults = PERK_GROUPS.map((g: any, i: number) => ({
      id: g.id,
      label: g.label,
      icon: g.icon,
      description: g.description,
      enabled: true,
      sort: i + 1,
    }))
    reports.push(syncPerkGroupsFromDefaults(perkGroupDefaults))
  }

  // 3. Perks
  if (shouldSync('perks')) {
    const perkDefaults = PERK_REGISTRY.map((p: any, i: number) => ({
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
      sort: i + 1,
    }))
    reports.push(syncPerksFromDefaults(perkDefaults))
  }

  // 4. Shop categories
  if (shouldSync('shop_categories')) {
    reports.push(syncShopCategoriesFromDefaults([
      { slug: 'weapons', sort: 1 },
      { slug: 'armor', sort: 2 },
      { slug: 'consumables', sort: 3 },
      { slug: 'trade_goods', sort: 4 },
      { slug: 'gems', sort: 5 },
      { slug: 'recipes', sort: 6 },
      { slug: 'glyphs', sort: 7 },
      { slug: 'containers', sort: 8 },
      { slug: 'mounts', sort: 9 },
      { slug: 'miscellaneous', sort: 10 },
    ]))
  }

  // Build summary
  const summary = {
    totalAdded: reports.reduce((sum, r) => sum + r.added, 0),
    totalUpdated: reports.reduce((sum, r) => sum + r.updated, 0),
    totalSkipped: reports.reduce((sum, r) => sum + r.skipped, 0),
  }

  return {
    message: `Sync complete: ${summary.totalAdded} added, ${summary.totalUpdated} updated, ${summary.totalSkipped} skipped (user-modified)`,
    summary,
    reports,
  }
})
