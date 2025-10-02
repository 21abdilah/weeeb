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
          <label>Kamera:</label>
          <select v-model="selectedDeviceId" @change="switchCamera">
            <option v-for="d in videoDevices" :key="d.deviceId" :value="d.deviceId">
              {{ d.label || ('Camera ' + (videoDevices.indexOf(d)+1)) }}
            </option>
          </select>
        </div>

        <div class="control-row">
          <label>Bahasa Suara:</label>
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
          <button @click="testVoice">🔊 Tes Suara</button>
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
          <div><strong>Gestur Terakhir:</strong> {{ detectedGesture || '-' }}</div>
          <div><strong>Status Jari Kanan:</strong> {{ rightFingerStatus || '-' }}</div>
          <div><strong>Status Jari Kiri:</strong> {{ leftFingerStatus || '-' }}</div>
        </div>

        <div class="debug">
          <small>
            Debug: onResultsCalled: {{ debug.onResultsCalled ? 'Ya' : 'Tidak' }} | 
            Pose: {{ debug.poseLandmarks ? 'Ada' : 'Tidak' }} | 
            Tangan Kanan: {{ debug.rightHandLandmarks ? 'Ada' : 'Tidak' }} | 
            Tangan Kiri: {{ debug.leftHandLandmarks ? 'Ada' : 'Tidak' }} | 
            Wajah: {{ debug.faceLandmarks ? 'Ada' : 'Tidak' }}
          </small>
          <div v-if="debug.lastError" style="color:red">⚠️ {{ debug.lastError }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'

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
  faceLandmarks: false,
  lastError: ''
})

let holisticInst = null
let cameraInst = null
let localStream = null
let cooldown = {}
const COOLDOWN_MS = 900

// Kamera
const videoDevices = ref([])
const selectedDeviceId = ref(null)

async function enumerateVideoDevices(){
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    videoDevices.value = devices.filter(d=>d.kind==='videoinput')
    if(!selectedDeviceId.value && videoDevices.value.length){
      selectedDeviceId.value = videoDevices.value[0].deviceId
    }
  } catch(e){ console.warn('enumerateDevices', e) }
}

async function startCamera(deviceId){
  stopCamera()
  try {
    const constraints = deviceId 
      ? { video: { deviceId: { exact: deviceId }, width: 480, height: 360 } } 
      : { video: { facingMode:'user', width:480, height:360 } }
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    video.value.srcObject = localStream
    await video.value.play()
    adaptCanvas()
    return true
  } catch(e){
    debug.value.lastError = e.message || String(e)
    return false
  }
}

function stopCamera(){
  try{
    if(cameraInst && cameraInst.stop) cameraInst.stop()
    cameraInst = null
    if(localStream) localStream.getTracks().forEach(t=>t.stop())
    localStream = null
  }catch(e){ console.warn('stopCamera', e) }
}

async function switchCamera(){ await startCamera(selectedDeviceId.value) }

function adaptCanvas(){
  const w = video.value.videoWidth || 480
  const h = video.value.videoHeight || 360
  canvas.value.width = w
  canvas.value.height = h
  ctx.value = canvas.value.getContext('2d')
}

// TTS
const lang = ref('id-ID')
const voices = ref([])
const selectedVoiceURI = ref(null)

function loadVoices(){
  const v = window.speechSynthesis.getVoices()
  if(v && v.length) voices.value = v
}
function updateVoiceList(){
  loadVoices()
  const match = voices.value.find(x=>x.lang.startsWith(lang.value))
  if(match) selectedVoiceURI.value = match.voiceURI
}
function getVoiceByURI(uri){ return voices.value.find(v=>v.voiceURI===uri)||null }
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
function testVoice(){
  const sample = lang.value.startsWith('id') ? 'Halo, ini tes suara.' : 'Hello, this is a voice test.'
  speakText(sample)
}

if('speechSynthesis' in window){
  loadVoices()
  window.speechSynthesis.onvoiceschanged = ()=>{ loadVoices(); updateVoiceList() }
}

// Gesture helper
const TIP = { thumb:4, index:8, middle:12, ring:16, pinky:20 }
const PIP = { thumb:3, index:6, middle:10, ring:14, pinky:18 }
const MCP = { thumb:2, index:5, middle:9, ring:13, pinky:17 }

