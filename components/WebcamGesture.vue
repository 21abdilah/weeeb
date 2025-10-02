<template>
  <div class="gesture-root">
    <div class="top-row">
      <div class="video-wrap">
        <video ref="video" class="video" autoplay playsinline muted></video>
        <canvas ref="canvas" class="canvas"></canvas>
        <div class="overlay-text" v-if="overlayText">{{ overlayText }}</div>
      </div>

      <div class="panel">
        <h3>⚙️ Kontrol</h3>

        <div class="control-row">
          <label>Cara Kamera:</label>
          <select v-model="selectedDeviceId" @change="switchCamera">
            <option v-for="d in videoDevices" :key="d.deviceId" :value="d.deviceId">
              {{ d.label || ('Camera ' + (videoDevices.indexOf(d)+1)) }}
            </option>
          </select>
        </div>

        <div class="control-row">
          <label>Bahasa Suara:</label>
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

        <div class="control-row">
          <button @click="toggleSkeleton">{{ showSkeleton ? 'Sembunyikan Kerangka' : 'Tampilkan Kerangka' }}</button>
          <button @click="takeScreenshot">📸 Screenshot</button>
        </div>

        <hr />

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

        <div class="status">
          <div><strong>Gestur:</strong> {{ detectedGesture || '-' }}</div>
          <div><strong>Status Jari (Kanan):</strong> {{ rightFingerStatus || '-' }}</div>
          <div><strong>Status Jari (Kiri):</strong> {{ leftFingerStatus || '-' }}</div>
        </div>

        <div class="debug">
          <small>Debug: onResults: {{ debug.onResultsCalled ? 'Ya' : 'Tidak' }} | Pose: {{ debug.poseLandmarks ? 'Ada' : 'Tidak' }}</small>
          <div v-if="debug.lastError" style="color:red">{{ debug.lastError }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'

/* ========== Refs & State ========== */
const video = ref(null)
const canvas = ref(null)
const ctx = ref(null)

const detectedGesture = ref('')
const overlayText = ref('')
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
let cameraInst = null
let localStream = null
let cooldown = {}

const COOLDOWN_MS = 900

/* ========== Camera devices ========== */
const videoDevices = ref([])
const selectedDeviceId = ref(null)

async function enumerateVideoDevices(){
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    videoDevices.value = devices.filter(d => d.kind === 'videoinput')
    // set default device if not set
    if(!selectedDeviceId.value && videoDevices.value.length) {
      selectedDeviceId.value = videoDevices.value[0].deviceId
    }
  } catch (e) {
    console.warn('enumerateDevices error', e)
  }
}

async function startCamera(deviceId){
  stopCamera()
  try {
    const constraints = deviceId ? { video: { deviceId: { exact: deviceId }, width: 640, height: 480 } }
                                 : { video: { facingMode: 'user', width: 640, height: 480 } }
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    video.value.srcObject = localStream
    await video.value.play()
    adaptCanvas()
    // if using window.Camera (MediaPipe Camera utils) we will create cameraInst later in mounted flow
    return true
  } catch (e) {
    debug.value.lastError = e.message || String(e)
    return false
  }
}

function stopCamera(){
  try {
    if(cameraInst && cameraInst.stop) {
      cameraInst.stop()
      cameraInst = null
    }
    if(localStream){
      localStream.getTracks().forEach(t => t.stop())
      localStream = null
    }
  } catch(e){ console.warn('stopCamera', e) }
}

async function switchCamera(){
  await startCamera(selectedDeviceId.value)
}

/* ========== Canvas adapt ========== */
function adaptCanvas(){
  const w = video.value.videoWidth || 640
  const h = video.value.videoHeight || 480
  canvas.value.width = w
  canvas.value.height = h
  ctx.value = canvas.value.getContext('2d')
}

/* ========== Speech (TTS) ========== */
const lang = ref('id-ID')
const voices = ref([])
const selectedVoiceURI = ref(null)

function loadVoices(){
  const v = window.speechSynthesis.getVoices()
  if(v && v.length) voices.value = v
}
function updateVoiceList(){
  loadVoices()
  // pick first matching language if none selected
  const match = voices.value.find(x => x.lang && x.lang.startsWith(lang.value))
  if(match) selectedVoiceURI.value = match.voiceURI
}
function getVoiceByURI(uri){
  return voices.value.find(v => v.voiceURI === uri) || null
}

