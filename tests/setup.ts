/**
 * Vitest global setup file
 *
 * Provides Vue composition API globals that Nuxt auto-imports in production.
 * This ensures SFC components compile and run correctly in tests.
 */
import { vi } from 'vitest'
import {
  ref,
  computed,
  reactive,
  readonly,
  watch,
  watchEffect,
  onMounted,
  onUnmounted,
  onBeforeMount,
  onBeforeUnmount,
  nextTick,
  defineComponent,
  provide,
  inject,
  shallowRef,
  shallowReactive,
  unref,
  isRef,
  toRef,
  toRefs,
  toRaw,
  markRaw,
  triggerRef,
  h,
} from 'vue'

// Register Vue composition API as globals (Nuxt auto-imports these)
const vueGlobals: Record<string, unknown> = {
  ref,
  computed,
  reactive,
  readonly,
  watch,
  watchEffect,
  onMounted,
  onUnmounted,
  onBeforeMount,
  onBeforeUnmount,
  nextTick,
  defineComponent,
  provide,
  inject,
  shallowRef,
  shallowReactive,
  unref,
  isRef,
  toRef,
  toRefs,
  toRaw,
  markRaw,
  triggerRef,
  h,
}

for (const [key, value] of Object.entries(vueGlobals)) {
  vi.stubGlobal(key, value)
}

// Stub Nuxt-specific composables that components may use
// useState acts like a shared ref keyed by name
const stateStore = new Map<string, any>()
vi.stubGlobal('useState', (key: string, init?: () => any) => {
  if (!stateStore.has(key)) {
    stateStore.set(key, ref(init ? init() : undefined))
  }
  return stateStore.get(key)
})

// Stub navigateTo, useRouter, useRoute, useFetch, $fetch
vi.stubGlobal('navigateTo', vi.fn())
vi.stubGlobal('useRouter', () => ({
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  go: vi.fn(),
}))
vi.stubGlobal('useRoute', () => ({
  query: {},
  params: {},
  path: '/',
  fullPath: '/',
  name: '',
  meta: {},
}))
vi.stubGlobal('useFetch', vi.fn().mockResolvedValue({ data: ref(null), error: ref(null), pending: ref(false) }))
vi.stubGlobal('$fetch', vi.fn())
vi.stubGlobal('useRuntimeConfig', () => ({ public: {} }))
vi.stubGlobal('definePageMeta', vi.fn())
