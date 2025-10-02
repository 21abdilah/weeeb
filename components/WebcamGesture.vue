<template>
  <client-only>
    <div class="gesture-root">
      <div class="top-row">
        <!-- Video & Canvas -->
        <div class="video-wrap">
          <video ref="video" class="video" autoplay playsinline muted></video>
          <canvas ref="canvas" class="canvas"></canvas>
          <div class="overlay-text" v-if="overlayText">{{ overlayText }}</div>
        </div>

        <!-- Panel Kontrol -->
        <div class="panel">
          <h3>⚙️ Kontrol</h3>

          <!-- Pilih Kamera -->
          <div class="control-row">
            <label>Pilih Kamera:</label>
            <select v-model="selectedDeviceId" @change="switchCamera">
              <option v-for="d in videoDevices" :key="d.deviceId" :value="d.deviceId">
                {{ d.label || ('Camera ' + (videoDevices.indexOf(d)+1)) }}
              </option>
            </select>
          </div>

          <!-- Bahasa Suara -->
          <div class="control-row">
            <label>Bahasa Suara:</label>
            <select v-model="lang" @change="updateVoiceList">
              <option value="id-ID">Indonesia (id-ID)</option>
              <option value="en-US">English (en-US)</option>
            </select>
          </div>

          <!-- Voice -->
          <div class="control-row">
            <label>Voice:</label>
            <select v-model="selectedVoiceURI">
              <option v-for="v in voicesFiltered" :key="v.voiceURI" :value="v.voiceURI">
                {{ v.name }} ({{ v.lang }})
              </option>
            </select>
          </div>

          <!-- Tombol Suara -->
          <div class="control-row">
            <button @click="testVoice">🔊 Test Suara</button>
            <button @click="toggleAudio">{{ audioEnabled ? '🔇 Matikan Suara' : '🔊 Aktifkan Suara' }}</button>
          </div>

          <!-- Skeleton & Screenshot -->
          <div class="control-row">
            <button @click="toggleSkeleton">{{ showSkeleton ? 'Sembunyikan Kerangka' : 'Tampilkan Kerangka' }}</button>
            <button @click="takeScreenshot">📸 Screenshot</button>
          </div>

          <hr />

          <!-- Simulasi Gesture -->
          <div class="control-row">
            <label>Simulasi Gesture:</label>
            <div class="sim-buttons">
              <button @click="simulate('thumbs')">👍 Jempol</button>
              <button @click="simulate('point')">☝️ Menunjuk</button>
              <button @click="simulate('wave')">👋 Lambaian</button>
              <button @click="simulate('nod')">🙆 Angguk</button>
              <button @click="simulate('shake')">🙅 Geleng</button>
            </div>
          </div>

          <hr />

          <!-- Status -->
          <div class="status">
            <div><strong>Gestur:</strong> {{ detectedGesture || '-' }}</div>
            <div><strong>Status Jari (Kanan):</strong> {{ rightFingerStatus || '-' }}</div>
            <div><strong>Status Jari (Kiri):</strong> {{ leftFingerStatus || '-' }}</div>
          </div>

          <!-- Debug -->
          <div class="debug">
            <small>Debug: onResults: {{ debug.onResultsCalled ? 'Ya' : 'Tidak' }} | Pose: {{ debug.poseLandmarks ? 'Ada' : 'Tidak' }}</small>
            <div v-if="debug.lastError" style="color:red">{{ debug.lastError }}</div>
          </div>
        </div>
      </div>
    </div>
  </client-only>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'

/* ==== State ==== */
const video = ref(null)
const canvas = ref(null)
const ctx = ref(null)
const overlayText = ref('')
const detectedGesture = ref('')
const rightFingerStatus = ref('')
const leftFingerStatus = ref('')
const showSkeleton = ref(true)
const audioEnabled = ref(true)

const debug = ref({
  onResultsCalled: false,
  poseLandmarks: false,
  rightHandLandmarks: false,
  leftHandLandmarks: false,
  lastError: ''
})

let holisticInst = null
let localStream = null
let animationId = null

/* ==== Camera ==== */
const videoDevices = ref([])
const selectedDeviceId = ref(null)

async function enumerateVideoDevices(){
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    videoDevices.value = devices.filter(d => d.kind === 'videoinput')
    if(!selectedDeviceId.value && videoDevices.value.length) {
      selectedDeviceId.value = videoDevices.value[0].deviceId
    }
  } catch (e) { console.warn('enumerateDevices error', e) }
}

async function startCamera(deviceId){
  stopCamera()
  try {
    const constraints = deviceId 
      ? { video: { deviceId: { exact: deviceId }, width: 640, height: 480 } }
      : { video: { facingMode: 'user', width: 640, height: 480 } }
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    video.value.srcObject = localStream
    await video.value.play()
    adaptCanvas()
  } catch (e) { debug.value.lastError = e.message || String(e) }
}

