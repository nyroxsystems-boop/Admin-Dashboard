/// <reference types="vitest" />
import { defineConfig } from 'vite'
import path from 'path'
import { fileURLToPath } from 'url'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
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
  // Explicitly embed environment variables in the build
  // NOTE: Only non-secret config here! API tokens must NOT be in the bundle.
  define: {
    'import.meta.env.VITE_API_BASE_URL': JSON.stringify(
      process.env.VITE_API_BASE_URL || ''
    ),
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
        target: process.env.VITE_API_BASE_URL || 'http://localhost:10000',
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
  },
})