function isFingerExtended(handLandmarks, finger){
  if(!handLandmarks) return false
  const tip = handLandmarks[TIP[finger]]
  const pip = handLandmarks[PIP[finger]]
  const mcp = handLandmarks[MCP[finger]]
  if(!tip||!pip||!mcp) return false
  if(finger!=='thumb') return tip.y < pip.y-0.01
  const dx=Math.abs(tip.x-mcp.x), dy=Math.abs(tip.y-mcp.y)
  return dx>0.04 && dx>dy*0.6
}

function fingerStatusString(handLandmarks){
  if(!handLandmarks) return '-'
  const fingers=['thumb','index','middle','ring','pinky']
  return fingers.map(f=>isFingerExtended(handLandmarks,f)? f[0].toUpperCase()+f.slice(1):`-${f[0]}`).join(', ')
}

function tryTrigger(name, fn){
  const now = Date.now()
  if(!cooldown[name] || now-cooldown[name]>COOLDOWN_MS){
    cooldown[name]=now
    fn()
  }
}

// Deteksi gesture sederhana
function detectFingerGestures(leftHand,rightHand){
  if(rightHand){
    const idx=isFingerExtended(rightHand,'index')
    const mid=isFingerExtended(rightHand,'middle')
    const ring=isFingerExtended(rightHand,'ring')
    const pinky=isFingerExtended(rightHand,'pinky')
    const thumb=isFingerExtended(rightHand,'thumb')
    if(idx&&!mid&&!ring&&!pinky){
      tryTrigger('right_point',()=>{ detectedGesture.value='Kanan: Menunjuk'; overlayTemporary('👉 Menunjuk (Kanan)'); speakText('Menunjuk jari kanan') })
      return
    }
    if(thumb&&!mid&&!ring&&!pinky){
      tryTrigger('right_thumbs',()=>{ detectedGesture.value='Kanan: Jempol'; overlayTemporary('👍 Jempol Kanan'); speakText('Jempol ke atas kanan') })
      return
    }
  }
  if(leftHand){
    const idx=isFingerExtended(leftHand,'index')
    const mid=isFingerExtended(leftHand,'middle')
    const ring=isFingerExtended(leftHand,'ring')
    const pinky=isFingerExtended(leftHand,'pinky')
    const thumb=isFingerExtended(leftHand,'thumb')
    if(idx&&!mid&&!ring&&!pinky){
      tryTrigger('left_point',()=>{ detectedGesture.value='Kiri: Menunjuk'; overlayTemporary('👉 Menunjuk (Kiri)'); speakText('Menunjuk jari kiri') })
      return
    }
    if(thumb&&!mid&&!ring&&!pinky){
      tryTrigger('left_thumbs',()=>{ detectedGesture.value='Kiri: Jempol'; overlayTemporary('👍 Jempol Kiri'); speakText('Jempol ke atas kiri') })
      return
    }
  }
}

let lastNoseY=null,lastNoseX=null,waveBuffer=[]
function detectHigherGestures(results){
  const pose=results.poseLandmarks
  if(pose){
    const nose=pose[0]
    if(nose){
      if(lastNoseY!==null && Math.abs(nose.y-lastNoseY)>0.06){
        tryTrigger('nod',()=>{ detectedGesture.value='Angguk'; overlayTemporary('🙆 Angguk'); speakText('Ya') })
      }
      lastNoseY=nose.y
      if(lastNoseX!==null && Math.abs(nose.x-lastNoseX)>0.1){
        tryTrigger('shake',()=>{ detectedGesture.value='Geleng'; overlayTemporary('🙅 Geleng'); speakText('Tidak') })
      }
      lastNoseX=nose.x
    }
    const leftW=pose[15], rightW=pose[16]
    if((leftW&&leftW.y<nose.y)||(rightW&&rightW.y<nose.y)){
      tryTrigger('raise',()=>{ detectedGesture.value='Angkat Tangan'; overlayTemporary('✋ Angkat Tangan'); speakText('Halo') })
    }
  }
  if(results.rightHandLandmarks && results.rightHandLandmarks[0]){
    const wx=results.rightHandLandmarks[0].x
    waveBuffer.push(wx)
    if(waveBuffer.length>12) waveBuffer.shift()
    const min=Math.min(...waveBuffer), max=Math.max(...waveBuffer)
    if(max-min>0.25){
      tryTrigger('wave',()=>{ detectedGesture.value='Lambaian'; overlayTemporary('👋 Lambaian'); speakText('Hai'); waveBuffer=[] })
    }
  }else waveBuffer=[]
}

let overlayTimer=null
function overlayTemporary(text, ms=1800){ overlayText.value=text; if(overlayTimer) clearTimeout(overlayTimer); overlayTimer=setTimeout(()=>overlayText.value='', ms) }

