<template>
  <div class="gesture-root">
    <div class="top-row">
      <!-- Video & canvas -->
      <div class="video-wrap">
        <video ref="videoRef" class="video" autoplay playsinline muted></video>
        <canvas ref="canvasRef" class="canvas"></canvas>
        <div class="overlay-text" v-if="overlayText">{{ overlayText }}</div>
      </div>

      <!-- Panel kontrol -->
      <div class="panel">
        <h3>⚙️ Kontrol</h3>

        <div class="control-row">
          <label>Kamera:</label>
          <select v-model="selectedDeviceId" @change="switchCamera">
            <option v-for="d in videoDevices" :key="d.deviceId" :value="d.deviceId">
              {{ d.label || ('Camera ' + (videoDevices.indexOf(d)+1)) }}
            </option>
          </select>
        </div>

        <div class="control-row">
          <label>Bahasa:</label>
          <select v-model="lang" @change="updateVoiceList">
            <option value="id-ID">Indonesia</option>
            <option value="en-US">English</option>
          </select>
        </div>

        <div class="control-row">
          <label>Voice:</label>
          <select v-model="selectedVoiceURI">
            <option v-for="v in voicesFiltered" :key="v.voiceURI" :value="v.voiceURI">
              {{ v.name }} ({{ v.lang }})
            </option>
          </select>
        </div>

        <div class="control-row">
          <button @click="testVoice">🔊 Test Suara</button>
          <button @click="toggleAudio">{{ audioEnabled ? '🔇 Matikan Suara' : '🔊 Aktifkan Suara' }}</button>
        </div>

        <div class="control-row">
          <button @click="toggleSkeleton">{{ showSkeleton ? 'Sembunyikan Skeleton' : 'Tampilkan Skeleton' }}</button>
          <button @click="takeScreenshot">📸 Screenshot</button>
        </div>

        <hr />

        <div class="status">
          <div><strong>Last Gesture:</strong> {{ detectedGesture || '-' }}</div>
          <div><strong>Right Finger:</strong> {{ rightFingerStatus || '-' }}</div>
          <div><strong>Left Finger:</strong> {{ leftFingerStatus || '-' }}</div>
        </div>

        <div class="debug" v-if="showDebug">
          <small>Debug: onResultsCalled: {{ debug.onResultsCalled ? 'Ya' : 'Tidak' }} | Pose: {{ debug.poseLandmarks ? 'Ada' : 'Tidak' }}</small>
          <div v-if="debug.lastError" style="color:red">{{ debug.lastError }}</div>
        </div>
        <button @click="showDebug=!showDebug" class="debug-toggle">Toggle Debug</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'

/* ========= Refs & State ========= */
const videoRef = ref(null)
const canvasRef = ref(null)
const ctx = ref(null)

const detectedGesture = ref('')
const overlayText = ref('')
const rightFingerStatus = ref('')
const leftFingerStatus = ref('')

const showSkeleton = ref(true)
const audioEnabled = ref(true)
const showDebug = ref(false)

const debug = ref({
  onResultsCalled: false,
  poseLandmarks: false,
  rightHandLandmarks: false,
  leftHandLandmarks: false,
  lastError: ''
})

let holistic = null
let camera = null
let localStream = null

/* ========= Camera Devices ========= */
const videoDevices = ref([])
const selectedDeviceId = ref(null)

async function enumerateVideoDevices(){
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    videoDevices.value = devices.filter(d => d.kind === 'videoinput')
    if(!selectedDeviceId.value && videoDevices.value.length)
      selectedDeviceId.value = videoDevices.value[0].deviceId
  } catch(e){ console.warn(e) }
}

async function startCamera(deviceId){
  stopCamera()
  try {
    const constraints = deviceId 
      ? { video: { deviceId: { exact: deviceId }, width: 480, height: 360 } }
      : { video: { facingMode: { ideal: 'user' }, width: 480, height: 360 } }
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    videoRef.value.srcObject = localStream
    await videoRef.value.play()
    adaptCanvas()
  } catch(e){ debug.value.lastError = e.message || String(e) }
}

function stopCamera(){
  if(camera && camera.stop) camera.stop()
  if(localStream) localStream.getTracks().forEach(t => t.stop())
  camera = null
  localStream = null
}

async function switchCamera(){ await startCamera(selectedDeviceId.value) }

/* ========= Canvas ========= */
function adaptCanvas(){
  const w = videoRef.value.clientWidth || 480
  const h = videoRef.value.clientHeight || 360
  canvasRef.value.width = w
  canvasRef.value.height = h
  ctx.value = canvasRef.value.getContext('2d')
}

