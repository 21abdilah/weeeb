<template>
  <div class="page-wrapper">
    <!-- Kamera -->
    <div class="camera-box">
      <h2 v-if="loading" class="loader">📷 Menyiapkan Kamera...</h2>
      <video v-else ref="video" autoplay playsinline></video>
    </div>

    <!-- Info Perkenalan -->
    <transition name="fade">
      <div class="info-text" v-if="showInfo" v-html="infoText"></div>
    </transition>

    <!-- Kontrol -->
    <div class="controls">
      <button
        v-if="hasCamera"
        class="btn"
        @click="toggleDetection"
      >
        {{ isDetecting ? "⏸ Pause" : "▶ Resume" }}
      </button>
      <button
        v-else
        class="btn"
        @click="simulateGesture"
      >
        👋 Simulasi Angkat Tangan
      </button>
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

// --- Text to Speech ---
function speak(text) {
  if (isSpeaking) return
  const synth = window.speechSynthesis
  if (!synth) return

  const voices = synth.getVoices()
  const voice =
    voices.find(v => v.lang.includes("id")) ||
    voices.find(v => v.name.toLowerCase().includes("indonesia")) ||
    voices[0]

  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = "id-ID"
  utter.voice = voice
  utter.rate = 0.95
  utter.pitch = 1.05
  utter.volume = 1

  isSpeaking = true
  utter.onend = () => (isSpeaking = false)
  synth.speak(utter)
}

// --- Kamera ---
async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" }
    })
    video.value.srcObject = stream
    await new Promise(resolve => {
      video.value.onloadedmetadata = () => resolve()
    })
    loading.value = false
  } catch (err) {
    console.error("Kamera gagal diakses:", err)
    hasCamera.value = false
    loading.value = false
  }
}

// --- Backend TensorFlow ---
async function setupBackend() {
  const backends = ["webgl", "wasm", "cpu"]
  for (const b of backends) {
    try {
      await tf.setBackend(b)
      await tf.ready()
      console.log("Backend aktif:", b)
      return
    } catch {
      console.warn("Backend gagal:", b)
    }
  }
}

// --- Deteksi Gesture ---
async function runGestureDetection() {
  await setupCamera()
  if (!hasCamera.value) return
  await setupBackend()

  try {
    detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet
    )
  } catch (e) {
    console.error("Gagal load detector:", e)
    return
  }

  async function detect() {
    if (!isDetecting.value) {
      requestAnimationFrame(detect)
      return
    }

    try {
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
    } catch (err) {
      console.warn("Deteksi gagal sementara:", err)
    }

    requestAnimationFrame(detect)
  }
  detect()
}

// --- Simulasi kalau tidak ada kamera ---
function simulateGesture() {
  infoText.value = myInfo
  showInfo.value = true
  speak("Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika.")
}

function toggleDetection() {
  isDetecting.value = !isDetecting.value
}

onMounted(() => {
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
  min-height: 100vh;
  background: #f9fafb;
}

/* Kamera */
.camera-box {
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

/* Info */
.info-text {
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 0.8rem 1.2rem;
  border-radius: 10px;
  font-size: 1rem;
  text-align: center;
  max-width: 420px;
  line-height: 1.4;
  box-shadow: 0 4px 10px rgba(0, 0, 0, 0.25);
}

/* Kontrol */
.controls {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  justify-content: center;
}
.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  border: none;
  background: #2563eb;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}
.btn:hover {
  background: #1e40af;
}

/* Animasi */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
