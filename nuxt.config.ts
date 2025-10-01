// nuxt.config.ts
export default defineNuxtConfig({
  ssr: false,
  css: [
    '@/assets/main.css'
  ],
  app: {
    head: {
      title: 'Webcam Gesture',
      meta: [
        { name: 'description', content: 'webcam gesture nuxt3 mediapipe' }
      ],
      script: [
        { src: 'https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js', defer: true },
        { src: 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js', defer: true }
      ]
    }
  }
})