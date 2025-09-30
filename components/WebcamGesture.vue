<template>
  <div class="gesture-wrapper">
    <!-- Kotak Kamera -->
    <div class="gesture-box">
      <h2 v-if="loading" class="loader">📷 Menyiapkan Kamera...</h2>
      <video v-else ref="video" autoplay playsinline></video>
    </div>

    <!-- Teks Info -->
    <div id="info" :class="{ show: showInfo }" v-html="infoText"></div>

    <!-- Pilih suara -->
    <div class="voice-selector" v-if="availableVoices.length">
      <label for="voice">🔊 Pilih Suara:</label>
      <select id="voice" v-model="selectedVoice">
        <option v-for="v in availableVoices" :key="v.name" :value="v">
          {{ v.name }}
        </option>
      </select>
      <button class="test-btn" @click="speak('Tes suara bahasa Indonesia')">
        ▶ Tes
      </button>
    </div>

    <!-- Tombol kontrol -->
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

const availableVoices = ref([])
const selectedVoice = ref(null)

const myInfo = `
  <strong>Hallo world! Saya Hilal Abdilah</strong><br>
  Mahasiswa baru Teknik Informatika<br>
`

let isSpeaking = false

// Load voices
function loadVoices() {
  availableVoices.value = speechSynthesis.getVoices()
  selectedVoice.value =
    availableVoices.value.find((v) =>
      v.name.toLowerCase().includes("indonesia")
    ) ||
    availableVoices.value.find((v) => v.lang.includes("id")) ||
    availableVoices.value[0] ||
    null
}

// Speech
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
  utter.onend = () => {
    isSpeaking = false
  }
  speechSynthesis.speak(utter)
}

// Confetti efek
function showConfetti() {
  for (let i = 0; i < 25; i++) {
    const conf = document.createElement("div")
    conf.classList.add("confetti")
    conf.style.left = Math.random() * window.innerWidth + "px"
    conf.style.backgroundColor = `hsl(${Math.random() * 360}, 70%, 60%)`
    document.body.appendChild(conf)
    setTimeout(() => document.body.removeChild(conf), 2000)
  }
}

// Kamera setup
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    hasCamera.value = false
    loading.value = false
    return
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true })
    video.value.srcObject = stream
    await new Promise((resolve) => {
      video.value.onloadedmetadata = () => resolve(video.value)
    })
    loading.value = false
  } catch (err) {
    console.warn("Kamera tidak tersedia:", err)
    hasCamera.value = false
    loading.value = false
  }
}

// TensorFlow Backend Fallback
async function setupBackend() {
  const backends = ["webgl", "webgpu", "wasm", "cpu"]
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

// Gesture detection
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
      const leftWrist = keypoints.find((p) => p.name === "left_wrist")
      const rightWrist = keypoints.find((p) => p.name === "right_wrist")
      const nose = keypoints.find((p) => p.name === "nose")

      // Gesture: angkat tangan
      if (
        (leftWrist?.y < nose?.y || rightWrist?.y < nose?.y) &&
        !showInfo.value
      ) {
        infoText.value = myInfo
        showInfo.value = true
        speak(
          "Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika."
        )
        showConfetti()
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
  showConfetti()
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
/* Wrapper utama */
.gesture-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
}

/* Kotak video */
.gesture-box {
  position: relative;
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 16px;
  padding: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

video {
  width: 100%;
  border-radius: 12px;
  background: #000;
}

/* Info text */
#info {
  margin-top: 0.5rem;
  background: rgba(0, 0, 0, 0.7);
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  font-size: 0.9rem;
  text-align: center;
  max-width: 400px;
  opacity: 0;
  transform: translateY(-10px);
  transition: all 0.3s ease;
}
#info.show {
  opacity: 1;
  transform: translateY(0);
}

/* Voice selector */
.voice-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: #f5f5f5;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  flex-wrap: wrap;
}

.voice-selector select {
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  border: 1px solid #ccc;
}

.test-btn {
  background: #007bff;
  color: white;
  padding: 0.3rem 0.8rem;
  border: none;
  border-radius: 6px;
  cursor: pointer;
}
.test-btn:hover {
  background: #0056b3;
}

/* Tombol kontrol */
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

/* Confetti */
.confetti {
  position: fixed;
  width: 8px;
  height: 8px;
  animation: fall 2s linear forwards;
}

@keyframes fall {
  to {
    transform: translateY(100vh) rotate(720deg);
    opacity: 0;
  }
}
</style>
