// Keycloak User from oauth-proxy
export type KeycloakUser = {
  sub: string
  preferred_username: string
  email: string
  name?: string
  given_name?: string
  family_name?: string
  email_verified: boolean
}

// WoW Server Realm Configuration
export type RealmId = 'wotlk' | 'wotlk-ip' | 'wotlk-ip-boosted'

export type RealmConfig = {
  id: RealmId
  realmId: number // Numeric ID from realmlist table
  name: string
  description: string
  version: string // WOTLK, etc.
  worldPort: number
  soapPort: number
  database: string
  databaseHost: string
  databaseKey: string // References the database config key (e.g., 'blizzlike-db', 'ip-db')
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

// Mapping between Keycloak and WoW Account
export type AccountMapping = {
  keycloakId: string
  keycloakUsername: string
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