function speakText(text){
  if(!audioEnabled.value) return
  if(!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang.value
  const voice = getVoiceByURI(selectedVoiceURI.value)
  if(voice) u.voice = voice
  window.speechSynthesis.speak(u)
}

/* ========== Test voice ========== */
function testVoice(){
  const sample = lang.value.startsWith('id') ? 'Halo, ini tes suara.' : 'Hello, this is a voice test.'
  speakText(sample)
}

/* ========== Voice loading handling ========== */
if('speechSynthesis' in window) {
  loadVoices()
  window.speechSynthesis.onvoiceschanged = () => {
    loadVoices()
    updateVoiceList()
  }
}

/* ========== Helpers for gesture detection ========== */
const TIP = { thumb:4, index:8, middle:12, ring:16, pinky:20 }
const PIP = { thumb:3, index:6, middle:10, ring:14, pinky:18 }
const MCP = { thumb:2, index:5, middle:9, ring:13, pinky:17 }

function isFingerExtended(handLandmarks, finger){
  if(!handLandmarks) return false
  const tip = handLandmarks[TIP[finger]]
  const pip = handLandmarks[PIP[finger]]
  const mcp = handLandmarks[MCP[finger]]
  if(!tip || !pip || !mcp) return false
  if(finger !== 'thumb'){
    return tip.y < pip.y - 0.01
  }
  const dx = Math.abs(tip.x - mcp.x)
  const dy = Math.abs(tip.y - mcp.y)
  return dx > 0.04 && dx > dy * 0.6
}

function fingerStatusString(handLandmarks){
  if(!handLandmarks) return '-'
  const fingers=['thumb','index','middle','ring','pinky']
  return fingers.map(f => (isFingerExtended(handLandmarks,f) ? f[0].toUpperCase()+f.slice(1) : `-${f[0]}`)).join(', ')
}

function tryTrigger(name, fn){
  const now = Date.now()
  if(!cooldown[name] || now - cooldown[name] > COOLDOWN_MS){
    cooldown[name] = now
    fn()
  }
}

/* ========== Gesture logic ========== */
function detectFingerGestures(leftHand, rightHand){
  // Right hand
  if(rightHand){
    const idx = isFingerExtended(rightHand,'index')
    const mid = isFingerExtended(rightHand,'middle')
    const ring = isFingerExtended(rightHand,'ring')
    const pinky = isFingerExtended(rightHand,'pinky')
    const thumb = isFingerExtended(rightHand,'thumb')
    if(idx && !mid && !ring && !pinky){
      tryTrigger('right_point', () => {
        detectedGesture.value = 'Kanan: Menunjuk (Telunjuk)'
        overlayTemporary('👉 Menunjuk (Kanan)')
        speakText(lang.value.startsWith('id') ? 'Menunjuk dengan jari telunjuk kanan' : 'Right pointing finger')
      })
      return
    }
    const otherExtended = mid || ring || pinky
    if(thumb && !otherExtended){
      tryTrigger('right_thumbs', () => {
        detectedGesture.value = 'Kanan: Jempol ke Atas'
        overlayTemporary('👍 Jempol Kanan')
        speakText(lang.value.startsWith('id') ? 'Jempol ke atas' : 'Thumbs up')
      })
      return
    }
  }

  // Left hand
  if(leftHand){
    const idx = isFingerExtended(leftHand,'index')
    const mid = isFingerExtended(leftHand,'middle')
    const ring = isFingerExtended(leftHand,'ring')
    const pinky = isFingerExtended(leftHand,'pinky')
    const thumb = isFingerExtended(leftHand,'thumb')
    if(idx && !mid && !ring && !pinky){
      tryTrigger('left_point', () => {
        detectedGesture.value = 'Kiri: Menunjuk (Telunjuk)'
        overlayTemporary('👉 Menunjuk (Kiri)')
        speakText(lang.value.startsWith('id') ? 'Menunjuk dengan jari telunjuk kiri' : 'Left pointing finger')
      })
      return
    }
    const otherExtended = mid || ring || pinky
    if(thumb && !otherExtended){
      tryTrigger('left_thumbs', () => {
        detectedGesture.value = 'Kiri: Jempol ke Atas'
        overlayTemporary('👍 Jempol Kiri')
        speakText(lang.value.startsWith('id') ? 'Jempol ke atas kiri' : 'Left thumbs up')
      })
      return
    }
  }
}

let lastNoseY = null, lastNoseX = null, waveBuffer = []
function detectHigherGestures(results){
  const pose = results.poseLandmarks
  if(pose){
    const nose = pose[0]
    if(nose){
      if(lastNoseY !== null && Math.abs(nose.y - lastNoseY) > 0.06){
        tryTrigger('nod', ()=>{ detectedGesture.value = 'Angguk (Nod)'; overlayTemporary('🙆 Angguk'); speakText(lang.value.startsWith('id') ? 'Ya' : 'Yes') })
      }
      lastNoseY = nose.y
      if(lastNoseX !== null && Math.abs(nose.x - lastNoseX) > 0.10){
        tryTrigger('shake', ()=>{ detectedGesture.value = 'Geleng (Shake)'; overlayTemporary('🙅 Geleng'); speakText(lang.value.startsWith('id') ? 'Tidak' : 'No') })
      }
      lastNoseX = nose.x
    }
    // raise hand detection (wrist above nose)
    const leftW = pose[15], rightW = pose[16]
    if((leftW && leftW.y < nose.y) || (rightW && rightW.y < nose.y)){
      tryTrigger('raise', ()=>{ detectedGesture.value = 'Angkat Tangan'; overlayTemporary('✋ Angkat Tangan'); speakText(lang.value.startsWith('id') ? 'Halo' : 'Hello') })
    }
  }
  // wave detection from right wrist x movement
  if(results.rightHandLandmarks && results.rightHandLandmarks[0]){
    const wx = results.rightHandLandmarks[0].x
    waveBuffer.push(wx)
    if(waveBuffer.length > 12) waveBuffer.shift()
    const min = Math.min(...waveBuffer), max = Math.max(...waveBuffer)
    if(max - min > 0.25){
      tryTrigger('wave', ()=>{ detectedGesture.value = 'Lambaian'; overlayTemporary('👋 Lambaian'); speakText(lang.value.startsWith('id') ? 'Hai' : 'Hi'); waveBuffer = [] })
    }
  } else {
    waveBuffer = []
  }
}

/* ========== Overlay helper ========== */
let overlayTimer = null
function overlayTemporary(text, ms = 1800){
  overlayText.value = text
  if(overlayTimer) clearTimeout(overlayTimer)
  overlayTimer = setTimeout(()=>{ overlayText.value = '' }, ms)
}

/* ========== OnResults (MediaPipe) ========== */
function onResults(results){
  debug.value.onResultsCalled = true
  debug.value.poseLandmarks = !!results.poseLandmarks
  debug.value.rightHandLandmarks = !!results.rightHandLandmarks
  debug.value.leftHandLandmarks = !!results.leftHandLandmarks

  if(!ctx.value) return
  // draw image
  ctx.value.clearRect(0,0,canvas.value.width, canvas.value.height)
  if(results.image) ctx.value.drawImage(results.image, 0, 0, canvas.value.width, canvas.value.height)

  // draw skeleton if enabled
  if(showSkeleton.value && window.drawConnectors && window.drawLandmarks){
    if(results.poseLandmarks){
      window.drawConnectors(ctx.value, results.poseLandmarks, window.POSE_CONNECTIONS, {color:'#00FF00', lineWidth:2})
      window.drawLandmarks(ctx.value, results.poseLandmarks, {color:'#FF0000', lineWidth:1})
    }
    if(results.leftHandLandmarks){
      window.drawConnectors(ctx.value, results.leftHandLandmarks, window.HAND_CONNECTIONS, {color:'#FF8800', lineWidth:2})
      window.drawLandmarks(ctx.value, results.leftHandLandmarks, {color:'#FFFF00', lineWidth:1})
    }
    if(results.rightHandLandmarks){
      window.drawConnectors(ctx.value, results.rightHandLandmarks, window.HAND_CONNECTIONS, {color:'#00FFFF', lineWidth:2})
      window.drawLandmarks(ctx.value, results.rightHandLandmarks, {color:'#FF00FF', lineWidth:1})
    }
    if(results.faceLandmarks){
      window.drawLandmarks(ctx.value, results.faceLandmarks, {color:'#8888FF', lineWidth:0.5})
    }
  }

  // finger status strings
  rightFingerStatus.value = results.rightHandLandmarks ? fingerStatusString(results.rightHandLandmarks) : '-'
  leftFingerStatus.value = results.leftHandLandmarks ? fingerStatusString(results.leftHandLandmarks) : '-'

  // detect gestures
  detectFingerGestures(results.leftHandLandmarks, results.rightHandLandmarks)
  detectHigherGestures(results)
}

/* ========== Init / Mount ========== */
async function waitForGlobals(){
  return new Promise(resolve => {
    const check = () => {
      if(window.Holistic && window.Camera && window.drawConnectors) return resolve(true)
      setTimeout(check, 80)
    }
    check()
  })
}

onMounted(async () => {
  // enumerate devices
  await enumerateVideoDevices()
  // start camera (preferred selectedDeviceId)
  await startCamera(selectedDeviceId.value)

  // wait for mediapipe loaded (nuxt config included CDN)
  await waitForGlobals()

  // adapt canvas
  adaptCanvas()
  window.addEventListener('resize', adaptCanvas)

  // create holistic
  holisticInst = new window.Holistic.Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
  })
  holisticInst.setOptions({
    modelComplexity: 0,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  })
  holisticInst.onResults(onResults)

  // create Camera util (MediaPipe camera utils) if available
  cameraInst = new window.Camera(video.value, {
    onFrame: async () => {
      try {
        await holisticInst.send({ image: video.value })
      } catch (e) {
        console.warn('holistic send error', e)
      }
    },
    width: 640,
    height: 480
  })
  cameraInst.start()

  // load voices once mounted
  if('speechSynthesis' in window){
    loadVoices()
    setTimeout(loadVoices, 500)
  }
})

