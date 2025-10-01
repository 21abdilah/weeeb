// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false, // hanya client-side (karena pakai kamera & speech)
  nitro: {
    preset: 'vercel'
  },
  app: {
    head: {
      title: "Gesture Detection Demo",
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0' }
      ],
      script: [
        { src: "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js" },
        { src: "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js" },
        { src: "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js" }
      ]
    }
  }
})