function onResults(results){
  debug.value.onResultsCalled=true
  debug.value.poseLandmarks=!!results.poseLandmarks
  debug.value.rightHandLandmarks=!!results.rightHandLandmarks
  debug.value.leftHandLandmarks=!!results.leftHandLandmarks
  debug.value.faceLandmarks=!!results.faceLandmarks

  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)
  if(results.image) ctx.value.drawImage(results.image,0,0,canvas.value.width,canvas.value.height)

  if(showSkeleton.value && window.drawConnectors && window.drawLandmarks){
    if(results.poseLandmarks) window.drawConnectors(ctx.value, results.poseLandmarks, window.POSE_CONNECTIONS,{color:'#00FF00', lineWidth:2})
    if(results.leftHandLandmarks) window.drawConnectors(ctx.value, results.leftHandLandmarks, window.HAND_CONNECTIONS,{color:'#FF8800', lineWidth:2})
    if(results.rightHandLandmarks) window.drawConnectors(ctx.value, results.rightHandLandmarks, window.HAND_CONNECTIONS,{color:'#00FFFF', lineWidth:2})
    if(results.poseLandmarks) window.drawLandmarks(ctx.value, results.poseLandmarks,{color:'#FF0000', lineWidth:1})
    if(results.leftHandLandmarks) window.drawLandmarks(ctx.value, results.leftHandLandmarks,{color:'#FFFF00', lineWidth:1})
    if(results.rightHandLandmarks) window.drawLandmarks(ctx.value, results.rightHandLandmarks,{color:'#FF00FF', lineWidth:1})
    if(results.faceLandmarks) window.drawLandmarks(ctx.value, results.faceLandmarks,{color:'#8888FF', lineWidth:0.5})
  }

  rightFingerStatus.value = fingerStatusString(results.rightHandLandmarks)
  leftFingerStatus.value = fingerStatusString(results.leftHandLandmarks)

  detectFingerGestures(results.leftHandLandmarks, results.rightHandLandmarks)
  detectHigherGestures(results)
}

function simulate(name){
  detectedGesture.value=name
  overlayTemporary('Simulasi: '+name)
  speakText('Simulasi gesture: '+name)
}

function toggleSkeleton(){ showSkeleton.value=!showSkeleton.value }
function toggleAudio(){ audioEnabled.value=!audioEnabled.value }
function takeScreenshot(){
  const link=document.createElement('a')
  link.href=canvas.value.toDataURL('image/png')
  link.download='screenshot.png'
  link.click()
}

onMounted(async()=>{
  try{
    await enumerateVideoDevices()
    await startCamera(selectedDeviceId.value)
    
    if(!window.Holistic){
      debug.value.lastError='MediaPipe Holistic tidak tersedia'
      return
    }
    holisticInst = new window.Holistic.Holistic({ locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}` })
    holisticInst.setOptions({
      modelComplexity: 1,
      smoothLandmarks: true,
      enableSegmentation:false,
      refineFaceLandmarks:true,
      minDetectionConfidence:0.5,
      minTrackingConfidence:0.5
    })
    holisticInst.onResults(onResults)
    cameraInst = new window.Camera(video.value,{
      onFrame: async()=>{ await holisticInst.send({image:video.value}) },
      width:480, height:360
    })
    cameraInst.start()
  }catch(e){ debug.value.lastError=e.message||String(e) }
})

onBeforeUnmount(()=>{ stopCamera() })
</script>

<style scoped>
.gesture-root{display:flex;flex-direction:column;align-items:center;width:100%;max-width:900px;margin:auto}
.top-row{display:flex;flex-direction:row;flex-wrap:wrap;width:100%;justify-content:center;gap:10px}
.video-wrap{position:relative;flex:1;min-width:280px;max-width:480px}
.video{width:100%;height:auto;transform:scaleX(-1);border-radius:10px}
.canvas{position:absolute;top:0;left:0;width:100%;height:100%}
.overlay-text{position:absolute;top:10px;left:10px;font-size:22px;font-weight:bold;color:#00FF00;text-shadow:1px 1px 3px black}
.panel{flex:1;min-width:260px;background:#222;color:#EEE;padding:10px;border-radius:10px;font-size:14px}
.control-row{display:flex;align-items:center;margin-bottom:6px;gap:6px}
.control-row label{flex:0 0 100px}
.control-row button{padding:4px 8px;font-size:14px}
.sim-buttons button{margin:2px}
.status{margin-top:10px;font-size:14px}
.debug{margin-top:10px;font-size:12px;color:#CCC}
</style>
