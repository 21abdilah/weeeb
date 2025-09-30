<template>
  <div class="page-wrapper">
    <!-- Kotak Kamera -->
    <div class="camera-box">
      <h2 v-if="loading" class="loader">📷 Menyiapkan Kamera...</h2>
      <video v-else ref="video" autoplay playsinline muted></video>
      <p v-if="cameraError" class="error-text">{{ cameraError }}</p>
    </div>

    <!-- Info teks -->
    <div class="info-text" v-if="showInfo" v-html="infoText"></div>

    <!-- Pengaturan suara -->
    <div class="voice-box" v-if="availableVoices.length">
      <label for="voice">🔊 Pilih Suara:</label>
      <select id="voice" v-model="selectedVoice">
        <option v-for="v in availableVoices" :key="v.name" :value="v">
          {{ v.name }}
        </option>
      </select>
      <button @click="speak('Tes suara bahasa Indonesia')">▶ Tes</button>
    </div>

    <!-- Tombol Kontrol -->
    <div class="controls">
      <template v-if="!hasCamera">
        <button @click="simulateGesture('hand')">👋 Angkat Tangan</button>
        <button @click="simulateGesture('head')">🤓 Kepala Mengangguk</button>
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

const video = ref(null)
const showInfo = ref(false)
const infoText = ref("")
const loading = ref(true)
const hasCamera = ref(true)
const isDetecting = ref(true)
const cameraError = ref("")

const availableVoices = ref([])
const selectedVoice = ref(null)

const myInfo = `
  <strong>Halo! Saya Hilal Abdilah</strong><br>
  Mahasiswa baru Teknik Informatika<br>
`

let isSpeaking = false

// Load voices
function loadVoices() {
  availableVoices.value = speechSynthesis.getVoices()
  console.log("Voices tersedia:", availableVoices.value.map(v => v.name))
  selectedVoice.value =
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
  utter.voice = selectedVoice.value
  utter.rate = 0.95
  utter.pitch = 1.05
  utter.volume = 1
  isSpeaking = true
  utter.onend = () => (isSpeaking = false)
  speechSynthesis.speak(utter)
}

async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    hasCamera.value = false
    loading.value = false
    cameraError.value = "❌ Kamera tidak tersedia di perangkat ini."
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }, // kamera depan
      audio: false
    })
    video.value.srcObject = stream
    await video.value.play() // paksa play
    loading.value = false
    cameraError.value = ""
  } catch (err) {
    console.warn("Kamera tidak tersedia:", err)
    hasCamera.value = false
    loading.value = false
    cameraError.value = "⚠️ Tidak bisa mengakses kamera. Pastikan izin sudah diberikan."
  }
}

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

async function runGestureDetection() {
  await setupCamera()
  if (!hasCamera.value) return
  await setupBackend()
  const detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet
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
        speak(
          "Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika."
        )
      }
    }
    setTimeout(() => requestAnimationFrame(detect), 66)
  }
  detect()
}

function simulateGesture(type) {
  switch (type) {
    case "hand":
      infoText.value = myInfo
      showInfo.value = true
      speak(
        "Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika."
      )
      break
    case "head":
      speak("Terima kasih, sampai jumpa!")
      break
    case "wave":
      speak("Himatika! Kita pasti bisa!")
      break
  }
}

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
  max-width: 600px;
  margin: 0 auto;
}

/* Kotak kamera */
.camera-box {
  position: relative;
  width: 100%;
  background: #fff;
  border-radius: 16px;
  padding: 0.5rem;
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.12);
}

video {
  width: 100%;
  border-radius: 12px;
  background: #000;
  object-fit: cover;
  max-height: 60vh;
}

.error-text {
  color: #d9534f;
  font-size: 0.9rem;
  margin-top: 0.5rem;
  text-align: center;
}

/* Info teks */
.info-text {
  background: rgba(0, 0, 0, 0.75);
  color: #fff;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  font-size: 1rem;
  text-align: center;
  max-width: 100%;
  line-height: 1.4;
  animation: fadeIn 0.4s ease-in-out;
}

/* Voice */
.voice-box {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #f9f9f9;
  padding: 0.6rem 1rem;
  border-radius: 12px;
  flex-wrap: wrap;
  font-size: 0.95rem;
}
.voice-box label {
  font-weight: 500;
}
.voice-box select,
.voice-box button {
  padding: 0.4rem 0.8rem;
  border-radius: 8px;
  border: 1px solid #ccc;
  background: #fff;
  font-size: 0.9rem;
}
.voice-box button {
  border: none;
  background: #007bff;
  color: white;
  cursor: pointer;
  transition: background 0.25s;
}
.voice-box button:hover {
  background: #0056b3;
}

/* Kontrol */
.controls {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
  justify-content: center;
}
.controls button {
  padding: 0.6rem 1.2rem;
  border-radius: 12px;
  border: none;
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  font-size: 0.95rem;
  font-weight: 500;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s, background 0.25s;
}
.controls button:hover {
  background: linear-gradient(135deg, #218838, #198754);
  transform: translateY(-2px);
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
}
.controls button:active {
  transform: scale(0.96);
}

/* Animasi */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsif */
@media (max-width: 480px) {
  .voice-box {
    flex-direction: column;
    align-items: stretch;
  }
  .controls button {
    flex: 1;
    min-width: 100px;
  }
}
</style>
