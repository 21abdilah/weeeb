export default defineNuxtConfig({
  app: {
    head: {
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
  }
})
