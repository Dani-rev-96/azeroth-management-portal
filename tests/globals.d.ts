/**
 * Global type declarations for test environment.
 * These match the stubs defined in tests/setup.ts.
 */
import type { Mock } from 'vitest'

declare global {
  // Nuxt globals stubbed in setup.ts
  const $fetch: Mock
  const useFetch: Mock
  const useRouter: () => {
    push: Mock
    replace: Mock
    back: Mock
    go: Mock
  }
  const useRoute: () => {
    query: Record<string, string>
    params: Record<string, string>
    path: string
    fullPath: string
    name: string
    meta: Record<string, unknown>
  }
  const navigateTo: Mock
  const useState: <T>(key: string, init?: () => T) => import('vue').Ref<T>
  const useRuntimeConfig: () => { public: Record<string, unknown> }
  const definePageMeta: Mock
}

export {}
