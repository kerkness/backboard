import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The SPA is served by Mylar itself from data/ui at /ui, same origin as the API.
// In dev, Vite proxies /api through to the running instance on :8090.
export default defineConfig({
  plugins: [react()],
  base: '/ui/',
  // Config lives in the repo-root .env, not a second copy in ui/. Only VITE_* is
  // exposed: nothing licence-shaped should ever reach a distributable bundle.
  envDir: '..',
  build: {
    outDir: '../data/ui',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_MYLAR_API_URL ?? 'http://localhost:8090',
        changeOrigin: true,
      },
    },
  },
})
