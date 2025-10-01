<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
    <div class="w-full max-w-6xl grid md:grid-cols-3 gap-4">

      <!-- Kamera -->
      <div class="md:col-span-2 flex justify-center">
        <div class="relative w-full max-w-xl aspect-video bg-black rounded-xl shadow-lg overflow-hidden">
          <video ref="video" autoplay playsinline muted class="w-full h-full object-cover"></video>
          <canvas ref="canvas" class="absolute top-0 left-0"></canvas>
          <transition name="fade">
            <div v-if="spokenText" class="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg text-sm text-center">
              {{ spokenText }}
            </div>
          </transition>
        </div>
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

          <button @click="enableAudio" class="bg-blue-600 p-2 rounded mt-2 w-full hover:bg-blue-700">▶ Test Suara</button>
        </div>

        <div class="mt-4 flex flex-col gap-2">
          <button v-if="cameraAvailable" @click="toggleCamera" class="py-2 px-3 bg-blue-600 hover:bg-blue-700 rounded-lg">
            {{ cameraOn ? '📴 Matikan Kamera' : '📷 Nyalakan Kamera' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const video = ref(null)
const canvas = ref(null)
const ctx = ref(null)

const spokenText = ref('')
const selectedLang = ref('id-ID')
const selectedVoice = ref('')
const voices = ref([])
const facingMode = ref('user')
const cameraOn = ref(false)
const cameraAvailable = ref(true)

let stream = null
let holistic = null
let audioEnabled = ref(false)
const gesturePlayed = ref({ hand:false, wave:false, nod:false })

// ================= Speech =================
function loadVoices(){
  voices.value = speechSynthesis.getVoices()
  selectedVoice.value = voices.value.find(v => v.lang.includes('id'))?.name 
                     || voices.value.find(v => v.lang.includes('en'))?.name 
                     || voices.value[0]?.name || ''
}

function enableAudio(){
  if(audioEnabled.value) return
  audioEnabled.value = true
  speak('Tes suara berhasil diaktifkan.')
}

function speak(text){
  if(!audioEnabled.value) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = selectedLang.value
  const voice = voices.value.find(v=>v.name===selectedVoice.value)
  if(voice) utter.voice = voice
  utter.rate=0.95
  utter.pitch=1.05
  window.speechSynthesis.speak(utter)
  spokenText.value=text
  utter.onend=()=>spokenText.value=''
}

// ================= Camera =================
async function setupCamera(){
  try{
    if(stream) stream.getTracks().forEach(t=>t.stop())
    stream = await navigator.mediaDevices.getUserMedia({
      video:{facingMode:facingMode.value, width:320, height:240}
    })
    video.value.srcObject = stream
    cameraAvailable.value = true
  }catch{ cameraAvailable.value=false }
}

async function changeCamera(){
  if(cameraOn.value){ await setupCamera() }
}

async function toggleCamera(){
  if(cameraOn.value){ stream.getTracks().forEach(t=>t.stop()); cameraOn.value=false; return }
  await setupCamera()
  cameraOn.value=true
  startHolistic()
}

// ================= Drawing =================
function drawResults(results){
  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)
  ctx.value.lineWidth=2
  ctx.value.strokeStyle="lime"
  ctx.value.fillStyle="red"

  const drawLandmarks=(landmarks)=>{
    landmarks.forEach(l=>{
      ctx.value.beginPath()
      ctx.value.arc(l.x*canvas.value.width,l.y*canvas.value.height,3,0,2*Math.PI)
      ctx.value.fill()
    })
  }

  if(results.poseLandmarks) drawLandmarks(results.poseLandmarks)
  if(results.leftHandLandmarks) drawLandmarks(results.leftHandLandmarks)
  if(results.rightHandLandmarks) drawLandmarks(results.rightHandLandmarks)
  if(results.faceLandmarks) drawLandmarks(results.faceLandmarks)
}

// ================= Gestures =================
function detectGestures(results){
  if(results.poseLandmarks){
    const nose = results.poseLandmarks[0]
    const leftWrist = results.poseLandmarks[15]
    const rightWrist = results.poseLandmarks[16]

    // Angkat tangan
    if(!gesturePlayed.value.hand && (leftWrist.y<nose.y || rightWrist.y<nose.y)){
      speak('Halo! Saya Hilal Abdilah, senang bertemu kalian!')
      gesturePlayed.value.hand=true
      showConfetti()
    }

    // Wave (jauh horizontal)
    if(!gesturePlayed.value.wave && Math.abs(leftWrist.x-rightWrist.x)>0.4){
      speak('Himatika! Kita pasti bisa!')
      gesturePlayed.value.wave=true
      showConfetti()
    }
  }
}

// ================= Confetti =================
function showConfetti(){
  for(let i=0;i<10;i++){
    const c=document.createElement('div')
    c.classList.add('confetti')
    c.style.left=Math.random()*window.innerWidth+'px'
    c.style.backgroundColor=`hsl(${Math.random()*360},70%,60%)`
    document.body.appendChild(c)
    setTimeout(()=>document.body.removeChild(c),1500)
  }
}

// ================= Holistic (CDN) =================
function startHolistic(){
  const script=document.createElement('script')
  script.src="https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js"
  script.onload=()=>{
    // eslint-disable-next-line no-undef
    holistic=new Holistic.Holistic({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`})
    holistic.setOptions({modelComplexity:0,smoothLandmarks:true,minDetectionConfidence:0.5,minTrackingConfidence:0.5})
    holistic.onResults(results=>{
      drawResults(results)
      detectGestures(results)
    })
    detectFrame()
  }
  document.body.appendChild(script)
}

async function detectFrame(){
  if(video.value.readyState>=2) await holistic.send({image:video.value})
  requestAnimationFrame(detectFrame)
}

// ================= Lifecycle =================
onMounted(()=>{
  ctx.value=canvas.value.getContext('2d')
  canvas.value.width=640
  canvas.value.height=480

  loadVoices()
  if(speechSynthesis.onvoiceschanged!==undefined) speechSynthesis.onvoiceschanged=loadVoices

  setupCamera()
})
</script>

<style scoped>
video{border-radius:1rem;width:100%;height:100%;object-fit:cover}
canvas{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;border-radius:1rem}
.confetti{position:fixed;width:8px;height:8px;border-radius:50%;animation:fall 2s linear forwards;pointer-events:none}
@keyframes fall{to{transform:translateY(100vh) rotate(720deg);opacity:0}}
.fade-enter-active,.fade-leave-active{transition:opacity .5s}
.fade-enter-from,.fade-leave-to{opacity:0}
</style>
