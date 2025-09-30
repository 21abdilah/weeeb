<template>
  <div class="page-wrapper">
    <!-- Kamera -->
    <div class="camera-box">
      <h2 v-if="loading" class="loader">📷 Menyiapkan Kamera...</h2>
      <video v-else ref="video" autoplay playsinline muted></video>
    </div>

    <!-- Info teks -->
    <div class="info-text" v-if="showInfo" v-html="infoText"></div>

    <!-- Pilih suara -->
    <div class="voice-box" v-if="availableVoices.length">
      <label for="voice">🔊 Pilih Suara:</label>
      <select id="voice" v-model="selectedVoice">
        <option
          v-for="v in availableVoices"
          :key="v.name"
          :value="v"
        >
          {{ v.name }}
        </option>
      </select>
      <button @click="speak('Tes suara bahasa Indonesia')">▶ Tes</button>
    </div>

    <!-- Kontrol -->
    <div class="controls">
      <template v-if="!hasCamera">
        <button @click="simulateGesture('hand')">👋 Angkat Tangan</button>
        <button @click="simulateGesture('head')">🤓 Angguk Kepala</button>
        <button @click="simulateGesture('wave')">👏 Lambaikan Tangan</button>
      </template>
      <template v-else>
        <button @click="toggleDetection">
          {{ isDetecting ? "⏸ Pause" : "▶ Resume" }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import * as tf from "@tensorflow/tfjs"
import * as poseDetection from "@tensorflow-models/pose-detection"

// refs
const video = ref(null)
const showInfo = ref(false)
const infoText = ref("")
const loading = ref(true)
const hasCamera = ref(true)
const isDetecting = ref(true)

const availableVoices = ref([])
const selectedVoice = ref(null)

const myInfo = `
  <strong>Halo! Saya Hilal Abdilah</strong><br>
  Mahasiswa baru Teknik Informatika<br>
`

let isSpeaking = false

// === Voice ===
function loadVoices() {
  availableVoices.value = speechSynthesis.getVoices()
  selectedVoice.value =
    availableVoices.value.find(v => v.name.toLowerCase().includes("indonesia")) ||
    availableVoices.value.find(v => v.lang.includes("id")) ||
    availableVoices.value[0] ||
    null
}

function speak(text) {
  if (isSpeaking) return
  if (availableVoices.value.length === 0) {
    speechSynthesis.onvoiceschanged = () => {
      loadVoices()
      speak(text)
    }
    return
  }
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = "id-ID"
  if (selectedVoice.value) utter.voice = selectedVoice.value
  utter.rate = 0.95
  utter.pitch = 1.05
  utter.volume = 1
  isSpeaking = true
  utter.onend = () => (isSpeaking = false)
  speechSynthesis.speak(utter)
}

// === Kamera ===
async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
    })
    video.value.srcObject = stream
    await new Promise(resolve => {
      video.value.onloadedmetadata = () => resolve()
    })
    loading.value = false
  } catch (err) {
    console.warn("Kamera gagal diakses:", err)
    hasCamera.value = false
    loading.value = false
  }
}

// === Backend TensorFlow ===
async function setupBackend() {
  const backends = ["webgl", "wasm", "cpu"]
  for (const b of backends) {
    try {
      await tf.setBackend(b)
      await tf.ready()
      console.log("Backend aktif:", b)
      return
    } catch (e) {
      console.warn(`Backend ${b} gagal, coba berikutnya...`)
    }
  }
}

// === Deteksi Gesture ===
async function runGestureDetection() {
  await setupCamera()
  if (!hasCamera.value) return
  await setupBackend()

  const detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet,
    { modelType: "SinglePose.Lightning" }
  )

  async function detect() {
    if (!isDetecting.value) {
      requestAnimationFrame(detect)
      return
    }
    const poses = await detector.estimatePoses(video.value)
    if (poses.length > 0) {
      const keypoints = poses[0].keypoints
      const leftWrist = keypoints.find(p => p.name === "left_wrist")
      const rightWrist = keypoints.find(p => p.name === "right_wrist")
      const nose = keypoints.find(p => p.name === "nose")

      if ((leftWrist?.y < nose?.y || rightWrist?.y < nose?.y) && !showInfo.value) {
        infoText.value = myInfo
        showInfo.value = true
        speak("Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika.")
      }
    }
    requestAnimationFrame(detect)
  }
  detect()
}

// === Simulasi (tanpa kamera) ===
function simulateGesture(type) {
  switch (type) {
    case "hand":
      infoText.value = myInfo
      showInfo.value = true
      speak("Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika.")
      break
    case "head":
      speak("Terima kasih, sampai jumpa!")
      break
    case "wave":
      speak("Himatika! Kita pasti bisa!")
      break
  }
}

// === Kontrol ===
function toggleDetection() {
  isDetecting.value = !isDetecting.value
}

onMounted(() => {
  loadVoices()
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices
  }
  runGestureDetection()
})
</script>

<style scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

/* Kotak kamera */
.camera-box {
  position: relative;
  width: 100%;
  max-width: 480px;
  background: #fff;
  border-radius: 16px;
  padding: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

video {
  width: 100%;
  border-radius: 12px;
  background: #000;
  object-fit: cover;
}

/* Info teks */
.info-text {
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  font-size: 0.95rem;
  text-align: center;
  max-width: 480px;
}

/* Voice */
.voice-box {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f5f5f5;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  flex-wrap: wrap;
}

/* Kontrol */
.controls {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  justify-content: center;
}
.controls button {
  padding: 0.5rem 1rem;
  border-radius: 10px;
  border: none;
  background: #28a745;
  color: white;
  cursor: pointer;
}
.controls button:hover {
  background: #218838;
}
</style>
