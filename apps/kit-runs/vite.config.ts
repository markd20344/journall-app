import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  // Deployed alongside the journal app as a subpath of the same GitHub
  // Pages site (see .github/workflows/deploy.yml) — a distinct base/scope
  // is what makes this installable as its own separate home-screen app.
  base: '/journall-app/kit-runs/',
  resolve: {
    alias: {
      '@journall/shared': path.resolve(dirname, '../../packages/shared/src'),
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'Kit Runs',
        short_name: 'Kit Runs',
        description: 'Daily kit-collection round tracker: import jobs, plan the route, track visits and drop-offs.',
        theme_color: '#2563eb',
        background_color: '#eef3fc',
        display: 'standalone',
        start_url: '/journall-app/kit-runs/',
        scope: '/journall-app/kit-runs/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
})
