/**
 * useServerConfig composable
 * Fetches server/realm configuration
 */
import type { RealmConfig } from '~/types'

interface ServerConfig {
  realms: Record<string, RealmConfig>
}

export async function useServerConfig(): Promise<ServerConfig> {
  const { data } = await useFetch<ServerConfig>('/api/realms')
  return data.value || { realms: {} }
}

/**
 * useRealmOptions composable
 * Returns realm options for select dropdowns
 */
export function useRealmOptions() {
  const realms = ref<Record<string, RealmConfig>>({})
  const loading = ref(true)
  const error = ref<string | null>(null)

  async function loadRealms() {
    loading.value = true
    error.value = null

    try {
      const config = await useServerConfig()
      realms.value = config.realms
    } catch (err) {
      error.value = 'Failed to load realms'
      console.error('Failed to load realms:', err)
    } finally {
      loading.value = false
    }
  }

  const realmOptions = computed(() =>
    Object.entries(realms.value).map(([id, realm]) => ({
      value: id,
      label: realm.name,
    }))
  )

  const realmList = computed(() =>
    Object.entries(realms.value).map(([key, realm]) => ({
      ...realm,
      key, // Add the key as an additional property if needed
    }))
  )

  return {
    realms,
    realmOptions,
    realmList,
    loading,
    error,
    loadRealms,
  }
}
