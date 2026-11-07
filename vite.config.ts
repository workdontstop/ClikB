import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import { isScheduledDarkMode } from './src/themeSchedule'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    {
      name: 'clikb-startup-theme',
      transformIndexHtml: {
        order: 'pre',
        handler: (html) => html.replace('__CLIKB_SCHEDULED_DARK_MODE__', `(${isScheduledDarkMode.toString()})(new Date().getHours())`),
      },
    },
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'mask-icon.svg'],
      workbox: {
        // Public guides must load their own HTML, including after a PWA install.
        navigateFallbackDenylist: [/^\/(about|how-it-works|ai-video-creator|playable-ai-video|pricing|examples)(\/|$)/],
        // Keep the current application bundle available in the installed PWA.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024
      },
      devOptions: {
        enabled: true
      },
      manifest: {
        name: 'ClikB App',
        short_name: 'ClikB',
        description: 'Create AI videos, cinematic stories and interactive experiences with ClikB',
        theme_color: '#ffffff',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ],
})
