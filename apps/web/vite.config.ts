import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'DealDost — Best Amazon & Flipkart Deals from Telegram',
        short_name: 'DealDost',
        description: 'Best Amazon & Flipkart deals from Telegram',
        theme_color: '#f97316',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
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
