import { defineNuxtConfig } from 'nuxt'

export default defineNuxtConfig({
  ssr: false, // Semua kode webcam client-only
  build: {
    transpile: ['@mediapipe/holistic']
  },
  vite: {
    build: {
      rollupOptions: {
        external: []
      }
    }
  }
})
