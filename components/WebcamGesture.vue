<template>
  <div class="gesture-wrapper">
    <!-- Kotak deteksi gesture -->
    <div class="gesture-box">
      <h2 v-if="loading">📷 Menyiapkan Kamera...</h2>
      <video v-else ref="video" autoplay playsinline></video>
      <!-- Subtitle sinkron dengan audio -->
      <div class="subtitle" v-html="spokenText"></div>
    </div>

    <!-- Kontrol & pengaturan -->
    <div class="controls">
      <!-- Pilih suara -->
      <div v-if="availableVoices.length" class="voice-selector">
        <label for="voice">🔊 Pilih Suara:</label>
        <select id="voice" v-model="selectedVoice">
          <option v-for="v in availableVoices" :key="v.name" :value="v">{{ v.name }}</option>
        </select>
        <button @click="speak('Tes suara bahasa Indonesia')">▶ Tes</button>
      </div>

      <!-- Tombol simulasi jika kamera tidak ada -->
      <div v-if="!hasCamera" class="sim-buttons">
        <button @click="simulateGesture('hand')">👋 Angkat Tangan</button>
        <button @click="simulateGesture('wave')">👏 Lambaikan Tangan</button>
      </div>

      <!-- Tombol pause/resume -->
      <div v-if="hasCamera" class="sim-buttons">
        <button @click="toggleDetection">{{ isDetecting ? '⏸ Pause' : '▶ Resume' }}</button>
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
const spokenText = ref('')
const availableVoices = ref([])
const selectedVoice = ref(null)
let cameraOn = ref(false)

const gesturePlayed = { hand: false, wave: false }
const myInfo = `<strong>Halo! Saya Hilal Abdilah</strong><br>Mahasiswa baru Teknik Informatika<br>`

// Load voices
function loadVoices() {
  availableVoices.value = speechSynthesis.getVoices()
  selectedVoice.value =
    availableVoices.value.find(v => v.name.toLowerCase().includes('indonesia')) ||
    availableVoices.value.find(v => v.lang.includes('id')) ||
    availableVoices.value[0] || null
}

// TTS sinkron dengan subtitle
let isSpeaking = false
function speak(text) {
  if (isSpeaking || !selectedVoice.value) return
  const utter = new SpeechSynthesisUtterance(text)
  utter.voice = selectedVoice.value
  utter.rate = 0.9
  utter.pitch = 1
  utter.volume = 1
  spokenText.value = text
  isSpeaking = true
  utter.onend = () => { isSpeaking = false }
  speechSynthesis.speak(utter)
}

// Confetti saat gesture
function showConfetti() {
  for (let i = 0; i < 25; i++) {
    const conf = document.createElement('div')
    conf.classList.add('confetti')
    conf.style.left = Math.random() * window.innerWidth + 'px'
    conf.style.backgroundColor = `hsl(${Math.random()*360},70%,60%)`
    document.body.appendChild(conf)
    setTimeout(()=>document.body.removeChild(conf),2000)
  }
}

// Setup camera depan/belakang
async function setupCamera() {
  if(!navigator.mediaDevices?.getUserMedia){
    hasCamera.value = false
    loading.value = false
    return
  }
  try{
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' } // belakang, ganti 'user' utk depan
    })
    video.value.srcObject = stream
    await new Promise(resolve=> video.value.onloadedmetadata = ()=>resolve(video.value))
    loading.value = false
    cameraOn.value = true
  }catch(err){
    console.warn('Kamera tidak tersedia:', err)
    hasCamera.value = false
    loading.value = false
  }
}

// Gesture detection
async function runGestureDetection() {
  await setupCamera()
  if(!cameraOn.value) return

  await tf.setBackend('webgl') // fallback otomatis jika webgpu tidak ada
  await tf.ready()

  const detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet)

  async function detect(){
    if(!isDetecting.value){ requestAnimationFrame(detect); return }
    const poses = await detector.estimatePoses(video.value)
    if(poses.length>0){
      const keypoints = poses[0].keypoints
      const leftWrist = keypoints.find(p=>p.name==='left_wrist')
      const rightWrist = keypoints.find(p=>p.name==='right_wrist')
      const nose = keypoints.find(p=>p.name==='nose')

      // Angkat tangan
      if(!gesturePlayed.hand && (leftWrist.y<nose.y || rightWrist.y<nose.y)){
        gesturePlayed.hand = true
        speak(myInfo)
        showConfetti()
        setTimeout(()=>gesturePlayed.hand=false,3000)
      }

      // Lambaikan tangan
      if(!gesturePlayed.wave && Math.abs(leftWrist.x-rightWrist.x)>150){
        gesturePlayed.wave = true
        speak('Himatika! Kita pasti bisa!')
        showConfetti()
        setTimeout(()=>gesturePlayed.wave=false,3000)
      }
    }
    requestAnimationFrame(detect)
  }
  detect()
}

// Simulasi gesture
function simulateGesture(type){
  switch(type){
    case 'hand': speak(myInfo); break
    case 'wave': speak('Himatika! Kita pasti bisa!'); break
  }
  showConfetti()
}

// Pause/resume detection
function toggleDetection(){ isDetecting.value = !isDetecting.value }

onMounted(()=>{
  loadVoices()
  if(speechSynthesis.onvoiceschanged!==undefined) speechSynthesis.onvoiceschanged = loadVoices
  runGestureDetection()
})
</script>

<style scoped>
.gesture-wrapper{
  display:flex;
  flex-direction:column;
  align-items:center;
  gap:1rem;
  padding:1rem;
}

.gesture-box{
  position:relative;
  width:85vw;
  max-width:400px;
  aspect-ratio:4/3;
  border:3px solid #007bff;
  border-radius:15px;
  overflow:hidden;
}

video{
  width:100%;
  height:100%;
  object-fit:cover;
}

.subtitle{
  position:absolute;
  bottom:10px;
  left:10px;
  background:rgba(0,0,0,0.6);
  color:white;
  padding:5px 10px;
  border-radius:10px;
  max-width:90%;
  font-size:0.95rem;
}

.controls{
  display:flex;
  flex-direction:column;
  gap:0.5rem;
  width:100%;
  max-width:420px;
}

.voice-selector, .sim-buttons{
  display:flex;
  gap:0.5rem;
  flex-wrap:wrap;
  justify-content:center;
}

.voice-selector select{
  padding:0.3rem 0.5rem;
  border-radius:6px;
  border:1px solid #ccc;
}

.voice-selector button{
  background:#007bff;
  color:white;
  border:none;
  padding:0.3rem 0.6rem;
  border-radius:6px;
  cursor:pointer;
}

.sim-buttons button{
  background:#28a745;
  color:white;
  border:none;
  padding:0.5rem 0.8rem;
  border-radius:8px;
  cursor:pointer;
}

.sim-buttons button:hover, .voice-selector button:hover{
  opacity:0.85;
}

.confetti{
  position:fixed;
  width:8px;
  height:8px;
  animation:fall 2s linear forwards;
}

@keyframes fall{
  to{ transform:translateY(100vh) rotate(720deg); opacity:0; }
}
</style>
