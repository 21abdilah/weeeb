<template>
  <div class="gesture-root">
    <div class="top-row">
      <div class="video-wrap">
        <video ref="videoRef" class="video" autoplay playsinline muted></video>
        <canvas ref="canvasRef" class="canvas"></canvas>
        <div class="overlay-text" v-if="overlayText">{{ overlayText }}</div>
      </div>

      <div class="panel">
        <h3>⚙️ BEBENAH</h3>

        <div class="control-row">
          <label>Kamera:</label>
          <select v-model="selectedDeviceId" @change="switchCamera">
            <option v-for="d in videoDevices" :key="d.deviceId" :value="d.deviceId">
              {{ d.label || ('Camera ' + (videoDevices.indexOf(d)+1)) }}
            </option>
          </select>
        </div>

        <div class="control-row">
          <label>Basa:</label>
          <select v-model="lang" @change="updateVoiceList">
            <option value="id-ID">Indonesia</option>
            <option value="en-US">English</option>
          </select>
        </div>

        <div class="control-row">
          <label>Sora:</label>
          <select v-model="selectedVoiceURI">
            <option v-for="v in voicesFiltered" :key="v.voiceURI" :value="v.voiceURI">
              {{ v.name }} ({{ v.lang }})
            </option>
          </select>
        </div>

        <div class="control-row">
          <button @click="testVoice">🔊 tesson</button>
          <button @click="toggleAudio">{{ audioEnabled ? '🔇 Sora paeh' : '🔊 Sora hirup' }}</button>
        </div>

        <div class="control-row">
          <label>Skeleton:</label>
          <button @click="showSkeletonHands = !showSkeletonHands">{{ showSkeletonHands ? 'Panangan ✅' : 'Panangan ❌' }}</button>
          <button @click="showSkeletonPose = !showSkeletonPose">{{ showSkeletonPose ? 'Rupa ✅' : 'Rupa ❌' }}</button>
          <button @click="showSkeletonFace = !showSkeletonFace">{{ showSkeletonFace ? 'Rarai ✅' : 'Rarai ❌' }}</button>
        </div>

        <div class="control-row">
          <button @click="takeScreenshot">📸 SC</button>
        </div>

        <hr />

        <div class="status">
          <div><strong>Last Gesture:</strong> {{ detectedGesture || '-' }}</div>
          <div><strong>Right Finger:</strong> {{ rightFingerStatus || '-' }}</div>
          <div><strong>Left Finger:</strong> {{ leftFingerStatus || '-' }}</div>
        </div>

        <div class="debug" v-if="showDebug">
          <small>Debug: onResultsCalled: {{ debug.onResultsCalled ? 'Ya' : 'Tidak' }} | Hands: L={{ debug.leftHandLandmarks ? 'Ada' : 'Tidak' }}, R={{ debug.rightHandLandmarks ? 'Ada' : 'Tidak' }}</small>
          <div v-if="debug.lastError" style="color:red">{{ debug.lastError }}</div>
        </div>
        <button @click="showDebug=!showDebug" class="debug-toggle">Toggle Debug</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'

/* ===== Refs & State ===== */
const videoRef = ref(null)
const canvasRef = ref(null)
const ctx = ref(null)

const detectedGesture = ref('')
const overlayText = ref('')
const rightFingerStatus = ref('')
const leftFingerStatus = ref('')

const audioEnabled = ref(true)
const showDebug = ref(false)
const debug = ref({ onResultsCalled:false, leftHandLandmarks:false, rightHandLandmarks:false, lastError:'' })

/* ===== Skeleton Toggle ===== */
const showSkeletonHands = ref(true)
const showSkeletonPose = ref(false)
const showSkeletonFace = ref(false)

/* ===== Camera ===== */
let holistic = null
let camera = null
let localStream = null
const videoDevices = ref([])
const selectedDeviceId = ref(null)

/* ===== Enumerate Devices ===== */
async function enumerateVideoDevices(){
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    videoDevices.value = devices.filter(d => d.kind==='videoinput')
    if(!selectedDeviceId.value && videoDevices.value.length)
      selectedDeviceId.value = videoDevices.value[0].deviceId
  } catch(e){ console.warn(e) }
}

async function startCamera(deviceId){
  stopCamera()
  try {
    const constraints = deviceId
      ? { video:{ deviceId:{exact:deviceId}, width:480, height:360, frameRate:{ideal:15} } }
      : { video:{ facingMode:{ideal:'user'}, width:480, height:360, frameRate:{ideal:15} } }
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    videoRef.value.srcObject = localStream
    await videoRef.value.play()
    adaptCanvas()
  } catch(e){ debug.value.lastError = e.message || String(e) }
}

