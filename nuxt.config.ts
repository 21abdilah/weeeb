// nuxt.config.ts
export default defineNuxtConfig({
  // Hanya di-render di client (wajib untuk fitur webcam dan mediapipe)
  ssr: false,
  css: [
    '@/assets/main.css'
  ],
  app: {
    head: {
      title: 'Webcam Gesture',
      meta: [
        { name: 'description', content: 'Demo interaktif gesture webcam dengan Nuxt3' }
      ]
    }
  }
})