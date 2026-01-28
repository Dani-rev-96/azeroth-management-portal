// Load database credentials from environment variables
// Configure via .env.local (development) or environment variables (production)
const path = require('path')

interface RealmEnvConfig {
  id: string
  name: string
  description: string
  user: string
  password: string
  host: string
  port: number
}

/**
 * Load realms from environment variables
 * Supports NUXT_DB_REALM_0_*, NUXT_DB_REALM_1_*, etc. up to 10 realms
 */
function loadRealmsFromEnv(): RealmEnvConfig[] {
  const realms: RealmEnvConfig[] = []
  const maxRealms = 10

  for (let i = 0; i < maxRealms; i++) {
    const prefix = `NUXT_DB_REALM_${i}_`
    const id = process.env[`${prefix}ID`]
    const name = process.env[`${prefix}NAME`]

    // Skip if realm is not defined
    if (!id || !name) continue

    realms.push({
      id,
      name,
      description: process.env[`${prefix}DESCRIPTION`] || '',
      user: process.env[`${prefix}USER`] || 'acore',
      password: process.env[`${prefix}PASSWORD`] || 'acore',
      host: process.env[`${prefix}HOST`] || 'localhost',
      port: parseInt(process.env[`${prefix}PORT`] || '3306', 10),
    })
  }

  return realms
}

// Load realms from environment
const realmsFromEnv = loadRealmsFromEnv()

// Build realm runtime config from environment variables
function buildRealmRuntimeConfig(): Record<string, any> {
  const config: Record<string, any> = {}

  for (let i = 0; i < 10; i++) {
    const realm = realmsFromEnv[i]
    if (realm) {
      config[`realm${i}Id`] = realm.id
      config[`realm${i}Name`] = realm.name
      config[`realm${i}Description`] = realm.description
      config[`realm${i}User`] = realm.user
      config[`realm${i}Password`] = realm.password
      config[`realm${i}Host`] = realm.host
      config[`realm${i}Port`] = realm.port
    } else {
      // Provide empty defaults so Nuxt doesn't complain
      config[`realm${i}Id`] = ''
      config[`realm${i}Name`] = ''
      config[`realm${i}Description`] = ''
      config[`realm${i}User`] = ''
      config[`realm${i}Password`] = ''
      config[`realm${i}Host`] = ''
      config[`realm${i}Port`] = 0
    }
  }

  return config
}

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: true,

  // Runtime configuration - all settings via environment variables
  // See .env.example for available options
  runtimeConfig: {
    db: {
      // Auth database (shared across all realms)
      authUser: process.env.NUXT_DB_AUTH_USER || 'acore',
      authPassword: process.env.NUXT_DB_AUTH_PASSWORD || 'acore',
      authHost: process.env.NUXT_DB_AUTH_HOST || 'localhost',
      authPort: parseInt(process.env.NUXT_DB_AUTH_PORT || '3306', 10),

      // Realm configurations (up to 10 realms)
      // Format: NUXT_DB_REALM_0_ID, NUXT_DB_REALM_0_NAME, NUXT_DB_REALM_0_USER, etc.
      ...buildRealmRuntimeConfig(),
    },
    // Public - accessible in browser (use NUXT_PUBLIC_* env vars)
    public: {
      // Auth mode: 'mock' (local dev) | 'oauth-proxy' (production) | 'keycloak' (staging)
      authMode: process.env.NUXT_PUBLIC_AUTH_MODE || 'mock',
      mockUser: process.env.NUXT_PUBLIC_MOCK_USER || 'admin',
      mockEmail: process.env.NUXT_PUBLIC_MOCK_EMAIL || 'admin@localhost',
      mockGMLevel: parseInt(process.env.NUXT_PUBLIC_MOCK_GM_LEVEL || '3', 10),

      // External services
      keycloakUrl: process.env.NUXT_PUBLIC_KEYCLOAK_URL || 'http://localhost:8080',
      keycloakRealm: process.env.NUXT_PUBLIC_KEYCLOAK_REALM || 'wow',
      directusUrl: process.env.NUXT_PUBLIC_DIRECTUS_URL || 'http://localhost:8055',

      // App config
      appBaseUrl: process.env.NUXT_PUBLIC_APP_BASE_URL || 'http://localhost:3000',

      // File paths
      publicPath: process.env.PUBLIC_PATH || path.resolve(process.cwd(), 'data/public'),
    },
  },

  nitro: {
    experimental: {
      bodySizeLimit: 53687091200, // 50GB in bytes for large file uploads
    },
  },

	vite: {
		css: {
			preprocessorOptions: {
				scss: {
					api: "modern-compiler",
				},
			},
		},
	},
	app: {
		head: {
			charset: "utf-8",
			viewport: "width=device-width, initial-scale=1",
			htmlAttrs: {
				lang: "de",
			},
		},
	},

  modules: [
		"@vueuse/nuxt",
		"@pinia/nuxt",
		"@vite-pwa/nuxt",
		"nuxt-svgo",
		// "@nuxt/image",
		// "nuxt-directus",
		// "@nuxtjs/sitemap",
		"nuxt-multi-cache",
		"nuxt-viewport",
		"@primevue/nuxt-module",
		// ["nuxt-jsonld", { disableOptionsAPI: true }],
		"nuxt-vitalizer",
	],
	imports: {
		autoImport: true,
	},
  multiCache: {
		debug: false,
		route: {
			enabled: true,
		},
		api: {
			enabled: true,
			authorization: "mybesttempcachecleartoken",
		},
	},
  svgo: {
		global: false,
	},
	vue: {
		compilerOptions: {
			isCustomElement: (tag: string) => ["swiper-container", "swiper-slide"].includes(tag),
		},
	},
	vitalizer: {
		// Remove the render-blocking entry CSS
		disableStylesheets: "entry",
		disablePrefetchLinks: true,
	},
})