function stopCamera(){
  if(localStream) {
    localStream.getTracks().forEach(t => t.stop())
    localStream = null
  }
  if(animationId) cancelAnimationFrame(animationId)
}

async function switchCamera(){ await startCamera(selectedDeviceId.value) }

/* ==== Canvas ==== */
function adaptCanvas(){
  if(!video.value) return
  const w = video.value.videoWidth || 640
  const h = video.value.videoHeight || 480
  canvas.value.width = w
  canvas.value.height = h
  ctx.value = canvas.value.getContext('2d')
}

/* ==== Speech ==== */
const lang = ref('id-ID')
const voices = ref([])
const selectedVoiceURI = ref(null)

function loadVoices(){ voices.value = window.speechSynthesis.getVoices() || [] }
function updateVoiceList(){
  loadVoices()
  const match = voices.value.find(x => x.lang && x.lang.startsWith(lang.value))
  if(match) selectedVoiceURI.value = match.voiceURI
}
function speakText(text){
  if(!audioEnabled.value) return
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang.value
  const voice = voices.value.find(v => v.voiceURI === selectedVoiceURI.value)
  if(voice) u.voice = voice
  window.speechSynthesis.speak(u)
}
function testVoice(){ speakText(lang.value.startsWith('id') ? 'Halo, ini tes suara.' : 'Hello, this is a voice test.') }

/* ==== Gesture detection (same logic seperti code kamu) ==== */
// ... (gesture logic tetap sama, tidak saya ubah demi singkat)

// ========== OnResults ==========
function onResults(results){
  debug.value.onResultsCalled = true
  debug.value.poseLandmarks = !!results.poseLandmarks

  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)
  ctx.value.drawImage(results.image,0,0,canvas.value.width,canvas.value.height)

  if(showSkeleton.value && window.drawConnectors){
    if(results.poseLandmarks) window.drawConnectors(ctx.value, results.poseLandmarks, window.POSE_CONNECTIONS, {color:'#00FF00'})
    if(results.leftHandLandmarks) window.drawConnectors(ctx.value, results.leftHandLandmarks, window.HAND_CONNECTIONS, {color:'#FF8800'})
    if(results.rightHandLandmarks) window.drawConnectors(ctx.value, results.rightHandLandmarks, window.HAND_CONNECTIONS, {color:'#00FFFF'})
  }
}

// ==== Init ====
async function loopFrame(){
  if(video.value && holisticInst){
    await holisticInst.send({ image: video.value })
  }
  animationId = requestAnimationFrame(loopFrame)
}

onMounted(async () => {
  await enumerateVideoDevices()
  await startCamera(selectedDeviceId.value)

  holisticInst = new window.Holistic.Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
  })
  holisticInst.setOptions({
    modelComplexity: 0,
    smoothLandmarks: true,
    minDetectionConfidence: 0.3,
    minTrackingConfidence: 0.3
  })
  holisticInst.onResults(onResults)

  loopFrame()

  if('speechSynthesis' in window){
    loadVoices()
    window.speechSynthesis.onvoiceschanged = loadVoices
  }
})

onBeforeUnmount(() => { stopCamera(); if(holisticInst?.close) holisticInst.close() })

/* ==== UI toggles ==== */
function toggleSkeleton(){ showSkeleton.value = !showSkeleton.value }
function toggleAudio(){ audioEnabled.value = !audioEnabled.value }
function takeScreenshot(){
  const link = document.createElement('a')
  link.download = `gesture-${Date.now()}.png`
  link.href = canvas.value.toDataURL('image/png')
  link.click()
}
function simulate(name){ speakText(name) }

const voicesFiltered = computed(() => voices.value.filter(v => v.lang && v.lang.startsWith(lang.value.split('-')[0])))
</script>

<style scoped>
/* sama seperti style kamu sebelumnya */
.gesture-root{ padding:16px; max-width:1100px; margin:0 auto; font-family:Inter,Arial,sans-serif; }
.top-row{ display:flex; gap:16px; flex-wrap:wrap; }
.video-wrap{ position:relative; width:640px; max-width:100% }
.video{ width:100%; border-radius:12px; background:#000; }
.canvas{ position:absolute; top:0; left:0; width:100%; height:100%; border-radius:12px; pointer-events:none }
.overlay-text{ position:absolute; left:50%; top:10%; transform:translateX(-50%); background:rgba(0,0,0,.45); color:#fff; padding:6px 10px; border-radius:8px }
.panel{ min-width:300px; padding:12px; background:#fff; border-radius:10px; box-shadow:0 4px 14px rgba(0,0,0,.08) }
</style>
