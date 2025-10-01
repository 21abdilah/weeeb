<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
    <div class="w-full max-w-4xl grid md:grid-cols-3 gap-4">

      <!-- Kamera + Canvas -->
      <div class="md:col-span-2 flex justify-center relative">
        <video ref="video" autoplay playsinline muted class="w-full h-full object-cover rounded-xl shadow-lg"></video>
        <canvas ref="canvas" class="absolute top-0 left-0 w-full h-full"></canvas>
        <transition name="fade">
          <div v-if="spokenText" class="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg text-sm text-center">
            {{ spokenText }}
          </div>
        </transition>
      </div>

      <!-- Panel Kontrol -->
      <div class="bg-gray-800 p-4 rounded-xl shadow-lg flex flex-col justify-between">
        <div>
          <h2 class="text-lg font-bold mb-4">⚙️ Pengaturan</h2>

          <label class="block mb-3">
            Kamera:
            <select v-model="facingMode" @change="changeCamera" class="mt-1 w-full p-2 rounded bg-gray-700">
              <option value="user">Depan</option>
              <option value="environment">Belakang</option>
            </select>
          </label>

          <label class="block mb-3">
            Bahasa:
            <select v-model="selectedLang" class="mt-1 w-full p-2 rounded bg-gray-700">
              <option value="id-ID">Indonesia</option>
              <option value="en-US">English</option>
            </select>
          </label>

          <label class="block mb-3">
            Suara:
            <select v-model="selectedVoice" class="mt-1 w-full p-2 rounded bg-gray-700">
              <option v-for="v in voices" :key="v.name" :value="v.name">{{ v.name }}</option>
            </select>
          </label>

          <button @click="enableAudio" class="bg-blue-600 p-2 rounded mt-2 w-full hover:bg-blue-700">
            ▶ Tes Suara
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as mpHolistic from '@mediapipe/holistic'

const video = ref(null)
const canvas = ref(null)
const ctx = ref(null)
const spokenText = ref('')
const selectedLang = ref('id-ID')
const selectedVoice = ref('')
const voices = ref([])
const facingMode = ref('user')
const audioEnabled = ref(false)
let stream = null
let holistic = null

const gestureState = ref({ handUp: false, wave: false, nod: false })
let prevRightWristX = 0
const myInfo = 'Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika. Senang bertemu dengan kalian semua!'

/** Load Voices & Setup TTS **/
function loadVoices() {
  voices.value = speechSynthesis.getVoices()
  if (!voices.value.length) {
    speechSynthesis.onvoiceschanged = () => {
      voices.value = speechSynthesis.getVoices()
      selectedVoice.value = voices.value[0]?.name || ''
    }
  } else {
    selectedVoice.value = voices.value[0]?.name || ''
  }
}

function enableAudio() {
  if (!audioEnabled.value) {
    audioEnabled.value = true
    speak('Halo! Tes suara berhasil diaktifkan.')
  }
}

function speak(text) {
  if (!audioEnabled.value || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = selectedLang.value
  const voice = voices.value.find(v => v.name === selectedVoice.value)
  if (voice) utter.voice = voice
  utter.rate = 1
  utter.pitch = 1
  window.speechSynthesis.speak(utter)
  spokenText.value = text
  utter.onend = () => { spokenText.value = '' }
}

/** Confetti **/
function showConfetti(){
  for(let i=0;i<15;i++){
    const c=document.createElement('div')
    c.classList.add('confetti')
    c.style.left = Math.random()*window.innerWidth+'px'
    c.style.backgroundColor=`hsl(${Math.random()*360},70%,60%)`
    document.body.appendChild(c)
    setTimeout(()=>document.body.removeChild(c),2000)
  }
}

/** Camera Setup **/
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return
  if (stream) stream.getTracks().forEach(t => t.stop())
  stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode:facingMode.value, width:640, height:480 } })
  video.value.srcObject = stream
}

/** Draw Keypoints & Skeleton **/
function drawKeypoints(results){
  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)
  const scaleX = canvas.value.width / video.value.videoWidth
  const scaleY = canvas.value.height / video.value.videoHeight

  const drawLandmarks = (landmarks,color='red') => {
    if(!landmarks) return
    for(const lm of landmarks){
      ctx.value.beginPath()
      ctx.value.arc(lm.x*scaleX,lm.y*scaleY,4,0,2*Math.PI)
      ctx.value.fillStyle=color
      ctx.value.fill()
    }
  }

  drawLandmarks(results.poseLandmarks,'lime')
  drawLandmarks(results.leftHandLandmarks,'yellow')
  drawLandmarks(results.rightHandLandmarks,'yellow')
  drawLandmarks(results.faceLandmarks,'white')
}

/** Detect Gestures **/
function detectGestures(results){
  if(!results.poseLandmarks || !results.leftHandLandmarks) return
  const leftWrist = results.poseLandmarks[15] // left_wrist
  const rightWrist = results.poseLandmarks[16] // right_wrist
  const leftShoulder = results.poseLandmarks[11]
  const rightShoulder = results.poseLandmarks[12]
  const nose = results.poseLandmarks[0]

  if(leftWrist && rightWrist && leftShoulder && rightShoulder){
    if(!gestureState.value.handUp && (leftWrist.y < leftShoulder.y || rightWrist.y < rightShoulder.y)){
      gestureState.value.handUp=true
      speak(myInfo)
      showConfetti()
    }
  }

  if(rightWrist){
    const deltaX = rightWrist.x - prevRightWristX
    if(!gestureState.value.wave && Math.abs(deltaX)>0.05){
      gestureState.value.wave=true
      speak('Himatika! Kita pasti bisa!')
      showConfetti()
    }
    prevRightWristX=rightWrist.x
  }

  if(nose){
    // bisa tambah deteksi geleng kepala menggunakan nose + eyes
  }
}

/** Run Holistic Detection **/
function onResults(results){
  drawKeypoints(results)
  detectGestures(results)
}

onMounted(async ()=>{
  ctx.value = canvas.value.getContext('2d')
  canvas.value.width = 640
  canvas.value.height = 480

  loadVoices()
  if(speechSynthesis.onvoiceschanged!==undefined) speechSynthesis.onvoiceschanged=loadVoices

  await setupCamera()
  holistic = new mpHolistic.Holistic({locateFile:(file)=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`})
  holistic.setOptions({modelComplexity:1,smoothLandmarks:true,minDetectionConfidence:0.5,minTrackingConfidence:0.5})
  holistic.onResults(onResults)

  async function detectFrame(){
    if(video.value.readyState >=2){
      await holistic.send({image:video.value})
    }
    requestAnimationFrame(detectFrame)
  }
  detectFrame()
})
</script>

<style scoped>
video { border-radius:1rem; width:100%; height:100%; object-fit:cover; }
canvas { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; border-radius:1rem; }
.confetti { position:fixed; width:8px; height:8px; border-radius:50%; animation:fall 2s linear forwards; pointer-events:none; }
@keyframes fall { to{ transform:translateY(100vh) rotate(720deg); opacity:0;} }
.fade-enter-active,.fade-leave-active{transition:opacity 0.5s;}
.fade-enter-from,.fade-leave-to{opacity:0;}
.spoken-text{position:absolute;bottom:5px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);padding:5px 10px;border-radius:5px;}
</style>
