// Authenticated User from external auth provider (OAuth-Proxy, Basic Auth, or direct WoW login)
export type AuthUser = {
  sub: string
  preferred_username: string
  email: string
  name?: string
  given_name?: string
  family_name?: string
  email_verified: boolean
  isGM?: boolean
  gmLevel?: number
  // True when using direct WoW account login (no account linking)
  isDirect?: boolean
  // WoW account ID (only present in direct auth mode)
  wowAccountId?: number
}

// WoW Server Realm Configuration
// RealmId is now a dynamic string - realms are configured via environment variables
export type RealmId = string

export type RealmConfig = {
  id: RealmId
  name: string
  description: string
  // Database connection info
  dbHost: string
  dbPort: number
  dbUser: string
  dbPassword: string
}

// AzerothCore Account (raw from acore_auth.account table)
export type AzerothCoreAccount = {
  id: number
  username: string
  salt: string
  verifier: string
  email: string | null
  joindate: string
  last_ip: string
  last_login: string | null
  online: number
  expansion: number
  mutetime: bigint
  locale: number
}

// WoW Account (stored in auth database)
export type WoWAccount = {
  id: number
  username: string
  sha_pass_hash: string
  email?: string
  last_login?: string
  last_ip?: string
  expansion: number
  mutetime: number
  locale: number
  os?: string
  recruiter?: number
}

// WoW Character
export type WoWCharacter = {
  guid: number
  name: string
  race: number
  class: number
  gender: number
  level: number
  xp: number
  money: number
  online?: boolean
  skin: number
  face: number
  hairStyle: number
  hairColor: number
  facialStyle: number
  flags: number
  deleteInfos_Account?: number
  deleteInfos_Name?: string
  deleteDate?: string
}

// Mapping between external auth user and WoW Account
export type AccountMapping = {
  externalId: string
  displayName: string
  email?: string
  wowAccountId: number
  wowAccountName: string
  createdAt: string
  lastUsed?: string
}

// Realm character data for an account
export type RealmCharacterData = {
  realm: RealmConfig
  characters: WoWCharacter[]
}

// Account Management Data (combined view for frontend)
export type ManagedAccount = {
  mapping: AccountMapping
  wowAccount: WoWAccount
  realms: RealmCharacterData[] // Characters grouped by realm
}

