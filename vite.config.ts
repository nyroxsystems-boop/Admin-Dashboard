/// <reference types="vitest" />
import { defineConfig, loadEnv } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, 'VITE_')
  const apiBaseUrl = env.VITE_API_BASE_URL

  // Vite normally exposes VITE_* values from .env files automatically. The
  // previous explicit `define` read process.env instead, which silently
  // replaced a valid .env.local value with an empty string and produced a
  // bundle that crashed during boot. Validate the same value Vite will expose.
  if (mode !== 'test') {
    if (!apiBaseUrl) {
      throw new Error('VITE_API_BASE_URL is required. Set it in .env.local or the build environment.')
    }
    let parsed: URL
    try {
      parsed = new URL(apiBaseUrl)
    } catch {
      throw new Error('VITE_API_BASE_URL must be an absolute http(s) URL.')
    }
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('VITE_API_BASE_URL must use http or https.')
    }
  }

  return {
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    // Source maps NEVER ship to production. The previous conditional
    // (`UPLOAD_SOURCEMAPS === '1'`) was being toggled on by Railway's
    // build env, so .map files were still landing on the CDN. If we
    // ever need maps for a Sentry release, build them locally with
    // `npm run build:sentry` (a separate script) and upload via
    // `sentry-cli sourcemaps upload`, NOT via the production image.
    sourcemap: false,
    minify: 'esbuild',
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      output: {
        manualChunks: {
          // React core — changes rarely, cached long-term
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Icon library — large but stable
          'vendor-icons': ['lucide-react'],
          // UI utilities — sonner toasts, dompurify
          'vendor-ui': ['sonner', 'dompurify'],
          // Animations — broadly used but big
          'vendor-motion': ['framer-motion'],
          // React Query — server state cache
          'vendor-query': ['@tanstack/react-query'],
        },
      },
    },
  },
  // Strip console.log / .info / .debug / .trace and debugger statements
  // from production bundles. console.warn and console.error stay so
  // runtime problems still surface in error trackers.
  esbuild: {
    pure: ['console.log', 'console.info', 'console.debug', 'console.trace'],
    drop: ['debugger'],
  },
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: apiBaseUrl || 'http://localhost:10000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  preview: {
    port: 4173,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    exclude: ['e2e/**', 'node_modules/**'],
    css: true,
    reporters: ['default', ['junit', { outputFile: 'test-results.xml' }]],
    // api/client.ts verweigert absichtlich den Start ohne diese Variable —
    // kein stiller Rückfall auf eine Produktionsadresse. Im Test wird sie
    // deshalb ausdrücklich gesetzt; der Wert wird nie aufgerufen, weil fetch
    // in den Tests stillgelegt ist.
    env: {
      VITE_API_BASE_URL: 'http://test.local',
      VITE_SCRAPER_BASE_URL: 'http://test.local',
    },
  },
  }
})
