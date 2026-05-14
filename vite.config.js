import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      // Proxy NVIDIA AI calls
      '/api/nvidia': {
        target: 'https://integrate.api.nvidia.com/v1',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/nvidia/, ''),
      },
      // Proxy all backend API calls → Express server on :4000
      // This fixes fetch('/api/feedback'), fetch('/api/clusters'), etc.
      '/api/feedback': { target: 'http://localhost:4000', changeOrigin: true },
      '/api/clusters': { target: 'http://localhost:4000', changeOrigin: true },
      '/api/stats':    { target: 'http://localhost:4000', changeOrigin: true },
      // Proxy Gmail OAuth + status calls → Express server on :4000
      '/auth':         { target: 'http://localhost:4000', changeOrigin: true },
      '/webhook':      { target: 'http://localhost:4000', changeOrigin: true },
    },
  },
})

