import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { RealmId, RealmConfig } from '~/types'

/**
 * Unified Character type used across the application
 * Combines WoWCharacter data with runtime information like online status
 */
export interface Character {
  guid: number
  name: string
  class: number
  race: number
  gender: number
  level: number
  money: number
  realmId: RealmId
  realmName: string
  accountId: number
  online: boolean
  zone?: number
  playtime?: number
}

/**
 * Online player info from the community API
 */
export interface OnlinePlayer {
  guid: number
  characterName: string
  level: number
  race: number
  class: number
  zone: number
  zoneName: string
  accountName: string
  realm: string
  realmId: string
  playtime: number
}

/**
 * Characters Store
 *
 * Entity store for managing characters and online players.
 * This is the single source of truth for online status.
 */
export const useCharactersStore = defineStore('characters', () => {
  // ==========================================================================
  // State - User's Characters
  // ==========================================================================
  const characters = ref<Character[]>([])
  const loading = ref(false)
  const error = ref('')
  const lastFetch = ref<Date | null>(null)

  // ==========================================================================
  // State - All Online Players (server-wide)
  // ==========================================================================
  const onlinePlayers = ref<OnlinePlayer[]>([])
  const onlinePlayersLoading = ref(false)
  const onlinePlayersError = ref<string | undefined>(undefined)

  // ==========================================================================
  // State - Polling
  // ==========================================================================
  const onlinePollingInterval = ref<ReturnType<typeof setInterval> | null>(null)
  const onlinePollingEnabled = ref(false)

  // ==========================================================================
  // Computed - Online Status
  // ==========================================================================

  /** Set of "realmId:guid" keys for quick online lookup */
  const onlineGuids = computed(() => {
    const guids = new Set<string>()
    for (const player of onlinePlayers.value) {
      guids.add(`${player.realmId}:${player.guid}`)
    }
    return guids
  })

  /** Count of all online players */
  const onlineCount = computed(() => onlinePlayers.value.length)

  // ==========================================================================
  // Computed - User's Characters
  // ==========================================================================

  const sortedCharacters = computed(() => {
    return [...characters.value].sort((a, b) => {
      // Online first, then by level
      if (a.online !== b.online) return a.online ? -1 : 1
      return b.level - a.level
    })
  })

  const onlineCharacters = computed(() => {
    return characters.value.filter(c => c.online)
  })

  const offlineCharacters = computed(() => {
    return characters.value.filter(c => !c.online)
  })

  const charactersByRealm = computed(() => {
    const grouped: Record<string, Character[]> = {}
    for (const char of characters.value) {
      if (!grouped[char.realmId]) {
        grouped[char.realmId] = []
      }
      grouped[char.realmId]!.push(char)
    }
    return grouped
  })

  const hasCharacters = computed(() => characters.value.length > 0)

  // ==========================================================================
  // Actions - Online Players
  // ==========================================================================

  /**
   * Fetch all online players from the server
   */
  async function fetchOnlinePlayers() {
    onlinePlayersLoading.value = true
    onlinePlayersError.value = undefined

    try {
      const data = await $fetch<OnlinePlayer[]>('/api/community/online')
      onlinePlayers.value = data || []

      // Update online status on user's characters
      updateCharactersOnlineStatus()
    } catch (err) {
      onlinePlayersError.value = 'Failed to fetch online players'
      console.error('Failed to fetch online players:', err)
    } finally {
      onlinePlayersLoading.value = false
    }
  }

  /**
   * Update online status on all user's characters based on onlinePlayers
   */
  function updateCharactersOnlineStatus() {
    for (const char of characters.value) {
      const key = `${char.realmId}:${char.guid}`
      char.online = onlineGuids.value.has(key)
    }
  }

  /**
   * Start polling for online status updates
   */
  function startOnlinePolling(intervalMs: number = 30000) {
    if (onlinePollingInterval.value) {
      return // Already polling
    }

    onlinePollingEnabled.value = true
    onlinePollingInterval.value = setInterval(() => {
      fetchOnlinePlayers()
    }, intervalMs)
  }

  /**
   * Stop polling for online status
   */
  function stopOnlinePolling() {
    if (onlinePollingInterval.value) {
      clearInterval(onlinePollingInterval.value)
      onlinePollingInterval.value = null
    }
    onlinePollingEnabled.value = false
  }

  // ==========================================================================
  // Actions - User's Characters
  // ==========================================================================

  /**
   * Load all characters from user's linked WoW accounts
   */
  async function loadCharacters() {
    const authStore = useAuthStore()

    if (!authStore.user) {
      error.value = 'Please log in to view characters'
      return
    }

    loading.value = true
    error.value = ''

    try {
      const accounts = await $fetch<any[]>(`/api/accounts/user/${authStore.user.sub}`)

      if (!accounts || accounts.length === 0) {
        error.value = 'No linked WoW accounts found. Link an account first.'
        characters.value = []
        return
      }

      const chars: Character[] = []

      for (const account of accounts) {
        if (account.realms) {
          for (const realmData of account.realms) {
            const realm: RealmConfig = realmData.realm
            for (const char of realmData.characters || []) {
              const key = `${realm.id}:${char.guid}`
              chars.push({
                guid: char.guid,
                name: char.name,
                class: char.class,
                race: char.race,
                gender: char.gender ?? 0,
                level: char.level,
                money: char.money || 0,
                realmId: realm.id,
                realmName: realm.name,
                accountId: account.wowAccount?.id ?? account.mapping?.wowAccountId,
                // Use online status from DB if available, otherwise check onlineGuids
                online: char.online ?? onlineGuids.value.has(key),
              })
            }
          }
        }
      }

      characters.value = chars
      lastFetch.value = new Date()

      // Refresh online status after loading characters
      await fetchOnlinePlayers()
    } catch (err) {
      console.error('Failed to load characters:', err)
      error.value = 'Failed to load characters'
    } finally {
      loading.value = false
    }
  }

  /**
   * Get a character by guid and realm
   */
  function getCharacter(guid: number, realmId: RealmId): Character | undefined {
    return characters.value.find(c => c.guid === guid && c.realmId === realmId)
  }

  /**
   * Check if a character is online
   */
  function isOnline(guid: number, realmId: RealmId): boolean {
    const key = `${realmId}:${guid}`
    return onlineGuids.value.has(key)
  }

  /**
   * Update a character's money (after purchase, etc.)
   */
  function updateMoney(guid: number, realmId: RealmId, newBalance: number) {
    const char = getCharacter(guid, realmId)
    if (char) {
      char.money = newBalance
    }
  }

  function $reset() {
    stopOnlinePolling()
    characters.value = []
    onlinePlayers.value = []
    loading.value = false
    error.value = ''
    lastFetch.value = null
  }

  return {
    // State - User's Characters
    characters,
    loading,
    error,
    lastFetch,

    // State - Online Players
    onlinePlayers,
    onlinePlayersLoading,
    onlinePlayersError,
    onlinePollingEnabled,
    onlineGuids,
    onlineCount,

    // Getters - User's Characters
    sortedCharacters,
    onlineCharacters,
    offlineCharacters,
    charactersByRealm,
    hasCharacters,

    // Actions - Online Players
    fetchOnlinePlayers,
    startOnlinePolling,
    stopOnlinePolling,

    // Actions - User's Characters
    loadCharacters,
    getCharacter,
    isOnline,
    updateMoney,

    $reset,
  }
})
