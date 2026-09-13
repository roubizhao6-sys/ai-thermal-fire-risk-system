import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const entry = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url))

export default defineConfig({
  base: './',
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  build: {
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        main: entry('index.html'),
        mobile: entry('mobile-app.html')
      }
    }
  }
})
