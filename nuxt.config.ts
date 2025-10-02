// nuxt.config.ts
export default defineNuxtConfig({
  app: {
    head: {
      title: "Pose Detection Demo",
      meta: [
        { charset: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { name: "description", content: "Realtime Pose & Gesture Detection with MediaPipe" }
      ],
      script: [
        // MediaPipe Holistic
        {
          src: "https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js",
          defer: true
        },
        // MediaPipe Camera Utils
        {
          src: "https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js",
          defer: true
        },
        // MediaPipe Drawing Utils
        {
          src: "https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js",
          defer: true
        }
      ]
    }
  },
  nitro: {
    preset: "vercel"
  }
})
