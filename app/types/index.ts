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
  icon?: string
  enchantments?: string
  enchantmentTexts?: string[]
  enchantmentInfos?: any[]
  randomPropertyId?: number
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
export type ShopCategory = 'trade_goods' | 'mounts' | 'miscellaneous'

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