function stopCamera(){
  if(camera && camera.stop) camera.stop()
  if(localStream) localStream.getTracks().forEach(t=>t.stop())
  camera = null
  localStream = null
}

async function switchCamera(){ await startCamera(selectedDeviceId.value) }

/* ===== Canvas ===== */
function adaptCanvas(){
  const w = videoRef.value.clientWidth || 480
  const h = videoRef.value.clientHeight || 360
  canvasRef.value.width = w
  canvasRef.value.height = h
  ctx.value = canvasRef.value.getContext('2d')
}

/* ===== TTS ===== */
const lang = ref('id-ID')
const voices = ref([])
const selectedVoiceURI = ref(null)

function loadVoices(){
  voices.value = window.speechSynthesis.getVoices() || []
  const match = voices.value.find(v=>v.lang.startsWith(lang.value))
  if(match) selectedVoiceURI.value = match.voiceURI
}
if('speechSynthesis' in window) window.speechSynthesis.onvoiceschanged = loadVoices

function speakText(text){
  if(!audioEnabled.value || window.speechSynthesis.speaking) return
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

/* ===== Overlay ===== */
let overlayTimer = null
function overlayTemporary(text, ms=1800){
  overlayText.value = text
  if(overlayTimer) clearTimeout(overlayTimer)
  overlayTimer = setTimeout(()=> overlayText.value='', ms)
}

/* ===== Gesture Detection ===== */
const TIP = { thumb:4, index:8, middle:12, ring:16, pinky:20 }
const PIP = { thumb:3, index:6, middle:10, ring:14, pinky:18 }
const MCP = { thumb:2, index:5, middle:9, ring:13, pinky:17 }

const fingerHistory = { left:[], right:[] }
const HISTORY_LEN = 5
let lastSpokenRight = 0, lastSpokenLeft = 0
const COOLDOWN_MS = 2000

/* Hitung sudut antar sendi */
function getAngle(a,b,c){
  const ab = {x:b.x-a.x, y:b.y-a.y}
  const cb = {x:b.x-c.x, y:b.y-c.y}
  const dot = ab.x*cb.x + ab.y*cb.y
  const mag = Math.hypot(ab.x,ab.y)*Math.hypot(cb.x,cb.y)
  if(mag===0) return 0
  return Math.acos(dot/mag)*(180/Math.PI)
}

function isFingerExtended(hand,f){
  if(!hand) return false
  const mcp = hand[MCP[f]], pip = hand[PIP[f]], tip = hand[TIP[f]]
  if(!mcp||!pip||!tip) return false
  if(f==='thumb'){
    const angle = Math.atan2(tip.y - mcp.y, tip.x - mcp.x)
    return angle < -0.2
  } else {
    const angle = getAngle(mcp,pip,tip)
    return angle > 160 // threshold jari lurus
  }
}

function countExtendedFingers(hand){
  if(!hand) return 0
  return ['thumb','index','middle','ring','pinky'].reduce((acc,f)=>{
    if(isFingerExtended(hand,f)) return acc+1
    return acc
  },0)
}

/* Moving average filter */
function filterHistory(handName,count){
  const hist = handName==='left' ? fingerHistory.left : fingerHistory.right
  hist.push(count)
  if(hist.length>HISTORY_LEN) hist.shift()
  const sum = hist.reduce((a,b)=>a+b,0)
  return Math.round(sum / hist.length)
}

/* Perkenalan gesture */
const perkenalanGestures = {1:'Salam, Perkenalkan Saya Hilal Abdilah!',2:'Dari prodi Teknik Informatika',3:'HOBI : Memasak!',4:'Alasan Masuk Karena Lokasi Yanh Strategis Dan Nyaman .',5:'Terima kasih!'}

function detectFingerNumber(left,right){
  const now = Date.now()
  if(right){
    const n = filterHistory('right', countExtendedFingers(right))
    rightFingerStatus.value = n+' jari'
    if(now - lastSpokenRight > COOLDOWN_MS){
      triggerGesture(`${n} jari`, perkenalanGestures[n])
      lastSpokenRight = now
    }
  }
  if(left){
    const n = filterHistory('left', countExtendedFingers(left))
    leftFingerStatus.value = n+' jari'
    if(now - lastSpokenLeft > COOLDOWN_MS){
      triggerGesture(`${n} jari`, perkenalanGestures[n])
      lastSpokenLeft = now
    }
  }
}

function triggerGesture(name,text=null){
  detectedGesture.value = name
  overlayTemporary(text||name)
  if(text) speakText(text)
}

/* ===== OnResults ===== */
function onResults(results){
  debug.value.onResultsCalled = true
  debug.value.leftHandLandmarks = !!results.leftHandLandmarks
  debug.value.rightHandLandmarks = !!results.rightHandLandmarks

  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvasRef.value.width,canvasRef.value.height)
  if(results.image) ctx.value.drawImage(results.image,0,0,canvasRef.value.width,canvasRef.value.height)

  if(window.drawConnectors && window.drawLandmarks){
    if(showSkeletonHands.value){
      if(results.leftHandLandmarks) window.drawConnectors(ctx.value, results.leftHandLandmarks, window.HAND_CONNECTIONS, {color:'#FF8800', lineWidth:2})
      if(results.leftHandLandmarks) window.drawLandmarks(ctx.value, results.leftHandLandmarks, {color:'#FFFF00', lineWidth:1})
      if(results.rightHandLandmarks) window.drawConnectors(ctx.value, results.rightHandLandmarks, window.HAND_CONNECTIONS, {color:'#00FFFF', lineWidth:2})
      if(results.rightHandLandmarks) window.drawLandmarks(ctx.value, results.rightHandLandmarks, {color:'#FF00FF', lineWidth:1})
    }
    if(showSkeletonPose.value && results.poseLandmarks){
      window.drawConnectors(ctx.value, results.poseLandmarks, window.POSE_CONNECTIONS, {color:'#00FF00', lineWidth:2})
      window.drawLandmarks(ctx.value, results.poseLandmarks, {color:'#FF0000', lineWidth:1})
    }
    if(showSkeletonFace.value && results.faceLandmarks){
      window.drawLandmarks(ctx.value, results.faceLandmarks, {color:'#8888FF', lineWidth:0.5})
    }
  }

  detectFingerNumber(results.leftHandLandmarks, results.rightHandLandmarks)
}

