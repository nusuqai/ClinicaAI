import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/clinica': {
        target: 'http://prepared-dyanna-nusuqai-demo-1a5b158b.koyeb.app',
        changeOrigin: true,
      },
    },
  },
})
