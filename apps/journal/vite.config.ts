import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages serves this repo's project site from /journall-app/, with
  // Kit Runs and Family Tree living alongside it as subpaths of the same
  // site (see .github/workflows/deploy.yml) — this app keeps the root path
  // it's always had so existing installs/bookmarks keep working.
  base: '/journall-app/',
  resolve: {
    alias: {
      '@journall/shared': path.resolve(dirname, '../../packages/shared/src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt' instead of 'autoUpdate': a background reload the instant a
      // new deploy lands can silently discard an in-progress, unsaved
      // journal entry or item edit (drafts live only in React state until
      // Save is tapped). This ships new versions often enough that the
      // silent-reload risk is real, not theoretical — UpdatePrompt.tsx lets
      // the user choose when to pick up the new version instead.
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Journall OS',
        short_name: 'Journall OS',
        description: 'A private, local-first journal, log, calendar, and job tracker.',
        theme_color: '#2563eb',
        background_color: '#eef3fc',
        display: 'standalone',
        start_url: '/journall-app/',
        scope: '/journall-app/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the app shell so it opens instantly offline; journal data
        // itself lives in IndexedDB, not the cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
