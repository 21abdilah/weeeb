// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false, // hanya client-side (butuh untuk camera & Mediapipe)
  css: [
    '@/assets/main.css'
  ],
  build: {
    transpile: []
  },
  vite: {
    optimizeDeps: {
      exclude: ['@mediapipe/holistic']
    }
  }
})
