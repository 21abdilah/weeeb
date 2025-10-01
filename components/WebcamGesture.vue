<template>
  <div class="relative w-full max-w-3xl mx-auto">
    <!-- Video & Canvas Overlay -->
    <video ref="video" autoplay playsinline muted class="rounded-xl shadow-lg w-full h-full object-cover"></video>
    <canvas ref="canvas" class="absolute top-0 left-0 w-full h-full pointer-events-none rounded-xl"></canvas>

    <!-- Spoken Text -->
    <transition name="fade">
      <div v-if="spokenText" class="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg text-sm text-center">
        {{ spokenText }}
      </div>
    </transition>

    <!-- Panel Interaktif -->
    <div class="absolute top-4 right-4 bg-gray-800 p-4 rounded-xl shadow-lg w-56 text-white text-sm">
      <div class="flex justify-between items-center mb-2">
        <span>📷 Kamera</span>
        <span :class="cameraOn?'text-green-400':'text-red-400'">{{ cameraOn?'ON':'OFF' }}</span>
      </div>
      <div class="flex justify-between items-center mb-2">
        <span>🔊 Audio</span>
        <span :class="audioEnabled?'text-green-400':'text-red-400'">{{ audioEnabled?'Aktif':'Nonaktif' }}</span>
      </div>

      <div class="flex flex-col gap-1 mb-2">
        <div v-for="g in gestureList" :key="g.key" class="flex justify-between items-center">
          <span>{{ g.icon }} {{ g.label }}</span>
          <span :class="gestureState[g.key]?'text-green-400 animate-pulse':'text-gray-400'">
            {{ gestureState[g.key]?'Aktif':'-' }}
          </span>
        </div>
      </div>

      <div class="flex flex-col gap-1">
        <label class="block">
          Bahasa:
          <select v-model="selectedLang" class="mt-1 w-full p-1 rounded bg-gray-700">
            <option value="id-ID">Indonesia</option>
            <option value="en-US">English</option>
          </select>
        </label>

        <label class="block mt-1">
          Suara:
          <select v-model="selectedVoice" class="mt-1 w-full p-1 rounded bg-gray-700">
            <option v-for="v in voices" :key="v.name" :value="v.name">{{ v.name }}</option>
          </select>
        </label>

        <button @click="enableAudio" class="bg-blue-600 hover:bg-blue-700 mt-2 p-2 rounded w-full">▶ Tes Suara</button>
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
const audioEnabled = ref(false)
const cameraOn = ref(false)
const gestureState = ref({handUp:false,wave:false,nod:false,jump:false})
const gestureList = [
  {icon:'✋', label:'Angkat Tangan', key:'handUp'},
  {icon:'👋', label:'Wave', key:'wave'},
  {icon:'🤓', label:'Nodding', key:'nod'},
  {icon:'🏃', label:'Lompat', key:'jump'}
]
const voices = ref([])
const selectedLang = ref('id-ID')
const selectedVoice = ref('')
let stream=null
let holistic=null

// TTS & Confetti
const myInfo='Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika. Senang bertemu dengan kalian semua!'

function loadVoices(){
  voices.value = speechSynthesis.getVoices()
  if(!voices.value.length) speechSynthesis.onvoiceschanged = () => {
    voices.value = speechSynthesis.getVoices()
    selectedVoice.value = voices.value[0]?.name||''
  }
  else selectedVoice.value = voices.value[0]?.name||''
}

function enableAudio(){
  if(!audioEnabled.value){ audioEnabled.value=true; speak('Halo! Tes suara berhasil diaktifkan.') }
}

function speak(text){
  if(!audioEnabled.value) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang=selectedLang.value
  const voice = voices.value.find(v=>v.name===selectedVoice.value)
  if(voice) utter.voice=voice
  utter.rate=1; utter.pitch=1
  window.speechSynthesis.speak(utter)
  spokenText.value=text
  utter.onend=()=>{ spokenText.value='' }
}

function showConfetti(){
  for(let i=0;i<25;i++){
    const c=document.createElement('div')
    c.classList.add('confetti')
    c.style.left = Math.random()*window.innerWidth+'px'
    c.style.backgroundColor = `hsl(${Math.random()*360},70%,60%)`
    document.body.appendChild(c)
    setTimeout(()=>document.body.removeChild(c),2000)
  }
}

// Camera
async function setupCamera(){
  if(!navigator.mediaDevices?.getUserMedia) return
  if(stream) stream.getTracks().forEach(t=>t.stop())
  stream = await navigator.mediaDevices.getUserMedia({video:{width:640,height:480}})
  video.value.srcObject = stream
  cameraOn.value=true
}

