<template>
  <div class="page-wrapper">
    <!-- Kamera -->
    <div class="camera-box">
      <h2 v-if="loading" class="loader">📷 Menyiapkan Kamera...</h2>
      <video v-else ref="video" autoplay playsinline muted></video>
    </div>

    <!-- Info teks -->
    <transition name="fade">
      <div class="info-text" v-if="showInfo" v-html="infoText"></div>
    </transition>

    <!-- Kontrol -->
    <div class="controls">
      <button v-if="hasCamera" @click="toggleDetection">
        {{ isDetecting ? "⏸ Pause" : "▶ Resume" }}
      </button>
      <template v-else>
        <button @click="simulateGesture('hand')">👋 Angkat Tangan</button>
        <button @click="simulateGesture('head')">🤓 Angguk Kepala</button>
        <button @click="simulateGesture('wave')">👏 Lambaikan Tangan</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import * as tf from "@tensorflow/tfjs"
import * as poseDetection from "@tensorflow-models/pose-detection"

const video = ref(null)
const loading = ref(true)
const hasCamera = ref(true)
const isDetecting = ref(true)

const showInfo = ref(false)
const infoText = ref("")
const myInfo = `
  <strong>Halo! Saya Hilal Abdilah</strong><br>
  Mahasiswa baru Teknik Informatika<br>
`

let detector = null
let isSpeaking = false

// Text-to-Speech
function speak(text) {
  if (isSpeaking) return
  const synth = window.speechSynthesis
  if (!synth) return

  let voices = synth.getVoices()
  let voice =
    voices.find(v => v.lang.includes("id")) ||
    voices.find(v => v.name.toLowerCase().includes("indonesia")) ||
    voices[0]

  const utter = new SpeechSynthesisUtterance(text)
  utter.voice = voice
  utter.lang = "id-ID"
  utter.rate = 0.95
  utter.pitch = 1.05
  utter.onend = () => (isSpeaking = false)

  isSpeaking = true
  synth.speak(utter)
}

// Kamera
async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }
    })
    video.value.srcObject = stream
    await new Promise(resolve => {
      video.value.onloadedmetadata = () => resolve()
    })
    hasCamera.value = true
  } catch (err) {
    console.warn("Kamera gagal:", err)
    hasCamera.value = false
  } finally {
    loading.value = false
  }
}

// Backend TensorFlow
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

// Deteksi Gesture
async function runDetection() {
  await setupBackend()
  detector = await poseDetection.createDetector(
    poseDetection.SupportedModels.MoveNet
  )

  async function detect() {
    if (!isDetecting.value) {
      requestAnimationFrame(detect)
      return
    }
    if (!video.value) {
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

    setTimeout(() => requestAnimationFrame(detect), 80)
  }

  detect()
}

// Simulasi gesture
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

function toggleDetection() {
  isDetecting.value = !isDetecting.value
}

onMounted(async () => {
  await setupCamera()
  if (hasCamera.value) runDetection()
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
  max-width: 420px;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
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
  transition: background 0.3s;
}
.controls button:hover {
  background: #218838;
}
</style>
