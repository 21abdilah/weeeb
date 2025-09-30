<template>
  <div class="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
    <div class="w-full max-w-4xl grid md:grid-cols-3 gap-4">

      <!-- Kamera & Keypoints -->
      <div class="md:col-span-2 flex justify-center relative">
        <video ref="video" autoplay playsinline muted class="w-full h-full object-cover rounded-xl shadow-lg"></video>
        <canvas ref="canvas" class="absolute top-0 left-0 w-full h-full"></canvas>
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
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import * as tf from '@tensorflow/tfjs'
import * as posedetection from '@tensorflow-models/pose-detection'

const video = ref(null)
const canvas = ref(null)
const ctx = ref(null)
const selectedLang = ref('id-ID')
const selectedVoice = ref('')
const voices = ref([])
const cameraOn = ref(false)
const cameraAvailable = ref(true)
const facingMode = ref('user')
let detector = null
let stream = null
let audioEnabled = ref(false)

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
  if(cameraOn.value){ await setupCamera(); runDetection() }
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

function drawKeypoints(keypoints){
  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)

  // Draw lines (skeleton)
  const skeleton = [
    ['left_shoulder','right_shoulder'],
    ['left_shoulder','left_elbow'],
    ['left_elbow','left_wrist'],
    ['right_shoulder','right_elbow'],
    ['right_elbow','right_wrist'],
    ['left_shoulder','left_hip'],
    ['right_shoulder','right_hip'],
    ['left_hip','right_hip'],
    ['left_hip','left_knee'],
    ['left_knee','left_ankle'],
    ['right_hip','right_knee'],
    ['right_knee','right_ankle']
  ]
  ctx.value.strokeStyle='lime'
  ctx.value.lineWidth=2
  skeleton.forEach(([p1,p2])=>{
    const kp1 = keypoints.find(k=>k.name===p1)
    const kp2 = keypoints.find(k=>k.name===p2)
    if(kp1 && kp2){
      ctx.value.beginPath()
      ctx.value.moveTo(kp1.x, kp1.y)
      ctx.value.lineTo(kp2.x, kp2.y)
      ctx.value.stroke()
    }
  })

  // Draw keypoints
  keypoints.forEach(k=>{
    ctx.value.fillStyle='red'
    ctx.value.beginPath()
    ctx.value.arc(k.x,k.y,5,0,2*Math.PI)
    ctx.value.fill()
  })
}

async function runDetection(){
  if(!detector || !cameraOn.value) return
  try{
    const poses = await detector.estimatePoses(video.value)
    if(poses.length>0){
      const keypoints = poses[0].keypoints.map(k=>({x:k.x, y:k.y, name:k.name}))
      drawKeypoints(keypoints)
    }
  }catch(e){console.warn(e)}
  requestAnimationFrame(runDetection)
}

onMounted(()=>{
  ctx.value = canvas.value.getContext('2d')
  canvas.value.width = 640
  canvas.value.height = 480
  setTimeout(loadVoices,100)
  if(speechSynthesis.onvoiceschanged!==undefined) speechSynthesis.onvoiceschanged=loadVoices
  toggleCamera()
})
</script>

<style scoped>
video { border-radius:1rem; width:100%; height:100%; object-fit:cover; }
canvas { border-radius:1rem; width:100%; height:100%; pointer-events:none; }
</style>