/* ========= Speech TTS ========= */
const lang = ref('id-ID')
const voices = ref([])
const selectedVoiceURI = ref(null)

function loadVoices(){
  voices.value = window.speechSynthesis.getVoices() || []
  const match = voices.value.find(x=>x.lang.startsWith(lang.value))
  if(match) selectedVoiceURI.value = match.voiceURI
}

if('speechSynthesis' in window){
  window.speechSynthesis.onvoiceschanged = loadVoices
}

function speakText(text){
  if(!audioEnabled.value) return
  const u = new SpeechSynthesisUtterance(text)
  const voice = voices.value.find(v=>v.voiceURI===selectedVoiceURI.value)
  if(voice) u.voice = voice
  u.lang = lang.value
  window.speechSynthesis.speak(u)
}

function testVoice(){
  const sample = lang.value.startsWith('id') ? 'Halo, ini tes suara.' : 'Hello, this is a voice test.'
  speakText(sample)
}

const voicesFiltered = computed(()=> voices.value.filter(v=>v.lang.startsWith(lang.value.split('-')[0])))

/* ========= Spoken Word Helper ========= */
function speakSpokenWord(lines) {
  if (!audioEnabled.value) return
  window.speechSynthesis.cancel() // hentikan bacaan sebelumnya

  let i = 0
  function next() {
    if (i < lines.length) {
      const u = new SpeechSynthesisUtterance(lines[i])
      const voice = voices.value.find(v => v.voiceURI === selectedVoiceURI.value)
      if (voice) u.voice = voice
      u.lang = lang.value
      u.rate = 0.85 // lebih lambat
      u.pitch = 0.95 // lebih berat
      u.volume = 1

      u.onend = () => setTimeout(next, 1000) // jeda 1 detik antar kalimat
      window.speechSynthesis.speak(u)
      i++
    }
  }
  next()
}

/* ========= Overlay ========= */
let overlayTimer = null
function overlayTemporary(text, ms=1800){
  overlayText.value = text
  if(overlayTimer) clearTimeout(overlayTimer)
  overlayTimer = setTimeout(()=>{ overlayText.value = '' }, ms)
}

/* ========= Gesture ========= */
const TIP = { thumb:4, index:8, middle:12, ring:16, pinky:20 }
const PIP = { thumb:3, index:6, middle:10, ring:14, pinky:18 }
const MCP = { thumb:2, index:5, middle:9, ring:13, pinky:17 }

function isFingerExtended(hand,f){ 
  if(!hand) return false
  const tip=hand[TIP[f]], pip=hand[PIP[f]], mcp=hand[MCP[f]]
  if(!tip||!pip||!mcp) return false
  if(f!=='thumb') return tip.y<pip.y-0.01
  return Math.abs(tip.x-mcp.x)>0.04 && Math.abs(tip.x-mcp.x)>Math.abs(tip.y-mcp.y)*0.6
}

function countExtendedFingers(hand){
  if(!hand) return 0
  return ['thumb','index','middle','ring','pinky'].reduce((acc,f)=>{
    if(isFingerExtended(hand,f)) return acc+1
    return acc
  },0)
}

/* Spoken Word Mapping */
const spokenWordGestures = {
  1: [
    "Satu jari terangkat,",
    "seperti sebuah janji.",
    "Bahwa langkah kecil,",
    "akan menuntun menuju mimpi."
  ],
  2: [
    "Dua jari terbuka,",
    "melambangkan damai.",
    "Kadang sederhana,",
    "tapi penuh makna."
  ],
  3: [
    "Tiga jari bersuara,",
    "seperti sahabat yang setia.",
    "Bersama, kita bisa lebih kuat.",
  ],
  4: [
    "Empat jari terbuka,",
    "bagai pintu kesempatan.",
    "Jangan ragu,",
    "langkahmu adalah jawaban."
  ],
  5: [
    "Lima jari terbentang luas,",
    "seperti langit yang merangkul.",
    "Inilah aku,",
    "menyapa dunia dengan penuh harapan."
  ]
}

let lastSpokenRight = null
let lastSpokenLeft = null

