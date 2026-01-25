// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  ssr: true,
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
