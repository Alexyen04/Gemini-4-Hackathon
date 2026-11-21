import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', 'VITE_')
  const backend = env.VITE_DEV_API_PROXY || 'http://127.0.0.1:8000'
  const mangaBackend = env.VITE_DEV_MANGA_PROXY || 'http://127.0.0.1:3000'

  return {
    plugins: [react()],
    build: {
      assetsDir: 'app-assets',
      rollupOptions: { input: { home: 'index.html', studio: 'studio/index.html' } },
    },
    server: {
      proxy: {
        '^/api/(status|clips|manga|media)(?:/|\\?|$)': { target: mangaBackend, changeOrigin: true },
        '/api': { target: backend, changeOrigin: true },
        '/assets': { target: backend, changeOrigin: true },
      },
    },
  }
})