onBeforeUnmount(() => {
  try {
    if(holisticInst && holisticInst.close) holisticInst.close()
    if(cameraInst && cameraInst.stop) cameraInst.stop()
    if(localStream) localStream.getTracks().forEach(t => t.stop())
  } catch(e){ console.warn('cleanup', e) }
  window.removeEventListener('resize', adaptCanvas)
})

/* ========== Utilities exposed to template ========== */
function toggleSkeleton(){ showSkeleton.value = !showSkeleton.value }
function toggleAudio(){ audioEnabled.value = !audioEnabled.value }

function simulate(name){
  // manual trigger gestures (simulasi)
  if(name === 'thumbs'){
    detectedGesture.value = 'Simulasi: Jempol'
    overlayTemporary('👍 Jempol (Simulasi)')
    speakText(lang.value.startsWith('id') ? 'Jempol' : 'Thumbs up')
  } else if(name === 'point'){
    detectedGesture.value = 'Simulasi: Menunjuk'
    overlayTemporary('👉 Menunjuk (Simulasi)')
    speakText(lang.value.startsWith('id') ? 'Menunjuk' : 'Pointing')
  } else if(name === 'wave'){
    detectedGesture.value = 'Simulasi: Lambaian'
    overlayTemporary('👋 Lambaian (Simulasi)')
    speakText(lang.value.startsWith('id') ? 'Hai' : 'Hello')
  } else if(name === 'nod'){
    detectedGesture.value = 'Simulasi: Angguk'
    overlayTemporary('🙆 Angguk (Simulasi)')
    speakText(lang.value.startsWith('id') ? 'Ya' : 'Yes')
  } else if(name === 'shake'){
    detectedGesture.value = 'Simulasi: Geleng'
    overlayTemporary('🙅 Geleng (Simulasi)')
    speakText(lang.value.startsWith('id') ? 'Tidak' : 'No')
  }
}

