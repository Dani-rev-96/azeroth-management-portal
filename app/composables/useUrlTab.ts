/**
 * useUrlTab composable
 * Syncs tab state with URL query parameter
 */
export function useUrlTab(defaultTab: string, paramName: string = 'tab') {
  const route = useRoute()
  const router = useRouter()

  // Get initial tab from URL or use default
  const activeTab = ref<string>(
    (route.query[paramName] as string) || defaultTab
  )

  // Watch for URL changes and update tab
  watch(
    () => route.query[paramName],
    (newTab) => {
      if (newTab && typeof newTab === 'string') {
        activeTab.value = newTab
      } else if (!newTab) {
        activeTab.value = defaultTab
      }
    }
  )

  // Update URL when tab changes
  function setTab(tabId: string) {
    activeTab.value = tabId

    // Update URL without triggering navigation
    router.replace({
      query: {
        ...route.query,
        [paramName]: tabId === defaultTab ? undefined : tabId,
      },
    })
  }

  // Computed for v-model compatibility
  const tab = computed({
    get: () => activeTab.value,
    set: (value: string) => setTab(value),
  })

  return {
    activeTab: tab,
    setTab,
  }
}
