<template>
  <div class="gesture-root">
    <div class="top-row">
      <!-- Video + Canvas -->
      <div class="video-wrap">
        <video ref="video" class="video" autoplay playsinline muted></video>
        <canvas ref="canvas" class="canvas"></canvas>
      </div>

      <!-- Panel Control -->
      <div class="panel">
        <h3>⚙️ Kontrol Kamera & Overlay</h3>

        <!-- Kamera -->
        <div class="control-row">
          <label for="cameraSelect">🎥 Pilih Kamera</label>
          <select id="cameraSelect" v-model="selectedDeviceId" @change="switchCamera">
            <option v-for="cam in cameras" :key="cam.deviceId" :value="cam.deviceId">
              {{ cam.label || 'Kamera ' + cam.deviceId }}
            </option>
          </select>
        </div>

        <!-- Toggle Overlay -->
        <div class="control-row">
          <label><input type="checkbox" v-model="showPose" /> Pose</label>
          <label><input type="checkbox" v-model="showHands" /> Hands</label>
          <label><input type="checkbox" v-model="showFace" /> Face</label>
        </div>

        <hr />

        <!-- Status -->
        <div class="status">
          <div><strong>FPS:</strong> {{ fps }}</div>
          <div><strong>Pose:</strong> {{ debug.poseLandmarks ? '✅ Ada' : '❌ Tidak' }}</div>
          <div><strong>Tangan Kanan:</strong> {{ debug.rightHandLandmarks ? '✅ Ada' : '❌ Tidak' }}</div>
          <div><strong>Tangan Kiri:</strong> {{ debug.leftHandLandmarks ? '✅ Ada' : '❌ Tidak' }}</div>
          <div><strong>Wajah:</strong> {{ debug.faceLandmarks ? '✅ Ada' : '❌ Tidak' }}</div>
        </div>

        <hr />

        <!-- Debug Error -->
        <div class="debug">
          <h4>🛑 Debug & Error</h4>
          <small>onResults: {{ debug.onResultsCalled ? 'Ya' : 'Tidak' }}</small>

          <div v-if="errorLogs.length" class="error-box">
            <div v-for="(err, i) in errorLogs" :key="i" class="error-item">
              <strong>[{{ err.time }}]</strong> {{ err.message }}
            </div>
          </div>
          <div v-else class="no-error">✅ Tidak ada error</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from 'vue'

const video = ref(null)
const canvas = ref(null)
let ctx = null
let holistic = null
let camera = null

// Debug + status
const debug = ref({
  onResultsCalled: false,
  poseLandmarks: false,
  rightHandLandmarks: false,
  leftHandLandmarks: false,
  faceLandmarks: false
})

// Error logs
const errorLogs = ref([])

function logError(msg) {
  errorLogs.value.push({ time: new Date().toLocaleTimeString(), message: msg })
  if (errorLogs.value.length > 5) errorLogs.value.shift() // simpan max 5 error terakhir
  console.error("🔴 WebcamGesture Error:", msg)
}

// FPS counter
const fps = ref(0)
let lastTime = performance.now()
let frameCount = 0

// Kamera switching
const cameras = ref([])
const selectedDeviceId = ref(null)

const showPose = ref(true)
const showHands = ref(true)
const showFace = ref(true)

function adaptCanvas() {
  const w = video.value.videoWidth || 640
  const h = video.value.videoHeight || 480
  canvas.value.width = w
  canvas.value.height = h
  ctx = canvas.value.getContext('2d')
}