function takeScreenshot(){
  // download canvas image
  const link = document.createElement('a')
  link.download = `gesture-${Date.now()}.png`
  link.href = canvas.value.toDataURL('image/png')
  link.click()
}

/* ========== computed lists ========== */
const voicesFiltered = computed(() => {
  if(!voices.value || !voices.value.length) return []
  return voices.value.filter(v => v.lang && v.lang.startsWith(lang.value.split('-')[0]))
})

</script>

<style scoped>
.gesture-root{ padding:16px; max-width:1100px; margin:0 auto; font-family:Inter,Arial,Helvetica,sans-serif; }
.top-row{ display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; }
.video-wrap{ position:relative; width:640px; max-width:100% }
.video{ display:block; width:100%; border-radius:12px; background:#000; }
.canvas{ position:absolute; top:0; left:0; width:100%; height:100%; border-radius:12px; pointer-events:none }
.overlay-text{ position:absolute; left:50%; top:10%; transform:translateX(-50%); background:rgba(0,0,0,0.45); color:#fff; padding:8px 12px; border-radius:10px; font-weight:600; font-size:18px }
.panel{ min-width:300px; padding:12px; background:#fff; border-radius:10px; box-shadow:0 6px 20px rgba(0,0,0,0.06) }
.control-row{ display:flex; gap:8px; align-items:center; margin:6px 0; flex-wrap:wrap }
.control-row label{ min-width:110px; font-size:14px }
.control-row select{ padding:6px; border-radius:6px; border:1px solid #e2e8f0 }
.control-row button{ padding:8px 10px; border-radius:6px; border:none; background:#0066ff; color:#fff; cursor:pointer }
.sim-buttons button{ margin-right:6px; background:#10b981; }
.status{ margin-top:6px; font-size:14px; }
.debug{ margin-top:10px; color:#666; font-size:12px }
</style>