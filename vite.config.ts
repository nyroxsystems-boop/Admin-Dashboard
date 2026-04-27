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
    // Hidden sourcemaps: emitted but NOT referenced via //# sourceMappingURL
    sourcemap: 'hidden',
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
          // Charts — only loaded on dashboards/reports
          'vendor-charts': ['recharts'],
          // Animations — broadly used but big
          'vendor-motion': ['framer-motion'],
          // Carousels — only on a few views
          'vendor-embla': ['embla-carousel-react'],
          // Forms — widely used
          'vendor-forms': ['react-hook-form'],
          // Date utils — fairly stable
          'vendor-date': ['date-fns'],
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
