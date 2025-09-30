<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4 gap-4">
    <div class="w-full max-w-5xl grid md:grid-cols-3 gap-4">

      <!-- Kotak Kamera -->
      <div class="md:col-span-2 flex justify-center">
        <div class="relative w-full max-w-lg aspect-video bg-black rounded-xl shadow-lg overflow-hidden">
          <video ref="video" autoplay playsinline muted class="w-full h-full object-cover rounded-xl"></video>
          <transition name="fade">
            <div v-if="spokenText"
                 class="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg text-sm text-center">
              {{ spokenText }}
            </div>
          </transition>
        </div>
      </div>

      <!-- Panel Kontrol -->
      <div class="bg-gray-800 p-4 rounded-xl shadow-lg flex flex-col justify-between">
        <div>
          <h2 class="text-lg font-bold mb-4">⚙️ Pengaturan</h2>

          <!-- Pilih Kamera -->
          <label class="block mb-3">
            Kamera:
            <select v-model="facingMode" @change="restartCamera" class="mt-1 w-full p-2 rounded bg-gray-700">
              <option value="user">Depan</option>
              <option value="environment">Belakang</option>
            </select>
          </label>

          <!-- Bahasa -->
          <label class="block mb-3">
            Bahasa:
            <select v-model="selectedLang" class="mt-1 w-full p-2 rounded bg-gray-700">
              <option value="id-ID">Indonesia</option>
              <option value="en-US">English</option>
            </select>
          </label>

          <!-- Suara -->
          <label class="block mb-3">
            Suara:
            <select v-model="selectedVoice" class="mt-1 w-full p-2 rounded bg-gray-700">
              <option v-for="v in voices" :key="v.name" :value="v.name">{{ v.name }}</option>
            </select>
          </label>
        </div>

        <!-- Tombol Kamera / Simulasi -->
        <div class="mt-4 flex flex-col gap-2">
          <button v-if="cameraAvailable" @click="toggleCamera"
                  class="py-2 px-3 bg-blue-600 hover:bg-blue-700 rounded-lg">
            {{ cameraOn ? '📴 Matikan Kamera' : '📷 Nyalakan Kamera' }}
          </button>

          <template v-else>
            <button @click="simulateGesture('hand')" class="py-2 px-3 bg-green-600 hover:bg-green-700 rounded-lg">👋 Angkat Tangan</button>
            <button @click="simulateGesture('head')" class="py-2 px-3 bg-green-600 hover:bg-green-700 rounded-lg">🤓 Kepala Mengangguk</button>
            <button @click="simulateGesture('wave')" class="py-2 px-3 bg-green-600 hover:bg-green-700 rounded-lg">👏 Lambaikan Tangan</button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as tf from '@tensorflow/tfjs'
import * as posedetection from '@tensorflow-models/pose-detection'

const video = ref(null)
const spokenText = ref('')
const selectedLang = ref('id-ID')
const selectedVoice = ref('')
const voices = ref([])
const cameraOn = ref(false)
const cameraAvailable = ref(true)
const facingMode = ref('user') // default depan

let detector = null
let stream = null
const myInfo = 'Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika. Senang bertemu dengan kalian semua!'

function loadVoices() {
  voices.value = speechSynthesis.getVoices()
  selectedVoice.value = voices.value.find(v => v.lang.includes('id'))?.name || voices.value[0]?.name || ''
}

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = selectedLang.value
  const voice = voices.value.find(v => v.name === selectedVoice.value)
  if (voice) utter.voice = voice
  utter.rate = 0.95
  utter.pitch = 1.05
  window.speechSynthesis.speak(utter)
  spokenText.value = text
  setTimeout(() => spokenText.value = '', text.length * 80) // teks mengikuti suara
}

function showConfetti() {
  for (let i = 0; i < 25; i++) {
    const c = document.createElement('div')
    c.classList.add('confetti')
    c.style.left = Math.random() * window.innerWidth + 'px'
    c.style.backgroundColor = `hsl(${Math.random()*360}, 70%, 60%)`
    document.body.appendChild(c)
    setTimeout(()=>document.body.removeChild(c), 2000)
  }
}

// ✅ Setup kamera
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    cameraAvailable.value = false
    return
  }
  try {
    if (stream) stream.getTracks().forEach(t=>t.stop())
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode.value } })
    video.value.srcObject = stream
    cameraAvailable.value = true
  } catch {
    cameraAvailable.value = false
  }
}

async function restartCamera() {
  if(cameraOn.value){
    await setupCamera()
    await initTF()
    detector = await posedetection.createDetector(posedetection.SupportedModels.MoveNet)
    runDetection()
  }
}

async function toggleCamera() {
  if (cameraOn.value) {
    if(stream) stream.getTracks().forEach(t=>t.stop())
    cameraOn.value = false
    return
  }
  await setupCamera()
  cameraOn.value = true
  await initTF()
  detector = await posedetection.createDetector(posedetection.SupportedModels.MoveNet)
  runDetection()
}

async function initTF() {
  try { await tf.setBackend('webgpu'); await tf.ready() } 
  catch { try { await tf.setBackend('webgl'); await tf.ready() } 
  catch { await tf.setBackend('cpu'); await tf.ready() } }
}

async function runDetection() {
  if (!detector || !cameraOn.value) return
  try {
    const poses = await detector.estimatePoses(video.value)
    if (poses.length > 0) {
      const leftWrist = poses[0].keypoints.find(p=>p.name==='left_wrist')
      const rightWrist = poses[0].keypoints.find(p=>p.name==='right_wrist')
      const nose = poses[0].keypoints.find(p=>p.name==='nose')
      if (leftWrist && rightWrist && nose && (leftWrist.y < nose.y || rightWrist.y < nose.y)) {
        speak(myInfo)
        showConfetti()
      }
    }
  } catch(e){console.warn(e)}
  requestAnimationFrame(runDetection)
}

function simulateGesture(type){
  switch(type){
    case 'hand': speak(myInfo); break
    case 'head': speak('Terima kasih, sampai jumpa!'); break
    case 'wave': speak('Himatika! Kita pasti bisa!'); break
  }
  showConfetti()
}

onMounted(()=>{
  loadVoices()
  if(speechSynthesis.onvoiceschanged!==undefined){
    speechSynthesis.onvoiceschanged = loadVoices
  }
  setupCamera()
})
</script>

<style scoped>
video { border-radius:1rem; width:100%; height:100%; object-fit:cover; }
.confetti { position:fixed; width:8px; height:8px; animation:fall 2s linear forwards; }
@keyframes fall { to { transform:translateY(100vh) rotate(720deg); opacity:0; } }
.fade-enter-active, .fade-leave-active { transition: opacity 0.5s; }
.fade-enter-from, .fade-leave-to { opacity:0; }
</style>