function detectFingerNumber(left,right){
  if(right){
    const n = countExtendedFingers(right)
    rightFingerStatus.value = n+' jari'
    if(n!==lastSpokenRight){
      triggerGesture(`${n} jari`)
      if(spokenWordGestures[n]) speakSpokenWord(spokenWordGestures[n])
      lastSpokenRight = n
    }
  }
  if(left){
    const n = countExtendedFingers(left)
    leftFingerStatus.value = n+' jari'
    if(n!==lastSpokenLeft){
      triggerGesture(`${n} jari`)
      if(spokenWordGestures[n]) speakSpokenWord(spokenWordGestures[n])
      lastSpokenLeft = n
    }
  }
}

function triggerGesture(name){
  detectedGesture.value = name
  overlayTemporary(name)
}

/* ========= OnResults ========= */
function onResults(results){
  debug.value.onResultsCalled = true
  debug.value.poseLandmarks = !!results.poseLandmarks
  debug.value.rightHandLandmarks = !!results.rightHandLandmarks
  debug.value.leftHandLandmarks = !!results.leftHandLandmarks

  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvasRef.value.width,canvasRef.value.height)
  if(results.image) ctx.value.drawImage(results.image,0,0,canvasRef.value.width,canvasRef.value.height)

  if(showSkeleton.value && window.drawConnectors && window.drawLandmarks){
    if(results.poseLandmarks) window.drawConnectors(ctx.value, results.poseLandmarks, window.POSE_CONNECTIONS, {color:'#00FF00', lineWidth:2})
    if(results.leftHandLandmarks) window.drawConnectors(ctx.value, results.leftHandLandmarks, window.HAND_CONNECTIONS, {color:'#FF8800', lineWidth:2})
    if(results.rightHandLandmarks) window.drawConnectors(ctx.value, results.rightHandLandmarks, window.HAND_CONNECTIONS, {color:'#00FFFF', lineWidth:2})
    if(results.faceLandmarks) window.drawLandmarks(ctx.value, results.faceLandmarks, {color:'#8888FF', lineWidth:0.5})
  }

  detectFingerNumber(results.leftHandLandmarks, results.rightHandLandmarks)
}

/* ========= Init ========= */
onMounted(async ()=>{
  await enumerateVideoDevices()
  await startCamera(selectedDeviceId.value)

  const wait = () => new Promise(res=>{
    const check=()=>{
      if(window.Holistic && window.Camera) return res(true)
      setTimeout(check,50)
      check()
    }
    check()
  })
  await wait()

  try {
    holistic = new window.Holistic({ locateFile: (f)=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}` })
    holistic.setOptions({ modelComplexity:1, smoothLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 })
    holistic.onResults(onResults)

    camera = new window.Camera(videoRef.value, {
      onFrame: async()=>{ await holistic.send({image:videoRef.value}) },
      width:480, height:360
    })
    camera.start()
  } catch(e){ debug.value.lastError = e.message }
})

onBeforeUnmount(()=>{ stopCamera() })

/* ========= Template exposed ========= */
function toggleSkeleton(){ showSkeleton.value = !showSkeleton.value }
function toggleAudio(){ audioEnabled.value = !audioEnabled.value }
function takeScreenshot(){
  const link = document.createElement('a')
  link.download = `gesture-${Date.now()}.png`
  link.href = canvasRef.value.toDataURL('image/png')
  link.click()
}
</script>

<style scoped>
.gesture-root{ padding:16px; max-width:800px; margin:0 auto; font-family:Inter,Arial,sans-serif }
.top-row{ display:flex; gap:12px; flex-wrap:wrap; align-items:flex-start }
.video-wrap{ position:relative; width:100%; max-width:480px }
.video{ width:100%; border-radius:12px; background:#000 }
.canvas{ position:absolute; top:0; left:0; width:100%; height:100%; border-radius:12px; pointer-events:none }
.overlay-text{ position:absolute; left:50%; top:10%; transform:translateX(-50%); background:rgba(0,0,0,0.45); color:#fff; padding:6px 10px; border-radius:10px; font-weight:600; font-size:16px; text-align:center; word-break:break-word }
.panel{ min-width:240px; padding:12px; background:#fff; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.08) }
.control-row{ display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin:6px 0 }
.control-row label{ min-width:100px; font-size:13px }
.control-row select,input{ padding:5px; border-radius:6px; border:1px solid #ccc; font-size:14px }
.control-row button{ padding:6px 8px; border-radius:6px; border:none; background:#0066ff; color:#fff; cursor:pointer; font-size:14px }
.status{ margin-top:6px; font-size:13px }
.debug{ margin-top:8px; color:#666; font-size:12px }
.debug-toggle{ margin-top:6px; padding:4px 8px; background:#ff9900; color:#fff; border-radius:6px; border:none; cursor:pointer; font-size:13px }
</style>
