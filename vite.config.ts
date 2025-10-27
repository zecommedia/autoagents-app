import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      base: './', // Use relative paths for Electron
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          // proxy frontend requests starting with /api or /health to backend
          '/api': {
            target: 'http://localhost:4000',
            changeOrigin: true,
            secure: false,
          },
          '/health': {
            target: 'http://localhost:4000',
            changeOrigin: true,
            secure: false,
          }
        }
      },
      plugins: [
        react(),
        VitePWA({
          registerType: 'prompt',
          includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'logo192.png', 'logo512.png'],
          manifest: {
            name: 'AutoAgents AI - Image Editor',
            short_name: 'AutoAgents',
            description: 'AI-Powered Image Editing Platform with Clone Mode, Mockup Generator & More',
            theme_color: '#6366f1',
            background_color: '#ffffff',
            display: 'standalone',
            start_url: '/',
            icons: [
              {
                src: 'logo192.png',
                sizes: '192x192',
                type: 'image/png',
                purpose: 'any maskable'
              },
              {
                src: 'logo512.png',
                sizes: '512x512',
                type: 'image/png',
                purpose: 'any maskable'
              }
            ],
            categories: ['productivity', 'graphics', 'photo'],
            screenshots: [
              {
                src: 'screenshot1.png',
                sizes: '1280x720',
                type: 'image/png',
                label: 'Clone Mode - AI Pattern Extraction'
              }
            ]
          },
          workbox: {
            // Cache strategies for offline support
            runtimeCaching: [
              {
                urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'google-fonts-cache',
                  expiration: {
                    maxEntries: 10,
                    maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
                  },
                  cacheableResponse: {
                    statuses: [0, 200]
                  }
                }
              },
              {
                urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
                handler: 'CacheFirst',
                options: {
                  cacheName: 'images-cache',
                  expiration: {
                    maxEntries: 50,
                    maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
                  }
                }
              },
              {
                urlPattern: /^https:\/\/cdn\..*/i,
                handler: 'StaleWhileRevalidate',
                options: {
                  cacheName: 'cdn-cache',
                  expiration: {
                    maxEntries: 20,
                    maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
                  }
                }
              }
            ],
            globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
            globIgnores: ['**/output/**'], // Ignore test output folder
            maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB limit (default 2MB)
            cleanupOutdatedCaches: true,
            skipWaiting: true,
            clientsClaim: true
          },
          devOptions: {
            enabled: true,
            type: 'module'
          }
        })
      ],
      define: {
        'process.env.API_KEY': JSON.stringify(env.VITE_API_KEY || env.API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.VITE_API_KEY || env.GEMINI_API_KEY),
        'process.env.OPENAI_API_KEY': JSON.stringify(env.VITE_OPENAI_API_KEY || env.OPENAI_API_KEY),
        '__VITE_API_KEY__': JSON.stringify(env.VITE_API_KEY || env.API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
