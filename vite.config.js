import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env': {}
  },
  optimizeDeps: {
    exclude: ['@imgly/background-removal']
  },
  build: {
    chunkSizeWarningLimit: 30000,
    rollupOptions: {
      external: [],
    }
  }
})