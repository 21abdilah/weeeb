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

        <!-- Kamera -->
        <div class="control-row">
          <label>Kamera:</label>
          <select v-model="selectedDeviceId" @change="switchCamera">
            <option v-for="d in videoDevices" :key="d.deviceId" :value="d.deviceId">
              {{ d.label || ('Camera ' + (videoDevices.indexOf(d)+1)) }}
            </option>
          </select>
        </div>

        <!-- Bahasa & Voice -->
        <div class="control-row">
          <label>Bahasa:</label>
          <select v-model="lang" @change="updateVoiceList">
            <option value="id-ID">Indonesia (id-ID)</option>
            <option value="en-US">English (en-US)</option>
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

        <!-- Skeleton & Screenshot -->
        <div class="control-row">
          <button @click="toggleSkeleton">{{ showSkeleton ? 'Sembunyikan Skeleton' : 'Tampilkan Skeleton' }}</button>
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

        <!-- Custom Gesture -->
        <div class="control-row">
          <label>Custom Gesture:</label>
          <input v-model="customGestureName" placeholder="Nama Gesture"/>
          <input v-model="customGestureText" placeholder="Text/Audio"/>
          <button @click="saveCustomGesture">💾 Simpan</button>
        </div>

        <hr />

        <!-- Status -->
        <div class="status">
          <div><strong>Last Gesture:</strong> {{ detectedGesture || '-' }}</div>
          <div><strong>Right Finger:</strong> {{ rightFingerStatus || '-' }}</div>
          <div><strong>Left Finger:</strong> {{ leftFingerStatus || '-' }}</div>
        </div>

        <!-- Debug -->
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
let cooldown = { left:{}, right:{} }
const COOLDOWN_MS = 900

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

/* ========= Functions ========= */
function speakText(text){
  if(!audioEnabled.value) return
  const u = new SpeechSynthesisUtterance(text)
  const voice = voices.value.find(v=>v.voiceURI===selectedVoiceURI.value)
  if(voice) u.voice = voice
  window.speechSynthesis.speak(u)
}

function testVoice(){
  const sample = lang.value.startsWith('id') ? 'Halo, ini tes suara.' : 'Hello, this is a voice test.'
  speakText(sample)
}

const voicesFiltered = computed(()=> voices.value.filter(v=>v.lang.startsWith(lang.value.split('-')[0])))

/* ========= Overlay ========= */
let overlayTimer = null
function overlayTemporary(text, ms=1800){
  overlayText.value = text
  if(overlayTimer) clearTimeout(overlayTimer)
  overlayTimer = setTimeout(()=>{ overlayText.value = '' }, ms)
}

/* ========= Gesture ========= */
const customGestures = ref({})
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

function fingerStatusString(hand){ 
  if(!hand) return '-'
  return ['thumb','index','middle','ring','pinky'].map(f=>(isFingerExtended(hand,f)?f[0].toUpperCase()+f.slice(1):'-'+f[0])).join(', ')
}

function tryTrigger(hand, name, fn){
  const now = Date.now()
  if(!cooldown[hand][name] || now-cooldown[hand][name]>COOLDOWN_MS){
    cooldown[hand][name] = now
    fn()
  }
}

function detectFingerGestures(left,right){
  if(right){
    if(isFingerExtended(right,'thumb') && !isFingerExtended(right,'index')) tryTrigger('right','thumbs_right',()=>{ triggerGesture('Thumbs Right') })
    if(isFingerExtended(right,'index') && !isFingerExtended(right,'middle')) tryTrigger('right','point_right',()=>{ triggerGesture('Point Right') })
  }
  if(left){
    if(isFingerExtended(left,'thumb') && !isFingerExtended(left,'index')) tryTrigger('left','thumbs_left',()=>{ triggerGesture('Thumbs Left') })
    if(isFingerExtended(left,'index') && !isFingerExtended(left,'middle')) tryTrigger('left','point_left',()=>{ triggerGesture('Point Left') })
  }
}

