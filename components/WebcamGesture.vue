<template>
  <div class="gesture-container">
    <h2>🤖 Pose & Gesture Detection</h2>

    <!-- Video + Canvas -->
    <div class="video-wrapper">
      <video ref="videoRef" autoplay playsinline muted></video>
      <canvas ref="canvasRef"></canvas>
    </div>

    <!-- Panel Debug & Control -->
    <div class="control-panel">
      <p v-if="error" class="error">⚠️ {{ error }}</p>
      <p v-else>✅ Running...</p>

      <p>Last Gesture: <strong>{{ lastGesture }}</strong></p>

      <!-- Custom Mapping Input -->
      <div class="gesture-mapping">
        <h3>🎛️ Atur Gesture & Audio</h3>
        <div v-for="(text, gesture) in gestureMap" :key="gesture" class="mapping-row">
          <label>{{ gesture }}</label>
          <input v-model="gestureMap[gesture]" placeholder="Teks audio..." />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'

const videoRef = ref(null)
const canvasRef = ref(null)
const error = ref(null)
const lastGesture = ref("None")

// Mapping default gesture → audio custom
const gestureMap = reactive({
  "Right Hand Up": "Halo, tangan kanan diangkat",
  "Left Hand Up": "Hai, tangan kiri diangkat",
  "Both Hands Up": "Kedua tangan terangkat!"
})

let holistic = null
let camera = null

onMounted(async () => {
  try {
    if (!window.Holistic || !window.Camera) {
      error.value = "❌ MediaPipe tidak ter-load. Tambahkan CDN script di nuxt.config.ts"
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
      width: 480,
      height: 360,
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

  // === Pose Landmarks (tubuh) ===
  if (results.poseLandmarks) {
    window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS,
      { color: "#00FF00", lineWidth: 2 })
    window.drawLandmarks(ctx, results.poseLandmarks, { color: "#FF0000", lineWidth: 2 })
  }

  // === Face Landmarks ===
  if (results.faceLandmarks) {
    window.drawConnectors(ctx, results.faceLandmarks, window.FACEMESH_TESSELATION,
      { color: "#C0C0C0", lineWidth: 0.5 })
  }

  // === Left Hand Landmarks ===
  if (results.leftHandLandmarks) {
    window.drawConnectors(ctx, results.leftHandLandmarks, window.HAND_CONNECTIONS,
      { color: "#FFAA00", lineWidth: 2 })
    window.drawLandmarks(ctx, results.leftHandLandmarks, { color: "#FF0000", lineWidth: 2 })
  }

  // === Right Hand Landmarks ===
  if (results.rightHandLandmarks) {
    window.drawConnectors(ctx, results.rightHandLandmarks, window.HAND_CONNECTIONS,
      { color: "#00AAFF", lineWidth: 2 })
    window.drawLandmarks(ctx, results.rightHandLandmarks, { color: "#0000FF", lineWidth: 2 })
  }

  ctx.restore()

  // === Deteksi Gesture sederhana ===
  detectGesture(results)
}

function detectGesture(results) {
  if (!results.poseLandmarks) return

  const rightWrist = results.poseLandmarks[16]
  const rightShoulder = results.poseLandmarks[12]
  const leftWrist = results.poseLandmarks[15]
  const leftShoulder = results.poseLandmarks[11]

  let gesture = null

  if (rightWrist && rightShoulder && rightWrist.y < rightShoulder.y) {
    gesture = "Right Hand Up"
  } else if (leftWrist && leftShoulder && leftWrist.y < leftShoulder.y) {
    gesture = "Left Hand Up"
  } else if (
    rightWrist && rightShoulder && leftWrist && leftShoulder &&
    rightWrist.y < rightShoulder.y && leftWrist.y < leftShoulder.y
  ) {
    gesture = "Both Hands Up"
  }

  if (gesture && lastGesture.value !== gesture) {
    lastGesture.value = gesture
    playAudio(gestureMap[gesture])
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
  padding: 12px;
}
.video-wrapper {
  position: relative;
  width: 100%;
  max-width: 480px;
  aspect-ratio: 4/3;
}
video, canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.control-panel {
  margin-top: 12px;
  padding: 12px;
  background: #f9f9f9;
  border-radius: 8px;
  width: 100%;
  max-width: 480px;
}
.error {
  color: red;
  font-weight: bold;
}
.gesture-mapping {
  margin-top: 10px;
}
.mapping-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}
.mapping-row label {
  flex: 1;
  font-size: 14px;
}
.mapping-row input {
  flex: 2;
  padding: 4px 6px;
  border: 1px solid #ccc;
  border-radius: 6px;
}
</style>
