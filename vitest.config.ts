import { defineConfig } from 'vitest/config'
import { resolve } from 'path'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'app/utils/**',
        'app/stores/**',
        'app/components/**',
        'shared/utils/**',
        'server/utils/**',
        'server/services/**',
      ],
    },
  },
  resolve: {
    alias: {
      '~': resolve(__dirname, 'app'),
      '~~': resolve(__dirname),
      '#shared': resolve(__dirname, 'shared'),
      '#server': resolve(__dirname, 'server'),
      '~~/shared': resolve(__dirname, 'shared'),
    },
  },
})
