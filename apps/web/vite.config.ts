import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/', // 1. CRITICAL: Forces Vite to bundle with absolute paths for production
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // 2. CRITICAL: Tells the PWA service worker to inject and allow these static assets
      includeAssets: ['favicon.svg', 'favicon-32.png', 'apple-touch-icon.png', 'robots.txt', 'sitemap.xml'],
      manifest: {
        name: 'DealDost — Best Amazon & Flipkart Deals from Telegram',
        short_name: 'DealDost',
        description: 'Best Amazon & Flipkart deals from Telegram',
        theme_color: '#f97316',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          // Make sure you have an actual 'icon-192.png' file inside your /public folder as well!
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        runtimeCaching: [
          {
            urlPattern: /\/v1\/deals/,
            handler: 'NetworkFirst',
            options: { cacheName: 'deals-cache', expiration: { maxEntries: 100, maxAgeSeconds: 300 } },
          },
        ],
      },
    }),
  ],
  server: {
    allowedHosts: ["dealdost.shop", "www.dealdost.shop"],
    proxy: {
      '/v1': 'http://localhost:5000',
    },
  },
});
