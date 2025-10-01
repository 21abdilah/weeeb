// nuxt.config.ts
export default defineNuxtConfig({
  // Hanya di-render di client (wajib untuk fitur webcam dan mediapipe)
  ssr: false,
  css: [
    '@/assets/global.css'
  ],
  app: {
    head: {
      title: 'Webcam Gesture',
      meta: [
        { name: 'description', content: 'webcam dengan Nuxt3' }
      ]
    }
  }
})