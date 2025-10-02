// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      title: "Realtime Pose Detection",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        {
          name: "description",
          content: "Aplikasi web untuk deteksi tubuh, wajah, dan tangan real-time menggunakan MediaPipe Holistic."
        },
      ],
      link: [
        { rel: "icon", type: "image/png", href: "/favicon.png" }
      ],
      script: [
        {
          src: "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js",
          defer: true,
        },
        {
          src: "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
          defer: true,
        },
        {
          src: "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
          defer: true,
        }
      ]
    }
  },

  css: [
    "@/assets/css/global.css"
  ],

  build: {
    transpile: []
  },

  nitro: {
    preset: "vercel" // ✅ Optimasi untuk deploy ke Vercel
  }
})