// API Response Types
export type ApiResponse<T> = {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// SOAP Request/Response
export type SoapRequest = {
  command: string
  args?: string[]
}

export type SoapResponse = {
  status: number
  result?: string
}

// Character Detail Types
export type CharacterItem = {
  guid: number
  itemId: number
  slot: number
  displayid: number
  name: string
  description?: string
  quality: number
  itemLevel: number
  requiredLevel: number
  itemClass: number
  itemSubclass: number
  inventoryType: number
  armor?: number
  statsCount: number
  stat_type1?: number
  stat_value1?: number
  stat_type2?: number
  stat_value2?: number
  stat_type3?: number
  stat_value3?: number
  stat_type4?: number
  stat_value4?: number
  stat_type5?: number
  stat_value5?: number
  stat_type6?: number
  stat_value6?: number
  stat_type7?: number
  stat_value7?: number
  stat_type8?: number
  stat_value8?: number
  stat_type9?: number
  stat_value9?: number
  stat_type10?: number
  stat_value10?: number
  dmg_min1?: number
  dmg_max1?: number
  dmg_type1?: number
  dmg_min2?: number
  dmg_max2?: number
  dmg_type2?: number
  delay?: number
  holy_res?: number
  fire_res?: number
  nature_res?: number
  frost_res?: number
  shadow_res?: number
  arcane_res?: number
  icon?: string
  enchantments?: string
  enchantmentTexts?: string[]
  enchantmentInfos?: any[]
  randomPropertyId?: number
  durability?: number
}

/**
 * Normalized item tooltip data used by the shared ItemTooltip component.
 * Can be constructed from either ShopItemDetails or CharacterItem.
 */
export type ItemTooltipData = {
  name: string
  quality: number
  itemLevel: number
  requiredLevel: number

  // Classification
  itemClass: number
  itemSubclass: number
  inventoryType: number
  inventoryTypeName?: string
  subclassName?: string

  // Bonding
  bonding?: number

  // Unique
  maxCount?: number

  // Armor / Block
  armor?: number
  block?: number

  // Weapon damage (primary)
  dmgMin1?: number
  dmgMax1?: number
  dmgType1?: number
  delay?: number

  // Weapon damage (secondary)
  dmgMin2?: number
  dmgMax2?: number
  dmgType2?: number

  // Stats
  stats: Array<{ type: number; value: number }>

  // Resistances
  holyRes?: number
  fireRes?: number
  natureRes?: number
  frostRes?: number
  shadowRes?: number
  arcaneRes?: number

  // Sockets
  socketColor1?: number
  socketColor2?: number
  socketColor3?: number
  socketBonusName?: string

  // Equip effects (pre-formatted strings like "Equip: +30 Spell Power")
  equipEffects?: string[]

  // Enchantments (from equipped items only)
  enchantmentTexts?: string[]

  // Durability
  maxDurability?: number
  currentDurability?: number

  // Class/Race restrictions
  allowableClass?: number
  allowableRace?: number

  // Flavor text
  description?: string

  // Sell price (copper)
  sellPrice?: number
}

export type CharacterTalent = {
  guid: number
  spell: number
  specMask: number // 1 = first spec, 2 = second spec, 3 = both specs
  spellName?: string
  spellRank?: string
  spellIconTexture?: string
  talentId?: number
  tabId?: number
  tier?: number
  column?: number
  currentRank: number
  maxRank: number
}

// Complete talent tree types
export type SpellEffectValues = {
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

export type TalentRankInfo = {
  rank: number
  spellId: number
  spellName: string
  description: string
  tooltip: string
  effectValues: SpellEffectValues
}

export type TalentTreeNode = {
  talentId: number
  tabId: number
  tier: number
  column: number
  ranks: TalentRankInfo[]
  maxRank: number
  iconTexture: string
  prereqTalent: number | null
  prereqRank: number | null
}

export type TalentTreeTab = {
  id: number
  name: string
  orderIndex: number
  backgroundFile: string
  iconTexture: string
  talents: TalentTreeNode[]
}

export type TalentTreeResponse = {
  classId: number
  tabs: TalentTreeTab[]
}

export type CharacterStats = {
  guid: number
  maxhealth: number
  maxpower1?: number
  maxpower2?: number
  maxpower3?: number
  maxpower4?: number
  maxpower5?: number
  maxpower6?: number
  maxpower7?: number
  strength: number
  agility: number
  stamina: number
  intellect: number
  spirit: number
  armor: number
  resHoly?: number
  resFire?: number
  resNature?: number
  resFrost?: number
  resShadow?: number
  resArcane?: number
  blockPct?: number
  dodgePct?: number
  parryPct?: number
  critPct?: number
  rangedCritPct?: number
  spellCritPct?: number
  attackPower?: number
  rangedAttackPower?: number
  spellPower?: number
  resilience?: number
}

export type CharacterDetailResponse = {
  character: {
    guid: number
    name: string
    race: number
    class: number
    gender: number
    level: number
    money: number
    health: number
    mana?: number
    rage?: number
    focus?: number
    energy?: number
    happiness?: number
    totalTime: number
    levelTime: number
    arenaPoints: number
    honorPoints: number
    totalKills: number
    chosenTitle?: number
    activeSpec: number
    specCount: number
  }
  items: CharacterItem[]
  talents: CharacterTalent[]
  achievements: any[]
  stats: CharacterStats[]
  realmId: string
}

// Shop Types
export type ShopCategory =
  | 'weapons'
  | 'armor'
  | 'consumables'
  | 'trade_goods'
  | 'gems'
  | 'recipes'
  | 'glyphs'
  | 'containers'
  | 'mounts'
  | 'miscellaneous'

export type ShopDeliveryMethod = 'mail' | 'bag' | 'both'

export type ShopItem = {
  entry: number
  name: string
  description: string
  class: number
  subclass: number
  quality: number
  buyPrice: number // Original vendor price in copper
  sellPrice: number
  shopPrice: number // Price with markup in copper
  icon: string
  inventoryType: number
  itemLevel: number
  requiredLevel: number
  maxStackSize: number
}

/** Extended item data for tooltip display */
export type ShopItemDetails = ShopItem & {
  // Binding
  bonding: number // 0=none, 1=BoP, 2=BoE, 3=BoU

  // Armor / Block
  armor: number
  block: number

  // Weapon damage (primary)
  dmgMin1: number
  dmgMax1: number
  dmgType1: number
  delay: number // weapon speed in ms

  // Weapon damage (secondary, e.g., elemental)
  dmgMin2: number
  dmgMax2: number
  dmgType2: number

  // Stats (up to 10)
  stats: Array<{ type: number; value: number }>

  // Resistances
  holyRes: number
  fireRes: number
  natureRes: number
  frostRes: number
  shadowRes: number
  arcaneRes: number

  // Sockets
  socketColor1: number
  socketColor2: number
  socketColor3: number
  socketBonus: number
  socketBonusName: string // resolved enchantment name

  // Equip spell effects ("Equip: Increases X by Y")
  equipEffects: string[]

  // Allowable class/race bitmask
  allowableClass: number
  allowableRace: number

  // Set & unique
  itemSet: number
  maxCount: number // unique-equip count (0 = unlimited)

  // Durability
  maxDurability: number

  // Item subclass name for display
  subclassName: string
  inventoryTypeName: string
}

/** Purchase history entry from queue tables */
export type ShopPurchaseHistoryEntry = {
  id: number
  itemEntry: number
  itemName: string
  itemQuality: number
  itemIcon: string
  quantity: number
  totalCost: number
  deliveryMethod: 'mail' | 'bag'
  status: 'pending' | 'done' | 'error' | 'waiting'
  createdAt: string
  processedAt: string | null
}

export type ShopCategoryInfo = {
  id: ShopCategory
  name: string
  description: string
  icon: string
}

export type ShopConfig = {
  enabled: boolean
  priceMarkupPercent: number // e.g., 20 means 20% markup
  deliveryMethod: ShopDeliveryMethod
  mailSubject: string
  mailBody: string
  categories: ShopCategory[]
}

export type ShopPurchaseRequest = {
  itemId: number
  quantity: number
  characterGuid: number
  realmId: string
  deliveryMethod?: 'mail' | 'bag' // User's choice when 'both' is enabled
}

export type ShopPurchaseResponse = {
  success: boolean
  message: string
  mailId?: number
  itemName?: string
  totalCost: number
  newBalance?: number
  deliveryMethod?: 'mail' | 'bag' // Which method was used
}
