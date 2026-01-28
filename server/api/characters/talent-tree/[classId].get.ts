import {
  getTalentTabsByClass,
  getTalentsByTab,
  getSpellBatch,
  getSpellIconBatch,
  getSpellDurationBatch,
  type Talent,
  type TalentTab
} from '#server/utils/dbc-db'

/**
 * Complete talent tree node including all spell ranks and descriptions
 */
interface TalentTreeNode {
  talentId: number
  tabId: number
  tier: number
  column: number
  ranks: Array<{
    rank: number
    spellId: number
    spellName: string
    description: string
    tooltip: string
    // Effect values for description parsing
    effectValues: {
      s1: number
      s2: number
      s3: number
      m1: number
      m2: number
      m3: number
      t1: number
      t2: number
      t3: number
      a1: number
      a2: number
      a3: number
      n: number
      h: number
      q: number
      x1: number
      x2: number
      x3: number
      d: number // Duration in milliseconds
    }
  }>
  maxRank: number
  iconTexture: string
  prereqTalent: number | null
  prereqRank: number | null
}

/**
 * Complete talent tab with all talents
 */
interface TalentTreeTab {
  id: number
  name: string
  orderIndex: number
  backgroundFile: string
  iconTexture: string
  talents: TalentTreeNode[]
}

/**
 * Complete talent tree response for a class
 */
interface TalentTreeResponse {
  classId: number
  tabs: TalentTreeTab[]
}

/**
 * Class ID to class mask mapping
 */
const CLASS_ID_TO_MASK: Record<number, number> = {
  1: 1,      // Warrior
  2: 2,      // Paladin
  3: 4,      // Hunter
  4: 8,      // Rogue
  5: 16,     // Priest
  6: 32,     // Death Knight
  7: 64,     // Shaman
  8: 128,    // Mage
  9: 256,    // Warlock
  11: 1024   // Druid
}

/**
 * GET /api/characters/talent-tree/[classId]
 * Get the complete talent tree structure for a class
 */
