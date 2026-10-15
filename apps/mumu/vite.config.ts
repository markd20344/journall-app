/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Mumu is served from the root of its own Firebase Hosting site (see
// firebase.json), not a GitHub Pages subpath like the other apps.
export default defineConfig({
  base: '/',
  define: {
    // Shown on the More tab, so it's obvious which deploy a device is running.
    __APP_VERSION__: JSON.stringify(new Date().toISOString().slice(0, 16).replace('T', ' ')),
  },
  resolve: {
    alias: {
      '@journall/shared': path.resolve(dirname, '../../packages/shared/src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      // 'prompt', not 'autoUpdate': a silent reload mid-edit would throw away
      // an unsaved form. UpdatePrompt lets the user pick the moment.
      registerType: 'prompt',
      manifest: {
        name: 'Mumu',
        short_name: 'Mumu',
        description: 'People, companies, notes and journal in one private place.',
        theme_color: '#1e3a8a',
        background_color: '#eef2fb',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
        // Firebase Hosting's reserved auth handler must always hit the network.
        navigateFallbackDenylist: [/^\/__\//],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