/* ===== Init ===== */
onMounted(async ()=>{
  await enumerateVideoDevices()
  await startCamera(selectedDeviceId.value)

  const wait = () => new Promise(res=>{
    const check=()=>{ if(window.Holistic && window.Camera) return res(true); setTimeout(check,50); check() }
    check()
  })
  await wait()

  try {
    holistic = new window.Holistic({ locateFile: f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}` })
    holistic.setOptions({ modelComplexity:1, smoothLandmarks:true, minDetectionConfidence:0.6, minTrackingConfidence:0.6 })
    holistic.onResults(onResults)

    let lastSent = 0
    camera = new window.Camera(videoRef.value, {
      onFrame: async()=>{
        const now = Date.now()
        if(now - lastSent > 66){ // ~15 fps
          await holistic.send({image:videoRef.value})
          lastSent = now
        }
      },
      width:480, height:360
    })
    camera.start()
  } catch(e){ debug.value.lastError = e.message }
})

onBeforeUnmount(()=>{ stopCamera() })

/* ===== Template functions ===== */
function toggleAudio(){ audioEnabled.value = !audioEnabled.value }
function takeScreenshot(){
  const link = document.createElement('a')
  link.download = `gesture-${Date.now()}.png`
  link.href = canvasRef.value.toDataURL('image/png')
  link.click()
}
</script>

<style scoped>
.gesture-root{padding:16px;max-width:800px;margin:0 auto;font-family:Inter,Arial,sans-serif}
.top-row{display:flex;gap:12px;flex-wrap:wrap;align-items:flex-start}
.video-wrap{position:relative;width:100%;max-width:480px}
.video{width:100%;border-radius:12px;background:#000}
.canvas{position:absolute;top:0;left:0;width:100%;height:100%;border-radius:12px;pointer-events:none}
.overlay-text{position:absolute;left:50%;top:10%;transform:translateX(-50%);background:rgba(0,0,0,0.45);color:#fff;padding:6px 10px;border-radius:10px;font-weight:600;font-size:16px;text-align:center;word-break:break-word}
.panel{min-width:240px;padding:12px;background:#fff;border-radius:10px;box-shadow:0 4px 15px rgba(0,0,0,0.08)}
.control-row{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:6px 0}
.control-row label{min-width:100px;font-size:13px}
.control-row select,input{padding:5px;border-radius:6px;border:1px solid #ccc;font-size:14px}
.control-row button{padding:6px 8px;border-radius:6px;border:none;background:#0066ff;color:#fff;cursor:pointer;font-size:14px}
.status{margin-top:6px;font-size:13px}
.debug{margin-top:8px;color:#666;font-size:12px}
.debug-toggle{margin-top:6px;padding:4px 8px;background:#ff9900;color:#fff;border-radius:6px;border:none;cursor:pointer;font-size:13px}
</style>