import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/erp': 'http://127.0.0.1:8000',
      '/portal': 'http://127.0.0.1:8000',
    }
  },
  build: {
    minify: false
  }
})
