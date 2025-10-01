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

const gestureState = ref({ handUp: false, wave: false })
let prevRightWristX = 0
const myInfo = 'Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika. Senang bertemu dengan kalian semua!'

// Untuk smoothing jari tangan
const lastLeftHand = ref([])
const lastRightHand = ref([])

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

/** Camera Setup Low-Res for Mobile **/
async function setupCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return
  if (stream) stream.getTracks().forEach(t => t.stop())
  stream = await navigator.mediaDevices.getUserMedia({ 
    video: { facingMode:facingMode.value, width:320, height:240 } 
  })
  video.value.srcObject = stream
}

/** Draw Keypoints & Skeleton including Hands with smoothing **/
function drawKeypoints(results){
  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)
  const scaleX = canvas.value.width / video.value.videoWidth
  const scaleY = canvas.value.height / video.value.videoHeight

  const smoothLandmarks = (landmarks,lastLandmarks)=>{
    if(!landmarks) return []
    if(!lastLandmarks.value.length) return landmarks
    return landmarks.map((lm,i)=>({
      x: lm.x*0.5 + lastLandmarks.value[i].x*0.5,
      y: lm.y*0.5 + lastLandmarks.value[i].y*0.5
    }))
  }

  const drawLandmarks = (landmarks,color='red',connections=[]) => {
    if(!landmarks) return
    connections.forEach(([i,j])=>{
      if(landmarks[i] && landmarks[j]){
        ctx.value.strokeStyle=color
        ctx.value.lineWidth=2
        ctx.value.beginPath()
        ctx.value.moveTo(landmarks[i].x*scaleX,landmarks[i].y*scaleY)
        ctx.value.lineTo(landmarks[j].x*scaleX,landmarks[j].y*scaleY)
        ctx.value.stroke()
      }
    })
    for(const lm of landmarks){
      ctx.value.beginPath()
      ctx.value.arc(lm.x*scaleX,lm.y*scaleY,2,0,2*Math.PI)
      ctx.value.fillStyle=color
      ctx.value.fill()
    }
  }

  const handConnections = [
    [0,1],[1,2],[2,3],[3,4],
    [0,5],[5,6],[6,7],[7,8],
    [0,9],[9,10],[10,11],[11,12],
    [0,13],[13,14],[14,15],[15,16],
    [0,17],[17,18],[18,19],[19,20]
  ]

  const leftHand = smoothLandmarks(results.leftHandLandmarks,lastLeftHand)
  const rightHand = smoothLandmarks(results.rightHandLandmarks,lastRightHand)
  lastLeftHand.value = leftHand
  lastRightHand.value = rightHand

  drawLandmarks(results.poseLandmarks,'lime')
  drawLandmarks(leftHand,'yellow',handConnections)
  drawLandmarks(rightHand,'yellow',handConnections)
}

/** Detect Gestures **/
function detectGestures(results){
  if(!results.poseLandmarks || !results.rightHandLandmarks) return
  const leftWrist = results.poseLandmarks[15]
  const rightWrist = results.poseLandmarks[16]
  const leftShoulder = results.poseLandmarks[11]
  const rightShoulder = results.poseLandmarks[12]

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
}

/** Run Holistic Detection **/
function onResults(results){
  drawKeypoints(results)
  detectGestures(results)
}

onMounted(async ()=>{
  ctx.value = canvas.value.getContext('2d')
  canvas.value.width = 320
  canvas.value.height = 240

  loadVoices()
  if(speechSynthesis.onvoiceschanged!==undefined) speechSynthesis.onvoiceschanged=loadVoices

  await setupCamera()
  holistic = new mpHolistic.Holistic({locateFile:(file)=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`})
  holistic.setOptions({modelComplexity:0,smoothLandmarks:true,minDetectionConfidence:0.5,minTrackingConfidence:0.5})
  holistic.onResults(onResults)

  let lastTime = 0
  async function detectFrame(timestamp){
    if(timestamp - lastTime > 33){ // ~30 FPS
      lastTime = timestamp
      if(video.value.readyState >=2){
        await holistic.send({image:video.value})
      }
    }
    requestAnimationFrame(detectFrame)
  }
  detectFrame(0)
})
</script>

<style scoped>
video { border-radius:1rem; width:100%; height:100%; object-fit:cover; }
canvas { position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; border-radius:1rem; }
.confetti { position:fixed; width:8px; height:8px; border-radius:50%; animation:fall 2s linear forwards; pointer-events:none; }
@keyframes fall { to{ transform:translateY(100vh) rotate(720deg); opacity:0;} }
.fade-enter-active,.fade-leave-active{transition:opacity 0.5s;}
.fade-enter-from,.fade-leave-to{opacity:0;}
</style>
