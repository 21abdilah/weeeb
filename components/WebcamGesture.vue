<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
    <div class="w-full max-w-4xl grid md:grid-cols-3 gap-4">

      <!-- Kamera -->
      <div class="md:col-span-2 flex justify-center">
        <div class="relative w-full max-w-xl aspect-video bg-black rounded-xl shadow-lg overflow-hidden">
          <video ref="video" autoplay playsinline muted class="w-full h-full object-cover"></video>
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

          <template v-else>
            <button @click="simulateGesture('handUp')" class="py-2 px-3 bg-green-600 hover:bg-green-700 rounded-lg">👋 Angkat Tangan</button>
            <button @click="simulateGesture('nod')" class="py-2 px-3 bg-green-600 hover:bg-green-700 rounded-lg">🤓 Geleng Kepala</button>
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
const facingMode = ref('user')
let detector = null
let stream = null
let audioEnabled = ref(false)

// Gesture smoothing
const lastKeypoints = []
const gestureState = ref({ handUp:false, wave:false, nod:false })
let prevRightWristX = 0

const myInfo = 'Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika. Senang bertemu dengan kalian semua!'

function loadVoices() {
  voices.value = speechSynthesis.getVoices()
  selectedVoice.value = voices.value.find(v => v.lang.includes('id'))?.name 
                        || voices.value.find(v=>v.lang.includes('en'))?.name 
                        || voices.value[0]?.name 
                        || ''
}

function enableAudio(){
  if(audioEnabled.value) return
  speak('Halo! Tes suara berhasil diaktifkan.')
  audioEnabled.value = true
}

function speak(text){
  if(!audioEnabled.value || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const utter = new SpeechSynthesisUtterance(text)
  utter.lang = selectedLang.value
  const voice = voices.value.find(v=>v.name===selectedVoice.value)
  if(voice) utter.voice = voice
  utter.rate=0.95
  utter.pitch=1.05
  window.speechSynthesis.speak(utter)
  spokenText.value = text
  utter.onend = ()=>{ spokenText.value = '' }
}

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

async function setupCamera() {
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){
    cameraAvailable.value=false
    return
  }
  try{
    if(stream) stream.getTracks().forEach(t=>t.stop())
    stream = await navigator.mediaDevices.getUserMedia({ 
      video:{ facingMode:facingMode.value, width:640, height:480 } 
    })
    video.value.srcObject = stream
    video.value.style.transform = 'scaleX(1)'
    cameraAvailable.value=true
  }catch{ cameraAvailable.value=false }
}

async function changeCamera(){
  if(cameraOn.value){ await setupCamera(); detector = await posedetection.createDetector(posedetection.SupportedModels.MoveNet); runDetection() }
}

async function toggleCamera(){
  if(cameraOn.value){ stream.getTracks().forEach(t=>t.stop()); cameraOn.value=false; return }
  await setupCamera()
  cameraOn.value=true
  await initTF()
  detector = await posedetection.createDetector(posedetection.SupportedModels.MoveNet)
  runDetection()
}

async function initTF(){
  try{ await tf.setBackend('webgpu'); await tf.ready() } 
  catch{ try{ await tf.setBackend('webgl'); await tf.ready() } 
  catch{ await tf.setBackend('cpu'); await tf.ready() } }
}

function smoothKeypoints(keypoints){
  // moving average 3 frame
  lastKeypoints.push(keypoints)
  if(lastKeypoints.length>3) lastKeypoints.shift()
  const smoothed = keypoints.map((p,i)=>{
    let x=0,y=0,count=0
    for(const frame of lastKeypoints){
      if(frame[i]){
        x+=frame[i].x; y+=frame[i].y; count++
      }
    }
    return {x:x/count, y:y/count, name:p.name}
  })
  return smoothed
}

async function runDetection(){
  if(!detector || !cameraOn.value) return
  try{
    const poses = await detector.estimatePoses(video.value)
    if(poses.length>0){
      const keypoints = smoothKeypoints(poses[0].keypoints)
      const leftWrist = keypoints.find(p=>p.name==='left_wrist')
      const rightWrist = keypoints.find(p=>p.name==='right_wrist')
      const leftShoulder = keypoints.find(p=>p.name==='left_shoulder')
      const rightShoulder = keypoints.find(p=>p.name==='right_shoulder')
      const nose = keypoints.find(p=>p.name==='nose')
      const leftEye = keypoints.find(p=>p.name==='left_eye')
      const rightEye = keypoints.find(p=>p.name==='right_eye')

      // Angkat tangan
      if(leftWrist && rightWrist && leftShoulder && rightShoulder){
        if(!gestureState.value.handUp && (leftWrist.y < leftShoulder.y || rightWrist.y < rightShoulder.y)){
          gestureState.value.handUp=true
          speak(myInfo)
          showConfetti()
        }
      }

      // Wave tangan
      if(rightWrist){
        const deltaX = rightWrist.x - prevRightWristX
        if(!gestureState.value.wave && Math.abs(deltaX)>50){
          gestureState.value.wave=true
          speak('Himatika! Kita pasti bisa!')
          showConfetti()
        }
        prevRightWristX = rightWrist.x
      }

      // Geleng kepala (horizontal head tilt)
      if(nose && leftEye && rightEye){
        const angle = Math.atan2(rightEye.y-leftEye.y, rightEye.x-leftEye.x) * 180/Math.PI
        if(!gestureState.value.nod && Math.abs(angle)>15){
          gestureState.value.nod=true
          speak('Terima kasih, sampai jumpa!')
          showConfetti()
        }
      }
    }
  }catch(e){console.warn(e)}
  requestAnimationFrame(runDetection)
}

function simulateGesture(type){
  if(gestureState.value[type]) return
  switch(type){
    case 'handUp': speak(myInfo); gestureState.value.handUp=true; break
    case 'nod': speak('Terima kasih, sampai jumpa!'); gestureState.value.nod=true; break
    case 'wave': speak('Himatika! Kita pasti bisa!'); gestureState.value.wave=true; break
  }
  showConfetti()
}

onMounted(()=>{
  setTimeout(loadVoices,100)
  if(speechSynthesis.onvoiceschanged!==undefined) speechSynthesis.onvoiceschanged=loadVoices
  setupCamera()
})
</script>

<style scoped>
video { border-radius:1rem; width:100%; height:100%; object-fit:cover; }
.confetti { position:fixed; width:8px; height:8px; border-radius:50%; animation:fall 2s linear forwards; pointer-events:none; }
@keyframes fall { to{ transform:translateY(100vh) rotate(720deg); opacity:0; } }
.fade-enter-active,.fade-leave-active{transition:opacity 0.5s;}
.fade-enter-from,.fade-leave-to{opacity:0;}
</style>
