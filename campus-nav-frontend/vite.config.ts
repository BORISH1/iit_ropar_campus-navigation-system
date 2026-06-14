import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    // This forces Vite to always use the root React instance
    dedupe: ['react', 'react-dom', 'leaflet', 'react-leaflet'],
  }
})