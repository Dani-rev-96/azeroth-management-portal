// Keycloak User from oauth-proxy
export interface KeycloakUser {
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

export interface RealmConfig {
  id: RealmId
  name: string
  description: string
  version: string // WOTLK, etc.
  worldPort: number
  soapPort: number
  database: string
  databaseHost: string
}

// WoW Account (stored in auth database)
export interface WoWAccount {
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
export interface WoWCharacter {
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
export interface AccountMapping {
  keycloakId: string
  keycloakUsername: string
  wowAccountId: number
  wowAccountName: string
  realmId: RealmId
  createdAt: string
  lastUsed?: string
}

// Account Management Data (combined view for frontend)
export interface ManagedAccount {
  mapping: AccountMapping
  wowAccount: WoWAccount
  characters: WoWCharacter[]
  realm: RealmConfig
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

// SOAP Request/Response
export interface SoapRequest {
  command: string
  args?: string[]
}

export interface SoapResponse {
  status: number
  result?: string
}