function onResults(results) {
  debug.value.onResultsCalled = true
  debug.value.poseLandmarks = !!results.poseLandmarks
  debug.value.rightHandLandmarks = !!results.rightHandLandmarks
  debug.value.leftHandLandmarks = !!results.leftHandLandmarks
  debug.value.faceLandmarks = !!results.faceLandmarks

  // FPS calc
  frameCount++
  const now = performance.now()
  if (now - lastTime >= 1000) {
    fps.value = frameCount
    frameCount = 0
    lastTime = now
  }

  ctx.clearRect(0, 0, canvas.value.width, canvas.value.height)
  ctx.drawImage(results.image, 0, 0, canvas.value.width, canvas.value.height)

  if (window.drawConnectors && window.drawLandmarks) {
    if (showPose.value && results.poseLandmarks) {
      window.drawConnectors(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: '#00FF00', lineWidth: 2 })
      window.drawLandmarks(ctx, results.poseLandmarks, { color: '#FF0000', lineWidth: 1 })
    }
    if (showHands.value && results.leftHandLandmarks) {
      window.drawConnectors(ctx, results.leftHandLandmarks, window.HAND_CONNECTIONS, { color: '#FF8800', lineWidth: 2 })
      window.drawLandmarks(ctx, results.leftHandLandmarks, { color: '#FFFF00', lineWidth: 1 })
    }
    if (showHands.value && results.rightHandLandmarks) {
      window.drawConnectors(ctx, results.rightHandLandmarks, window.HAND_CONNECTIONS, { color: '#00FFFF', lineWidth: 2 })
      window.drawLandmarks(ctx, results.rightHandLandmarks, { color: '#FF00FF', lineWidth: 1 })
    }
    if (showFace.value && results.faceLandmarks) {
      window.drawLandmarks(ctx, results.faceLandmarks, { color: '#8888FF', lineWidth: 0.5 })
    }
  }
}

// 🔹 Kamera init
async function initCamera() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    cameras.value = devices.filter(d => d.kind === 'videoinput')
    if (!selectedDeviceId.value && cameras.value.length) {
      selectedDeviceId.value = cameras.value[0].deviceId
    }
    await switchCamera()
  } catch (e) {
    logError("Gagal akses kamera: " + e.message)
  }
}

async function switchCamera() {
  if (!selectedDeviceId.value) return
  if (camera && camera.stop) camera.stop()

  try {
    const constraints = {
      video: { deviceId: { exact: selectedDeviceId.value }, width: 640, height: 480 }
    }
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    video.value.srcObject = stream

    camera = new window.Camera(video.value, {
      onFrame: async () => {
        try {
          await holistic.send({ image: video.value })
        } catch (e) {
          logError("Holistic send() error: " + e.message)
        }
      },
      width: 640,
      height: 480
    })
    camera.start()
  } catch (e) {
    logError("Kamera gagal start: " + e.message)
  }
}

onMounted(async () => {
  await new Promise(resolve => {
    const check = () => {
      if (window.Holistic && window.Camera) return resolve(true)
      setTimeout(check, 100)
    }
    check()
  })

  adaptCanvas()
  window.addEventListener('resize', adaptCanvas)

  try {
    holistic = new window.Holistic.Holistic({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
    })
    holistic.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      minDetectionConfidence: 0.5,
      minTrackingConfidence: 0.5
    })
    holistic.onResults(onResults)
  } catch (e) {
    logError("Holistic init error: " + e.message)
  }

  await initCamera()
})

onBeforeUnmount(() => {
  if (holistic && holistic.close) holistic.close()
  if (camera && camera.stop) camera.stop()
  window.removeEventListener('resize', adaptCanvas)
})
</script>

<style scoped>
.gesture-root {
  padding: 16px;
  max-width: 1100px;
  margin: 0 auto;
  font-family: Inter, Arial, sans-serif;
}
.top-row {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
}
.video-wrap {
  position: relative;
  width: 640px;
  max-width: 100%;
}
.video {
  display: block;
  width: 100%;
  border-radius: 12px;
  background: #000;
}
.canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  border-radius: 12px;
  pointer-events: none;
}
.panel {
  min-width: 280px;
  padding: 12px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.08);
}
.control-row {
  margin: 6px 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.status {
  margin-top: 8px;
  font-size: 14px;
}
.debug {
  margin-top: 10px;
  font-size: 13px;
}
.error-box {
  margin-top: 6px;
  background: #ffecec;
  border: 1px solid #ffaaaa;
  padding: 6px;
  border-radius: 6px;
  max-height: 120px;
  overflow-y: auto;
}
.error-item {
  color: #d8000c;
  font-size: 13px;
  margin-bottom: 4px;
}
.no-error {
  color: #228b22;
  font-size: 13px;
}
</style>