// Draw skeleton
function drawKeypoints(results){
  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)

  const drawLandmarks=(landmarks,color='red')=>{
    if(!landmarks) return
    for(const lm of landmarks){
      ctx.value.beginPath()
      ctx.value.arc(lm.x*canvas.value.width,lm.y*canvas.value.height,3,0,2*Math.PI)
      ctx.value.fillStyle=color
      ctx.value.fill()
      if(lm.name){
        ctx.value.font='10px Arial'
        ctx.value.fillStyle='white'
        ctx.value.fillText(lm.name,lm.x*canvas.value.width+5,lm.y*canvas.value.height-5)
      }
    }
  }

  const drawConnections=(landmarks,connections,color='lime')=>{
    if(!landmarks || !connections) return
    ctx.value.strokeStyle=color
    ctx.value.lineWidth=2
    for(const [i,j] of connections){
      const a=landmarks[i]; const b=landmarks[j]
      ctx.value.beginPath()
      ctx.value.moveTo(a.x*canvas.value.width,a.y*canvas.value.height)
      ctx.value.lineTo(b.x*canvas.value.width,b.y*canvas.value.height)
      ctx.value.stroke()
    }
  }

  drawLandmarks(results.poseLandmarks,'lime')
  drawConnections(results.poseLandmarks,POSE_CONNECTIONS,'lime')
  drawLandmarks(results.leftHandLandmarks,'yellow')
  drawConnections(results.leftHandLandmarks,HAND_CONNECTIONS,'yellow')
  drawLandmarks(results.rightHandLandmarks,'orange')
  drawConnections(results.rightHandLandmarks,HAND_CONNECTIONS,'orange')
  drawLandmarks(results.faceLandmarks,'white')
}

// Gesture detection
function detectGestures(results){
  if(!results.poseLandmarks) return
  const leftWrist = results.poseLandmarks[15]
  const rightWrist = results.poseLandmarks[16]

  if(leftWrist && rightWrist && !gestureState.value.handUp){
    if(leftWrist.y<0.5 || rightWrist.y<0.5){ gestureState.value.handUp=true; speak(myInfo); showConfetti() }
  }

  if(rightWrist){
    const deltaX = rightWrist.x - (rightWrist.prevX||0)
    if(!gestureState.value.wave && Math.abs(deltaX)>0.03){ gestureState.value.wave=true; speak('Himatika! Kita pasti bisa!'); showConfetti() }
    rightWrist.prevX = rightWrist.x
  }

  const nose = results.poseLandmarks[0]
  if(nose){
    const deltaY = nose.y - (nose.prevY||0)
    if(!gestureState.value.nod && Math.abs(deltaY)>0.03){ gestureState.value.nod=true; speak('Terima kasih, sampai jumpa!'); showConfetti() }
    nose.prevY = nose.y
  }

  const hip = results.poseLandmarks[23]
  if(hip){
    const deltaY = hip.y - (hip.prevY||0)
    if(!gestureState.value.jump && deltaY<-0.05){ gestureState.value.jump=true; speak('Lompat! Semangat!'); showConfetti() }
    hip.prevY = hip.y
  }
}

// Connections
const POSE_CONNECTIONS=[[0,1],[1,2],[2,3],[3,7],[0,4],[4,5],[5,6],[6,8],[9,10],[11,12],[11,13],[13,15],[12,14],[14,16],[23,24],[11,23],[12,24]]
const HAND_CONNECTIONS=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[0,9],[9,10],[10,11],[11,12],[12,13],[13,14],[14,15],[15,16],[0,17],[17,18],[18,19],[19,20]]

onMounted(async()=>{
  if(!process.client) return

  ctx.value=canvas.value.getContext('2d')
  canvas.value.width=640
  canvas.value.height=480

  loadVoices()
  if(speechSynthesis.onvoiceschanged!==undefined) speechSynthesis.onvoiceschanged=loadVoices

  await setupCamera()

  const mp = await import('@mediapipe/holistic')
  holistic = new mp.Holistic({locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`})
  holistic.setOptions({modelComplexity:1,smoothLandmarks:true,minDetectionConfidence:0.5,minTrackingConfidence:0.5})
  holistic.onResults(results=>{
    drawKeypoints(results)
    detectGestures(results)
  })

  async function detectFrame(){
    if(video.value.readyState>=2) await holistic.send({image:video.value})
    requestAnimationFrame(detectFrame)
  }
  detectFrame()
})
</script>

<style scoped>
video{border-radius:1rem;width:100%;height:100%;object-fit:cover}
canvas{position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;border-radius:1rem}
.confetti{position:fixed;width:8px;height:8px;border-radius:50%;animation:fall 2s linear forwards;pointer-events:none}
@keyframes fall{to{transform:translateY(100vh) rotate(720deg);opacity:0}}
.fade-enter-active,.fade-leave-active{transition:opacity .5s}
.fade-enter-from,.fade-leave-to{opacity:0}
.animate-pulse{animation:pulse 1s infinite}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
</style>
