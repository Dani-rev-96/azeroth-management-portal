/**
 * Auth composable - Thin layer for routing and auth guards
 * Use this for navigation helpers and derived/filtered state
 * Access store directly for simple state: authStore.user, authStore.isAuthenticated
 */
export const useAuth = () => {
  const authStore = useAuthStore()
  const router = useRouter()

  /**
   * Logout and redirect to login page
   * Adds routing logic on top of store's logout action
   */
  const logoutAndRedirect = async () => {
    await authStore.logout()
    await router.push('/login')
  }

  /**
   * Auth guard - redirect to login if not authenticated
   * Useful in route guards or component setup
   */
  const requireAuth = () => {
    if (!authStore.isAuthenticated) {
      router.push('/login')
      return false
    }
    return true
  }

  /**
   * Navigate to login page
   */
  const goToLogin = () => {
    router.push('/login')
  }

  /**
   * Navigate to dashboard
   */
  const goToDashboard = () => {
    router.push('/')
  }

  return {
    // Routing helpers
    logoutAndRedirect,
    requireAuth,
    goToLogin,
    goToDashboard,
  }
}
