<template>
  <div class="container">
    <!-- Kotak kamera -->
    <div class="video-box">
      <h2 v-if="loading" class="loader">📷 Menyiapkan Kamera...</h2>
      <video v-else ref="video" autoplay playsinline></video>
      <div class="subtitle" v-html="subtitleText"></div>
    </div>

    <!-- Kontrol dan pengaturan -->
    <div class="controls">
      <div v-if="availableVoices.length" class="voice-selector">
        <label>🔊 Pilih Suara:</label>
        <select v-model="selectedVoice">
          <option v-for="v in availableVoices" :key="v.name" :value="v">{{ v.name }}</option>
        </select>
        <button @click="speak('Tes suara bahasa Indonesia')">▶ Tes</button>
      </div>

      <div class="buttons">
        <template v-if="!hasCamera">
          <button @click="simulateGesture('hand')">👋 Angkat Tangan</button>
          <button @click="simulateGesture('head')">🤓 Kepala Mengangguk</button>
          <button @click="simulateGesture('wave')">👏 Lambaikan Tangan</button>
        </template>
        <template v-else>
          <button @click="toggleDetection">{{ isDetecting ? '⏸ Pause' : '▶ Resume' }}</button>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as tf from '@tensorflow/tfjs'
import * as poseDetection from '@tensorflow-models/pose-detection'

const video = ref(null)
const loading = ref(true)
const hasCamera = ref(true)
const isDetecting = ref(true)
const subtitleText = ref('')
const availableVoices = ref([])
const selectedVoice = ref(null)

let gestureFlags = { hand: false, head: false, wave: false }
let isSpeaking = false

const myInfo = `<strong>Halo semua! Perkenalkan saya Hilal Abdilah</strong><br>Mahasiswa baru Teknik Informatika<br>`

// Load voice
function loadVoices() {
  availableVoices.value = speechSynthesis.getVoices()
  selectedVoice.value =
    availableVoices.value.find(v => v.lang.includes('id')) ||
    availableVoices.value.find(v => v.lang.includes('en')) ||
    availableVoices.value[0]
}

// Speak function
function speak(text) {
  if (isSpeaking) return
  if (!selectedVoice.value) return
  const utter = new SpeechSynthesisUtterance(text)
  utter.voice = selectedVoice.value
  utter.rate = 0.9
  utter.pitch = 1.05
  utter.volume = 1
  isSpeaking = true
  utter.onend = () => { isSpeaking = false }
  speechSynthesis.speak(utter)
}

// Confetti effect
function showConfetti() {
  for (let i = 0; i < 25; i++) {
    const conf = document.createElement('div')
    conf.classList.add('confetti')
    conf.style.left = Math.random() * window.innerWidth + 'px'
    conf.style.backgroundColor = `hsl(${Math.random()*360}, 70%, 60%)`
    document.body.appendChild(conf)
    setTimeout(() => document.body.removeChild(conf), 2000)
  }
}

// Setup camera
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    hasCamera.value = false
    loading.value = false
    return
  }
  try {
    const constraints = { video: { facingMode: 'environment' } } // kamera belakang
    const stream = await navigator.mediaDevices.getUserMedia(constraints)
    video.value.srcObject = stream
    await new Promise(r => { video.value.onloadedmetadata = () => r(video.value) })
    loading.value = false
  } catch (err) {
    console.warn('Kamera tidak tersedia:', err)
    hasCamera.value = false
    loading.value = false
  }
}

// Gesture detection
async function runGestureDetection() {
  await setupCamera()
  if (!hasCamera.value) return

  await tf.setBackend('webgl')
  await tf.ready()

  const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet)

  async function detect() {
    if (!isDetecting.value) { requestAnimationFrame(detect); return }

    const poses = await detector.estimatePoses(video.value)
    if (poses.length > 0) {
      const keypoints = poses[0].keypoints
      const leftWrist = keypoints.find(p => p.name === 'left_wrist')
      const rightWrist = keypoints.find(p => p.name === 'right_wrist')
      const nose = keypoints.find(p => p.name === 'nose')

      // Angkat tangan
      if ((leftWrist.y < nose.y || rightWrist.y < nose.y) && !gestureFlags.hand) {
        gestureFlags.hand = true
        subtitleText.value = myInfo
        speak('Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika. Senang bertemu dengan kalian!')
        showConfetti()
        setTimeout(() => gestureFlags.hand = false, 4000)
      }

      // Kepala mengangguk
      const leftEye = keypoints.find(p => p.name==='left_eye')
      const rightEye = keypoints.find(p => p.name==='right_eye')
      if ((leftEye.y - rightEye.y) < -15 && !gestureFlags.head) {
        gestureFlags.head = true
        subtitleText.value = 'Terima kasih, sampai jumpa!'
        speak('Terima kasih, sampai jumpa!')
        showConfetti()
        setTimeout(() => gestureFlags.head = false, 4000)
      }

      // Lambaikan tangan
      if ((leftWrist.x - rightWrist.x) > 150 && !gestureFlags.wave) {
        gestureFlags.wave = true
        subtitleText.value = 'Himatika! Kita pasti bisa!'
        speak('Himatika! Kita pasti bisa!')
        showConfetti()
        setTimeout(() => gestureFlags.wave = false, 4000)
      }
    }
    setTimeout(() => requestAnimationFrame(detect), 66)
  }
  detect()
}

// Simulasi gesture
function simulateGesture(type) {
  switch(type) {
    case 'hand':
      subtitleText.value = myInfo
      speak('Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika. Senang bertemu dengan kalian!')
      break
    case 'head':
      subtitleText.value = 'Terima kasih, sampai jumpa!'
      speak('Terima kasih, sampai jumpa!')
      break
    case 'wave':
      subtitleText.value = 'Himatika! Kita pasti bisa!'
      speak('Himatika! Kita pasti bisa!')
      break
  }
  showConfetti()
}

// Toggle detection
function toggleDetection() { isDetecting.value = !isDetecting.value }

onMounted(() => {
  loadVoices()
  if (speechSynthesis.onvoiceschanged !== undefined) speechSynthesis.onvoiceschanged = loadVoices
  runGestureDetection()
})
</script>

<style scoped>
.container { display:flex; flex-direction:column; align-items:center; gap:1rem; padding:1rem; }
.video-box { position:relative; width:85vw; max-width:400px; border-radius:15px; overflow:hidden; box-shadow:0 4px 15px rgba(0,0,0,0.3); }
video { width:100%; border-radius:15px; transform:scaleX(1); } /* tidak mirror */
.subtitle { position:absolute; bottom:10px; left:10px; right:10px; background:rgba(0,0,0,0.6); color:white; padding:5px 10px; border-radius:10px; font-size:0.9rem; }
.controls { display:flex; flex-direction:column; gap:0.8rem; width:100%; max-width:450px; }
.voice-selector { display:flex; align-items:center; gap:0.5rem; background:#f0f0f0; padding:0.5rem 1rem; border-radius:10px; }
.voice-selector select { border-radius:5px; padding:0.3rem 0.5rem; border:1px solid #ccc; }
.buttons { display:flex; flex-wrap:wrap; gap:0.5rem; justify-content:center; }
.buttons button { padding:0.5rem 1rem; border-radius:10px; border:none; background:#28a745; color:white; cursor:pointer; }
.buttons button:hover { background:#218838; }
.confetti { position:fixed; width:8px; height:8px; animation:fall 2s linear forwards; }
@keyframes fall { to { transform:translateY(100vh) rotate(720deg); opacity:0; } }
.loader { text-align:center; font-size:1rem; padding:1rem; }
</style>
