// Load database credentials and environment config from .json file before config initialization
// This runs during build and SSR startup
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

interface DbCredentials {
  user: string
  password: string
}

interface CredentialsFile {
  databases: {
    'auth-db': DbCredentials & { host?: string; port?: number }
    'blizzlike-db': DbCredentials & { host?: string; port?: number }
    'ip-db': DbCredentials & { host?: string; port?: number }
    'ip-boosted-db': DbCredentials & { host?: string; port?: number }
  }
  env?: {
    // Auth configuration
    authMode?: 'mock' | 'oauth-proxy' | 'keycloak'
    mockUser?: string
    mockEmail?: string

    // External services
    keycloakUrl?: string
    keycloakRealm?: string
    directusUrl?: string

    // App config
    appBaseUrl?: string
  }
}

function loadDbCredentials(): CredentialsFile | null {
  const env = process.env.NODE_ENV || 'development'
  const envMap: Record<string, string> = {
    production: 'production',
    staging: 'staging',
    development: 'local',
  }

  const envName = envMap[env] || 'local'
  const plainPath = path.resolve(process.cwd(), `.db.${envName}.json`)
  const encPath = path.resolve(process.cwd(), `.db.${envName}.enc.json`)

  // Try plain file first (local development)
  if (fs.existsSync(plainPath)) {
    try {
      const credContent = fs.readFileSync(plainPath, 'utf-8')
      const credentials: CredentialsFile = JSON.parse(credContent)
      console.log(`[✓] Loaded credentials from .db.${envName}.json`)
      return credentials
    } catch (error) {
      console.warn(`[WARN] Failed to load .db.${envName}.json:`, error)
    }
  }

  // Try encrypted file (staging/production)
  if (fs.existsSync(encPath)) {
    try {
      const decrypted = execSync(`sops -d "${encPath}"`, { encoding: 'utf-8' })
      const credentials: CredentialsFile = JSON.parse(decrypted)
      console.log(`[✓] Decrypted credentials from .db.${envName}.enc.json`)
      return credentials
    } catch (error) {
      console.warn(`[WARN] Failed to decrypt .db.${envName}.enc.json`)
      console.warn(`[HINT] Make sure SOPS and age/KMS are configured:`)
      console.warn(`  - Local: export SOPS_AGE_KEY_FILE=~/.age/keys.txt`)
      console.warn(`  - AWS: Set AWS_PROFILE or AWS credentials`)
      console.warn(`  - Or create .db.${envName}.json (plaintext)`)
      return null
    }
  }

  console.warn(`[WARN] No credentials file found for environment: ${envName}`)
  console.warn(`[HINT] Expected .db.${envName}.json or .db.${envName}.enc.json`)
  return null
}

// Load credentials before exporting config
const credentials = loadDbCredentials()

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: true,

  // Runtime configuration
  // Note: Server/database configs are in shared/utils/config/{local,staging,production}.ts
  runtimeConfig: {
	db: {
	  authUser: credentials?.databases['auth-db']?.user || 'acore',
	  authPassword: credentials?.databases['auth-db']?.password || 'acore',
	  authHost: credentials?.databases['auth-db']?.host || 'localhost',
	  authPort: credentials?.databases['auth-db']?.port || 3306,
	  blizzlikeWorldUser: credentials?.databases['blizzlike-db']?.user || 'acore',
	  blizzlikeWorldPassword: credentials?.databases['blizzlike-db']?.password || 'acore',
	  blizzlikeWorldHost: credentials?.databases['blizzlike-db']?.host || 'localhost',
	  blizzlikeWorldPort: credentials?.databases['blizzlike-db']?.port || 3306,
	  ipWorldUser: credentials?.databases['ip-db']?.user || 'acore',
	  ipWorldPassword: credentials?.databases['ip-db']?.password || 'acore',
	  ipWorldHost: credentials?.databases['ip-db']?.host || 'localhost',
	  ipWorldPort: credentials?.databases['ip-db']?.port || 3307,
	  ipBoostedWorldUser: credentials?.databases['ip-boosted-db']?.user || 'acore',
	  ipBoostedWorldPassword: credentials?.databases['ip-boosted-db']?.password || 'acore',
	  ipBoostedWorldHost: credentials?.databases['ip-boosted-db']?.host || 'localhost',
	  ipBoostedWorldPort: credentials?.databases['ip-boosted-db']?.port || 3308,
	},
    // Public - accessible in browser
    public: {
      // Auth mode: 'mock' (local dev) | 'oauth-proxy' (production) | 'keycloak' (staging)
      authMode: credentials?.env?.authMode || 'mock',
      mockUser: credentials?.env?.mockUser || 'admin',
      mockEmail: credentials?.env?.mockEmail || 'admin@localhost',
			mockGMLevel: credentials?.env?.mockGMLevel || 3,

      // External services
      keycloakUrl: credentials?.env?.keycloakUrl || 'http://localhost:8080',
      keycloakRealm: credentials?.env?.keycloakRealm || 'wow',
      directusUrl: credentials?.env?.directusUrl || 'http://localhost:8055',

      // App config
      appBaseUrl: credentials?.env?.appBaseUrl || 'http://localhost:3000',

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
