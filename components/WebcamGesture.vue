<template>
  <div class="relative w-full max-w-2xl mx-auto">
    <video ref="video" autoplay playsinline muted class="rounded-xl shadow-lg w-full h-full object-cover"></video>
    <canvas ref="canvas" class="absolute top-0 left-0 w-full h-full pointer-events-none rounded-xl"></canvas>
    <transition name="fade">
      <div v-if="spokenText" class="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black/70 px-4 py-2 rounded-lg text-sm text-center">
        {{ spokenText }}
      </div>
    </transition>
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
const gestureState = ref({handUp:false,wave:false,nod:false})
const voices = ref([])
const selectedLang = ref('id-ID')
const selectedVoice = ref('')
let stream = null
let holistic = null

const myInfo='Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika. Senang bertemu dengan kalian semua!'

/** TTS **/
function loadVoices(){
  voices.value = speechSynthesis.getVoices()
  if(!voices.value.length) speechSynthesis.onvoiceschanged = () => {
    voices.value = speechSynthesis.getVoices()
    selectedVoice.value = voices.value[0]?.name||''
  }
  else selectedVoice.value = voices.value[0]?.name||''
}

function enableAudio(){
  if(!audioEnabled.value){
    audioEnabled.value=true
    speak('Halo! Tes suara berhasil diaktifkan.')
  }
}

function speak(text){
  if(!audioEnabled.value) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = selectedLang.value
  const voice = voices.value.find(v=>v.name===selectedVoice.value)
  if(voice) utter.voice = voice
  utter.rate=1; utter.pitch=1
  window.speechSynthesis.speak(utter)
  spokenText.value=text
  utter.onend=()=>{ spokenText.value='' }
}

/** Confetti **/
function showConfetti(){
  for(let i=0;i<20;i++){
    const c=document.createElement('div')
    c.classList.add('confetti')
    c.style.left = Math.random()*window.innerWidth+'px'
    c.style.backgroundColor = `hsl(${Math.random()*360},70%,60%)`
    document.body.appendChild(c)
    setTimeout(()=>document.body.removeChild(c),2000)
  }
}

/** Camera setup **/
async function setupCamera(){
  if(!navigator.mediaDevices?.getUserMedia) return
  if(stream) stream.getTracks().forEach(t=>t.stop())
  stream = await navigator.mediaDevices.getUserMedia({video:{width:640,height:480}})
  video.value.srcObject = stream
  cameraOn.value=true
}

/** Draw & gesture detection simplified **/
function drawKeypoints(results){
  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)
  // draw pose landmarks
  if(results.poseLandmarks){
    for(const lm of results.poseLandmarks){
      ctx.value.beginPath()
      ctx.value.arc(lm.x*canvas.value.width,lm.y*canvas.value.height,3,0,2*Math.PI)
      ctx.value.fillStyle='lime'
      ctx.value.fill()
    }
  }
  // draw hands
  if(results.leftHandLandmarks){
    for(const lm of results.leftHandLandmarks){
      ctx.value.beginPath()
      ctx.value.arc(lm.x*canvas.value.width,lm.y*canvas.value.height,2,0,2*Math.PI)
      ctx.value.fillStyle='yellow'
      ctx.value.fill()
    }
  }
  if(results.rightHandLandmarks){
    for(const lm of results.rightHandLandmarks){
      ctx.value.beginPath()
      ctx.value.arc(lm.x*canvas.value.width,lm.y*canvas.value.height,2,0,2*Math.PI)
      ctx.value.fillStyle='orange'
      ctx.value.fill()
    }
  }
}

function detectGestures(results){
  if(!results.poseLandmarks || !results.rightHandLandmarks) return
  const leftWrist=results.poseLandmarks[15]
  const rightWrist=results.poseLandmarks[16]
  if(leftWrist && rightWrist && !gestureState.value.handUp){
    if(leftWrist.y<0.5 || rightWrist.y<0.5){
      gestureState.value.handUp=true; speak(myInfo); showConfetti()
    }
  }
}

/** Run Holistic only on client **/
onMounted(async()=>{
  if(!process.client) return

  ctx.value=canvas.value.getContext('2d')
  canvas.value.width=640
  canvas.value.height=480

  loadVoices()
  if(speechSynthesis.onvoiceschanged!==undefined) speechSynthesis.onvoiceschanged=loadVoices

  await setupCamera()

  const mp = await import('@mediapipe/holistic')
  holistic = new mp.Holistic({locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`})
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
</style>