export default defineEventHandler(async (event) => {
  try {
    const classIdStr = getRouterParam(event, 'classId')
    const classId = parseInt(classIdStr || '0')

    if (!classId || !CLASS_ID_TO_MASK[classId]) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid class ID'
      })
    }

    const classMask = CLASS_ID_TO_MASK[classId]

    // Get all talent tabs for this class
    const talentTabs = await getTalentTabsByClass(classMask)

    if (!talentTabs || talentTabs.length === 0) {
      return {
        classId,
        tabs: []
      }
    }

    // Build complete talent tree for each tab
    const tabs: TalentTreeTab[] = []

    for (const tab of talentTabs) {
      // Get all talents for this tab
      const talents = await getTalentsByTab(tab.id)

      // Collect all spell IDs needed (all ranks of all talents)
      const spellIds: number[] = []
      for (const talent of talents) {
        if (talent.rank_id_1 > 0) spellIds.push(talent.rank_id_1)
        if (talent.rank_id_2 > 0) spellIds.push(talent.rank_id_2)
        if (talent.rank_id_3 > 0) spellIds.push(talent.rank_id_3)
        if (talent.rank_id_4 > 0) spellIds.push(talent.rank_id_4)
        if (talent.rank_id_5 > 0) spellIds.push(talent.rank_id_5)
      }

      // Batch fetch spell data
      const spells = spellIds.length > 0 ? await getSpellBatch(spellIds) : []
      const spellMap = new Map(spells.map(s => [s.id, s]))

      // Get spell icons
      const iconIds = [...new Set(spells.map(s => s.spell_icon_id).filter(id => id > 0))]
      const icons = iconIds.length > 0 ? await getSpellIconBatch(iconIds) : []
      const iconMap = new Map(icons.map(i => [i.id, i]))

      // Get spell durations
      const durationIds = [...new Set(spells.map(s => s.duration_index).filter(id => id > 0))]
      const durations = durationIds.length > 0 ? await getSpellDurationBatch(durationIds) : []
      const durationMap = new Map(durations.map(d => [d.id, d]))

      // Also get the tab icon
      const tabIconIds = tab.spell_icon_id ? [tab.spell_icon_id] : []
      const tabIcons = tabIconIds.length > 0 ? await getSpellIconBatch(tabIconIds) : []
      const tabIconTexture = tabIcons.length > 0 && tabIcons[0] ? tabIcons[0].texture_filename : ''

      // Build talent nodes
      const talentNodes: TalentTreeNode[] = []

      for (const talent of talents) {
        const rankIds = [
          talent.rank_id_1,
          talent.rank_id_2,
          talent.rank_id_3,
          talent.rank_id_4,
          talent.rank_id_5
        ].filter(id => id > 0)

        const ranks = rankIds.map((spellId, index) => {
          const spell = spellMap.get(spellId)

          // Get duration for this spell
          const durationData = spell?.duration_index ? durationMap.get(spell.duration_index) : undefined
          const durationMs = durationData?.duration || 0

          // Calculate spell effect values
          // $s1, $s2, $s3 = base points + 1 (or + die_sides for variable)
          // $m1, $m2, $m3 = misc values
          // $t1, $t2, $t3 = aura period / 1000 (in seconds)
          // $a1, $a2, $a3 = amplitude/multiple value
          // $n = chain targets
          // $h = proc chance
          // $q = proc charges
          // $x1, $x2, $x3 = chain targets per effect
          // $d = duration in milliseconds
          const effectValues = {
            s1: spell ? Math.abs(spell.effect_base_points_1) + 1 : 0,
            s2: spell ? Math.abs(spell.effect_base_points_2) + 1 : 0,
            s3: spell ? Math.abs(spell.effect_base_points_3) + 1 : 0,
            m1: spell?.effect_misc_value_1 || 0,
            m2: spell?.effect_misc_value_2 || 0,
            m3: spell?.effect_misc_value_3 || 0,
            t1: spell ? (spell.effect_aura_period_1 / 1000) : 0,
            t2: spell ? (spell.effect_aura_period_2 / 1000) : 0,
            t3: spell ? (spell.effect_aura_period_3 / 1000) : 0,
            a1: spell?.effect_amplitude_1 || 0,
            a2: spell?.effect_amplitude_2 || 0,
            a3: spell?.effect_amplitude_3 || 0,
            n: spell?.effect_chain_targets_1 || 0,
            h: spell?.proc_chance || 0,
            q: spell?.proc_charges || 0,
            x1: spell?.effect_chain_targets_1 || 0,
            x2: spell?.effect_chain_targets_2 || 0,
            x3: spell?.effect_chain_targets_3 || 0,
            d: durationMs
          }

          return {
            rank: index + 1,
            spellId,
            spellName: spell?.name || `Unknown Spell ${spellId}`,
            description: spell?.description || '',
            tooltip: spell?.tooltip || '',
            effectValues
          }
        })

        // Get icon from the first rank's spell
        const firstRankId = rankIds[0]
        const firstSpell = firstRankId !== undefined ? spellMap.get(firstRankId) : undefined
        const iconId = firstSpell?.spell_icon_id
        const icon = iconId ? iconMap.get(iconId) : undefined
        const iconTexture = icon?.texture_filename || ''

        talentNodes.push({
          talentId: talent.id,
          tabId: talent.tab_id,
          tier: talent.tier_id,
          column: talent.column_index,
          ranks,
          maxRank: ranks.length,
          iconTexture,
          prereqTalent: talent.prereq_talent > 0 ? talent.prereq_talent : null,
          prereqRank: talent.prereq_rank > 0 ? talent.prereq_rank : null
        })
      }

      tabs.push({
        id: tab.id,
        name: tab.name,
        orderIndex: tab.order_index,
        backgroundFile: tab.background_file,
        iconTexture: tabIconTexture,
        talents: talentNodes
      })
    }

    // Sort tabs by order_index
    tabs.sort((a, b) => a.orderIndex - b.orderIndex)

    return {
      classId,
      tabs
    } as TalentTreeResponse

  } catch (error: any) {
    console.error('Error fetching talent tree:', error)
    throw createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.statusMessage || 'Failed to fetch talent tree'
    })
  }
})
