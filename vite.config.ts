import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { VitePWA } from 'vite-plugin-pwa';

const isProd = process.env.NODE_ENV === 'production';

// https://vite.dev/config/
export default defineConfig(async () => {
  // basicSsl only in dev — not needed or available in Vercel CI build
  const extraPlugins = isProd
    ? []
    : [(await import('@vitejs/plugin-basic-ssl')).default()];

  return {
    plugins: [
      react(),
      ...extraPlugins,
      VitePWA({
        registerType: 'prompt',
        injectRegister: false,
        selfDestroying: false,
        devOptions: {
          enabled: false,
        },
        includeAssets: ['favicon.ico', 'robots.txt', 'apple-touch-icon.png'],
        manifest: {
          name: 'SM Payroll System',
          short_name: 'SM Payroll',
          description: 'Complete Payroll & Attendance Management System',
          theme_color: '#6366f1',
          background_color: '#0f172a',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
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
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 60 * 60 * 24 * 365
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            }
          ]
        }
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'framer-motion', 'lucide-react', 'recharts', 'zustand'],
            pdf: ['jspdf', 'jspdf-autotable'],
            utils: ['xlsx', 'clsx', 'tailwind-merge'],
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      host: true,
      port: 5173,
      https: !isProd,
      proxy: {
        '/api': {
          target: 'http://localhost:3000',
          changeOrigin: true,
          secure: false,
        }
      }
    },
  };
});

