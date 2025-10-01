<template>
  <div class="gesture-app">
    <div class="video-container">
      <video ref="video" autoplay playsinline muted></video>
      <canvas ref="canvas"></canvas>
      <div class="overlay-text">{{ overlayText }}</div>
    </div>

    <div class="panel">
      <h3>🎛 Panel Kontrol</h3>

      <label>Kamera:
        <select v-model="selectedDeviceId" @change="switchCamera">
          <option v-for="cam in cameras" :key="cam.deviceId" :value="cam.deviceId">{{ cam.label }}</option>
        </select>
      </label>

      <label>Bahasa:
        <select v-model="language">
          <option value="id-ID">Indonesia</option>
          <option value="en-US">English</option>
        </select>
      </label>

      <label>Voice:
        <select v-model="selectedVoice">
          <option v-for="voice in voices" :key="voice.name" :value="voice.name">
            {{ voice.name }} ({{ voice.lang }})
          </option>
        </select>
      </label>

      <button @click="testVoice">🔊 Test Suara</button>
      <button @click="simulateGesture('Thumbs Up')">Simulasi 👍</button>
      <button @click="simulateGesture('Pointing')">Simulasi 👉</button>
    </div>

    <div class="status-panel">
      <h3>📊 Status</h3>
      <ul>
        <li>Gesture: {{ currentGesture }}</li>
        <li>Kamera: {{ currentCameraLabel }}</li>
        <li>Bahasa: {{ language }}</li>
        <li>Voice: {{ selectedVoice }}</li>
        <li>FPS: {{ fps }}</li>
        <li v-if="debug.lastError">❌ Error: {{ debug.lastError }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, onBeforeUnmount } from 'vue'

const video = ref(null)
const canvas = ref(null)
const overlayText = ref('')
const cameras = ref([])
const selectedDeviceId = ref('')
const currentCameraLabel = ref('')
const language = ref('id-ID')
const voices = ref([])
const selectedVoice = ref('')
const currentGesture = ref('None')
const fps = ref(0)
const debug = reactive({ lastError: null })

let holisticInst = null
let localStream = null
let rafId = null

// 🔹 Enumerasi camera
async function enumerateVideoDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    cameras.value = devices.filter(d => d.kind === 'videoinput')
    if (cameras.value.length) {
      selectedDeviceId.value = cameras.value[0].deviceId
      currentCameraLabel.value = cameras.value[0].label || 'Default Camera'
    }
  } catch (e) {
    debug.lastError = e.message
  }
}

// 🔹 Start camera
async function startCamera(deviceId) {
  stopCamera()
  try {
    const constraints = deviceId
      ? { video: { deviceId: { exact: deviceId }, width: 640, height: 480 } }
      : { video: { facingMode: 'user', width: 640, height: 480 } }
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    video.value.srcObject = localStream
    await video.value.play()
    adaptCanvas()
    return true
  } catch (e) {
    debug.lastError = e.message
    return false
  }
}

function stopCamera() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop())
    localStream = null
  }
}

async function switchCamera() {
  if (selectedDeviceId.value) {
    await startCamera(selectedDeviceId.value)
    const cam = cameras.value.find(c => c.deviceId === selectedDeviceId.value)
    if (cam) currentCameraLabel.value = cam.label || 'Camera'
  }
}

// 🔹 Adaptasi canvas
function adaptCanvas() {
  if (!video.value || !canvas.value) return
  canvas.value.width = video.value.videoWidth
  canvas.value.height = video.value.videoHeight
}

// 🔹 Output suara
function speak(text) {
  if (!window.speechSynthesis) return
  const msg = new SpeechSynthesisUtterance(text)
  msg.lang = language.value
  const v = voices.value.find(v => v.name === selectedVoice.value)
  if (v) msg.voice = v
  window.speechSynthesis.speak(msg)
}
function testVoice() {
  speak(language.value === 'id-ID' ? 'Halo, ini suara pengujian' : 'Hello, this is a test voice')
}

// 🔹 Simulasi gesture
function simulateGesture(g) {
  currentGesture.value = g
  overlayText.value = g
  speak(g)
}

// 🔹 Load voices
function loadVoices() {
  voices.value = window.speechSynthesis.getVoices()
  if (voices.value.length) selectedVoice.value = voices.value[0].name
}
window.speechSynthesis.onvoiceschanged = loadVoices

// 🔹 Holistic Results
function onResults(results) {
  const ctx = canvas.value.getContext('2d')
  ctx.save()
  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  ctx.drawImage(results.image, 0, 0, canvas.value.width, canvas.value.height)

  if (results.poseLandmarks) {
    window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 })
    window.drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 1 })
  }
  if (results.leftHandLandmarks) {
    window.drawConnectors(ctx, results.leftHandLandmarks, window.HAND_CONNECTIONS, { color: '#00FFFF', lineWidth: 2 })
    window.drawLandmarks(ctx, results.leftHandLandmarks, { color: '#FF0000', lineWidth: 1 })
  }
  if (results.rightHandLandmarks) {
    window.drawConnectors(ctx, results.rightHandLandmarks, window.HAND_CONNECTIONS, { color: '#00FFFF', lineWidth: 2 })
    window.drawLandmarks(ctx, results.rightHandLandmarks, { color: '#FF0000', lineWidth: 1 })
  }
  ctx.restore()

  // 🔹 Simple gesture detect
  if (results.rightHandLandmarks?.length) {
    const thumb = results.rightHandLandmarks[4]
    const index = results.rightHandLandmarks[8]
    if (thumb.y < results.rightHandLandmarks[3].y) {
      simulateGesture('Thumbs Up')
    } else if (index.y < results.rightHandLandmarks[6].y) {
      simulateGesture('Pointing')
    } else {
      currentGesture.value = 'None'
    }
  }
}

// 🔹 Loop video
async function processFrame() {
  if (video.value && video.value.readyState >= 2) {
    try {
      await holisticInst.send({ image: video.value })
    } catch (e) {
      debug.lastError = e.message
    }
  }
  rafId = requestAnimationFrame(processFrame)
}

// 🔹 Wait for CDN
function waitForGlobals() {
  return new Promise((resolve) => {
    const check = () => {
      if (window.Holistic && window.drawConnectors && window.Camera) resolve()
      else setTimeout(check, 200)
    }
    check()
  })
}

// 🔹 Lifecycle
onMounted(async () => {
  await enumerateVideoDevices()
  await startCamera(selectedDeviceId.value)
  await waitForGlobals()
  adaptCanvas()
  window.addEventListener('resize', adaptCanvas)

  holisticInst = new window.Holistic.Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
  })
  holisticInst.setOptions({
    modelComplexity: 0,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  })
  holisticInst.onResults(onResults)

  loadVoices()
  processFrame()
})

onBeforeUnmount(() => {
  stopCamera()
  if (rafId) cancelAnimationFrame(rafId)
  window.removeEventListener('resize', adaptCanvas)
})
</script>

<style scoped>
.gesture-app {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
}
.video-container {
  position: relative;
}
video, canvas {
  width: 480px;
  height: 360px;
  border: 1px solid #ccc;
  background: black;
}
.overlay-text {
  position: absolute;
  top: 10px;
  left: 10px;
  color: yellow;
  font-size: 20px;
  font-weight: bold;
  text-shadow: 1px 1px 2px black;
}
.panel, .status-panel {
  border: 1px solid #ccc;
  padding: 1rem;
  min-width: 220px;
}
</style>
