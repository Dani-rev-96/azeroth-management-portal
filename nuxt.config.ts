// Nuxt Configuration
// Database credentials are read directly from process.env at RUNTIME in server/utils/config/index.ts
// This is critical for Kubernetes deployments where env vars are injected at runtime
const path = require('path')

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: true,

  // Runtime configuration
  // NOTE: Database config (NUXT_DB_*) is read directly from process.env in server/utils/config/index.ts
  // This avoids build-time vs runtime issues with dynamic environment variables in Kubernetes
  runtimeConfig: {
    // Public - accessible in browser (use NUXT_PUBLIC_* env vars)
    public: {
      // Auth mode: 'mock' (local dev) | 'oauth-proxy' (production) | 'header' (generic) | 'direct' (WoW account login)
      authMode: 'direct',
      mockUser: 'admin',
      mockEmail: 'admin@localhost',
      mockGMLevel: 3,

      // External services
      directusUrl: 'http://localhost:8055',

      // App config
      appBaseUrl: 'http://localhost:3000',

      // Debug mode
      debugMode: false,

      // Shop config
      shopDeliveryMethod: 'mail',  // 'mail' | 'bag' | 'both'
      shopMarkupPercent: 20,

      // File paths
      publicPath: path.resolve(process.cwd(), 'data/public'),
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
