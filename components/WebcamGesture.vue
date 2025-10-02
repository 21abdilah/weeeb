<template>
  <div class="geture-container">
    <h2>👋 Gesture Detection</h2>
    <div class="video-wrapper">
      <video ref="videoRef" autoplay playsinline muted></video>
      <canvas ref="canvasRef"></canvas>
    </div>

    <!-- Panel Debug & Control -->
    <div class="control-panel">
      <p v-if="error" class="error">⚠️ {{ error }}</p>
      <p v-else>✅ Running...</p>

      <p>Last Gesture: <strong>{{ lastGesture }}</strong></p>

      <div class="audio-input">
        <input v-model="customText" type="text" placeholder="Teks audio custom..." />
        <button @click="playAudio(customText)">🔊 Play</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const videoRef = ref(null)
const canvasRef = ref(null)
const error = ref(null)
const lastGesture = ref("None")
const customText = ref("Halo, ini contoh audio")

let holistic = null
let camera = null

onMounted(async () => {
  try {
    if (!window.Holistic || !window.Camera) {
      error.value = "❌ MediaPipe tidak ter-load. Pastikan nuxt.config.ts sudah ada CDN script."
      return
    }

    holistic = new window.Holistic.Holistic({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
    })

    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })

    holistic.onResults(onResults)

    camera = new window.Camera(videoRef.value, {
      onFrame: async () => {
        await holistic.send({ image: videoRef.value })
      },
      width: 640,
      height: 480,
    })

    camera.start()
  } catch (e) {
    console.error("Init error:", e)
    error.value = "❌ " + e.message
  }
})

onBeforeUnmount(() => {
  if (camera) camera.stop()
})

function onResults(results) {
  const canvas = canvasRef.value
  const ctx = canvas.getContext("2d")

  canvas.width = videoRef.value.videoWidth
  canvas.height = videoRef.value.videoHeight

  ctx.save()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)

  if (results.poseLandmarks) {
    window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS,
      { color: "#00FF00", lineWidth: 3 })
    window.drawLandmarks(ctx, results.poseLandmarks, { color: "#FF0000", lineWidth: 2 })
  }

  ctx.restore()

  // Contoh gesture: tangan kanan diangkat
  if (results.poseLandmarks) {
    const rightWrist = results.poseLandmarks[16]
    const rightShoulder = results.poseLandmarks[12]

    if (rightWrist && rightShoulder && rightWrist.y < rightShoulder.y) {
      if (lastGesture.value !== "Right Hand Up") {
        lastGesture.value = "Right Hand Up"
        playAudio("Tangan kanan diangkat")
      }
    }
  }
}

function playAudio(text) {
  try {
    if (!text || text.trim() === "") return
    const synth = window.speechSynthesis
    const utter = new SpeechSynthesisUtterance(text)
    synth.speak(utter)
  } catch (e) {
    console.error("Audio error:", e)
  }
}
</script>

<style scoped>
.gesture-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px;
}
.video-wrapper {
  position: relative;
  width: 640px;
  height: 480px;
}
video, canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 640px;
  height: 480px;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.control-panel {
  margin-top: 12px;
  padding: 12px;
  background: #f4f4f4;
  border-radius: 8px;
  width: 320px;
  text-align: center;
}
.error {
  color: red;
  font-weight: bold;
}
.audio-input {
  margin-top: 10px;
  display: flex;
  gap: 6px;
}
.audio-input input {
  flex: 1;
  padding: 6px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
.audio-input button {
  padding: 6px 10px;
  background: #0070f3;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.audio-input button:hover {
  background: #0055aa;
}
</style>
