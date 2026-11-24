/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const dirname = path.dirname(fileURLToPath(import.meta.url))

// Deployed as its own subpath of the GitHub Pages site (see
// scripts/assemble-site.mjs). Its own base/scope is what makes it install as
// a separate home-screen icon from Journall OS and Kit Runs.
export default defineConfig({
  base: '/journall-app/organise/',
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
        name: 'Organise',
        short_name: 'Organise',
        description: 'Food shopping, clothes and to-dos: tap the mic and say it.',
        theme_color: '#15803d',
        background_color: '#f1f7f2',
        display: 'standalone',
        start_url: '/journall-app/organise/',
        scope: '/journall-app/organise/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Long-press the home-screen icon (Android) to jump straight to a list's mic.
        shortcuts: [
          { name: 'Add food', short_name: 'Food', url: '/journall-app/organise/?list=food&voice=1', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Add clothes', short_name: 'Clothes', url: '/journall-app/organise/?list=clothes&voice=1', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
          { name: 'Add a to-do', short_name: 'To-do', url: '/journall-app/organise/?list=todo&voice=1', icons: [{ src: 'icons/icon-192.png', sizes: '192x192' }] },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico}'],
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
})