function triggerGesture(name){
  detectedGesture.value = name
  overlayTemporary(`✨ ${name}`)
  if(customGestures.value[name]) speakText(customGestures.value[name])
  else speakText(name)
}

function saveCustomGesture(){
  if(customGestureName.value && customGestureText.value)
    customGestures.value[customGestureName.value] = customGestureText.value
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
    if(results.poseLandmarks) window.drawLandmarks(ctx.value, results.poseLandmarks, {color:'#FF0000', lineWidth:1})
    if(results.leftHandLandmarks) window.drawConnectors(ctx.value, results.leftHandLandmarks, window.HAND_CONNECTIONS, {color:'#FF8800', lineWidth:2})
    if(results.leftHandLandmarks) window.drawLandmarks(ctx.value, results.leftHandLandmarks, {color:'#FFFF00', lineWidth:1})
    if(results.rightHandLandmarks) window.drawConnectors(ctx.value, results.rightHandLandmarks, window.HAND_CONNECTIONS, {color:'#00FFFF', lineWidth:2})
    if(results.rightHandLandmarks) window.drawLandmarks(ctx.value, results.rightHandLandmarks, {color:'#FF00FF', lineWidth:1})
    if(results.faceLandmarks) window.drawLandmarks(ctx.value, results.faceLandmarks, {color:'#8888FF', lineWidth:0.5})
  }

  rightFingerStatus.value = results.rightHandLandmarks ? fingerStatusString(results.rightHandLandmarks) : '-'
  leftFingerStatus.value = results.leftHandLandmarks ? fingerStatusString(results.leftHandLandmarks) : '-'

  detectFingerGestures(results.leftHandLandmarks, results.rightHandLandmarks)
}

/* ========= Init ========= */
onMounted(async ()=>{
  await enumerateVideoDevices()
  await startCamera(selectedDeviceId.value)

  // wait for window.Holistic loaded
  const wait = () => new Promise(res=>{
    const check=()=>{
      if(window.Holistic && window.Camera) return res(true)
      setTimeout(check,50)
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

function simulate(name){ triggerGesture(`Simulasi: ${name}`) }

const customGestureName = ref('')
const customGestureText = ref('')
</script>

<style scoped>
.gesture-root{ padding:16px; max-width:800px; margin:0 auto; font-family:Inter,Arial,sans-serif }
.top-row{ display:flex; gap:12px; flex-wrap:wrap; align-items:flex-start }
.video-wrap{ position:relative; width:100%; max-width:480px }
.video{ width:100%; border-radius:12px; background:#000 }
.canvas{ position:absolute; top:0; left:0; width:100%; height:100%; border-radius:12px; pointer-events:none }
.overlay-text{ position:absolute; left:50%; top:10%; transform:translateX(-50%); background:rgba(0,0,0,0.45); color:#fff; padding:6px 10px; border-radius:10px; font-weight:600; font-size:16px }
.panel{ min-width:240px; padding:12px; background:#fff; border-radius:10px; box-shadow:0 4px 15px rgba(0,0,0,0.08) }
.control-row{ display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin:6px 0 }
.control-row label{ min-width:100px; font-size:13px }
.control-row select,input{ padding:5px; border-radius:6px; border:1px solid #ccc }
.control-row button{ padding:6px 8px; border-radius:6px; border:none; background:#0066ff; color:#fff; cursor:pointer }
.sim-buttons button{ background:#10b981; margin-right:4px }
.status{ margin-top:6px; font-size:13px }
.debug{ margin-top:8px; color:#666; font-size:12px }
.debug-toggle{ margin-top:6px; background:#ff6600; }
@media (max-width:600px){
  .top-row{ flex-direction:column; }
  .panel{ width:100%; }
  .overlay-text{ font-size:14px; padding:4px 8px; }
  .control-row label{ min-width:80px; font-size:12px }
  .control-row button,.control-row input,.control-row select{ font-size:12px; padding:4px 6px }
  .sim-buttons button{ margin-bottom:4px; font-size:12px }
}
</style>
