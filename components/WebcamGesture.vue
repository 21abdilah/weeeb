<template>
  <div class="gesture-root">
    <div class="top-row">
      <div class="video-wrap">
        <video ref="video" class="video" autoplay playsinline muted></video>
        <canvas ref="canvas" class="canvas"></canvas>
        <div class="overlay-text" v-if="overlayText">{{ overlayText }}</div>
      </div>

      <div class="panel">
        <h3>⚙️ BEBENAH</h3>
        <div class="control-row">
          <label>HAREP/TUKANG:</label>
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
          <button @click="testVoice">🔊 ngadenge</button>
          <button @click="toggleAudio">{{ audioEnabled ? '🔇 Sora paeh' : '🔊 Sora hirup' }}</button>
        </div>

        <div class="control-row">
          <button @click="toggleSkeleton">{{ showSkeleton ? 'Sumputkeun Titik' : 'Tingalikeun Titik' }}</button>
          <button @click="takeScreenshot">📸 SC</button>
        </div>

        <hr />

        <div class="control-row">
          <label>Conto :</label>
          <div class="sim-buttons">
            <button @click="simulate('thumbs')">👍 Jempol</button>
            <button @click="simulate('point')">☝️ Ngacung</button>
            <button @click="simulate('wave')">👋 Dadah</button>
            <button @click="simulate('nod')">🙆 Manawi</button>
            <button @click="simulate('shake')">🙅 Thayang nyaho</button>
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

const COOLDOWN_MS = 300  // respawn cepat

/* ========== Camera devices ========== */
const videoDevices = ref([])
const selectedDeviceId = ref(null)

async function enumerateVideoDevices(){
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    videoDevices.value = devices.filter(d => d.kind === 'videoinput')
    if(!selectedDeviceId.value && videoDevices.value.length) selectedDeviceId.value = videoDevices.value[0].deviceId
  } catch (e) { console.warn('enumerateDevices error', e) }
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
    return true
  } catch (e) { debug.value.lastError = e.message || String(e); return false }
}

function stopCamera(){
  try {
    if(cameraInst && cameraInst.stop) cameraInst.stop()
    if(localStream) localStream.getTracks().forEach(t => t.stop())
    cameraInst = null
    localStream = null
  } catch(e){ console.warn('stopCamera', e) }
}

async function switchCamera(){ await startCamera(selectedDeviceId.value) }

/* ========== Canvas adapt ========== */
function adaptCanvas(){
  if(!video.value) return
  canvas.value.width = video.value.videoWidth
  canvas.value.height = video.value.videoHeight
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
  const match = voices.value.find(x => x.lang && x.lang.startsWith(lang.value))
  if(match) selectedVoiceURI.value = match.voiceURI
}

function getVoiceByURI(uri){ return voices.value.find(v=>v.voiceURI===uri)||null }

function ensureAudioUnlocked() {
  if ('speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance('')
    window.speechSynthesis.speak(u)
  }
}

function speakText(text){
  if(!audioEnabled.value || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang.value
  const voice = getVoiceByURI(selectedVoiceURI.value)
  if(voice) u.voice = voice
  window.speechSynthesis.speak(u)
}

function testVoice(){ ensureAudioUnlocked(); speakText(lang.value.startsWith('id') ? 'HIDUP JOKOWI' : 'WIWOK THE TOK TOK TEH TOK NOT ONLY.') }

/* ========== Gesture Detection Helpers ========== */
const TIP = { thumb:4, index:8, middle:12, ring:16, pinky:20 }
const PIP = { thumb:3, index:6, middle:10, ring:14, pinky:18 }
const MCP = { thumb:2, index:5, middle:9, ring:13, pinky:17 }

function isFingerExtended(handLandmarks, finger){
  if(!handLandmarks) return false
  const tip = handLandmarks[TIP[finger]], pip = handLandmarks[PIP[finger]], mcp = handLandmarks[MCP[finger]]
  if(!tip||!pip||!mcp) return false
  if(finger!=='thumb') return tip.y < pip.y-0.01
  const dx = Math.abs(tip.x-mcp.x), dy=Math.abs(tip.y-mcp.y)
  return dx>0.04 && dx>dy*0.6
}

function fingerStatusString(handLandmarks){
  if(!handLandmarks) return '-'
  return ['thumb','index','middle','ring','pinky'].map(f => isFingerExtended(handLandmarks,f)?f[0].toUpperCase()+f.slice(1):`-${f[0]}`).join(', ')
}

function tryTrigger(name, fn){
  const now=Date.now()
  if(!cooldown[name]||now-cooldown[name]>COOLDOWN_MS){ cooldown[name]=now; fn() }
}

/* ========== Gesture Logic ========== */
function detectFingerGestures(leftHand, rightHand){
  if(rightHand){
    const idx=isFingerExtended(rightHand,'index'), mid=isFingerExtended(rightHand,'middle')
    const ring=isFingerExtended(rightHand,'ring'), pinky=isFingerExtended(rightHand,'pinky')
    const thumb=isFingerExtended(rightHand,'thumb')
    if(idx&&!mid&&!ring&&!pinky) tryTrigger('right_point',()=>{ detectedGesture.value='Kanan: Menunjuk'; overlayTemporary('👉 Menunjuk (Kanan)'); speakText(lang.value.startsWith('id')?'Menunjuk dengan jari telunjuk kanan':'Right pointing') })
    else if(thumb&&!mid&&!ring&&!pinky) tryTrigger('right_thumbs',()=>{ detectedGesture.value='Kanan: Jempol'; overlayTemporary('👍 Jempol Kanan'); speakText(lang.value.startsWith('id')?'Jempol ke atas':'Thumbs up') })
  }
  if(leftHand){
    const idx=isFingerExtended(leftHand,'index'), mid=isFingerExtended(leftHand,'middle')
    const ring=isFingerExtended(leftHand,'ring'), pinky=isFingerExtended(leftHand,'pinky')
    const thumb=isFingerExtended(leftHand,'thumb')
    if(idx&&!mid&&!ring&&!pinky) tryTrigger('left_point',()=>{ detectedGesture.value='Kiri: Menunjuk'; overlayTemporary('👉 Menunjuk (Kiri)'); speakText(lang.value.startsWith('id')?'Menunjuk dengan jari telunjuk kiri':'Left pointing') })
    else if(thumb&&!mid&&!ring&&!pinky) tryTrigger('left_thumbs',()=>{ detectedGesture.value='Kiri: Jempol'; overlayTemporary('👍 Jempol Kiri'); speakText(lang.value.startsWith('id')?'Jempol ke atas kiri':'Left thumbs up') })
  }
}

let lastNoseY=null,lastNoseX=null,waveBuffer=[]
function detectHigherGestures(results){
  const pose=results.poseLandmarks
  if(pose){
    const nose=pose[0]
    if(nose){
      if(lastNoseY!==null&&Math.abs(nose.y-lastNoseY)>0.06) tryTrigger('nod',()=>{ detectedGesture.value='Manawi'; overlayTemporary('🙆 Manawi'); speakText(lang.value.startsWith('id')?'Ya':'Yes') })
      if(lastNoseX!==null&&Math.abs(nose.x-lastNoseX)>0.1) tryTrigger('shake',()=>{ detectedGesture.value='Theyang nyaho'; overlayTemporary('🙅 Theyang nyaho'); speakText(lang.value.startsWith('id')?'Tidak':'No') })
      lastNoseY=nose.y
      lastNoseX=nose.x
    }
    const leftW=pose[15], rightW=pose[16]
    if((leftW&&leftW.y<nose.y)||(rightW&&rightW.y<nose.y)) tryTrigger('raise',()=>{ detectedGesture.value='Angkat Tangan'; overlayTemporary('✋ Angkat Tangan'); speakText(lang.value.startsWith('id')?'Halo':'Hello') })
  }
  if(results.rightHandLandmarks&&results.rightHandLandmarks[0]){
    const wx=results.rightHandLandmarks[0].x
    waveBuffer.push(wx)
    if(waveBuffer.length>12) waveBuffer.shift()
    const min=Math.min(...waveBuffer), max=Math.max(...waveBuffer)
    if(max-min>0.25) tryTrigger('wave',()=>{ detectedGesture.value='Lambaian'; overlayTemporary('👋 Lambaian'); speakText(lang.value.startsWith('id')?'Hai':'Hi'); waveBuffer=[] })
  } else waveBuffer=[]
}

/* ========== Overlay Helper ========== */
let overlayTimer=null
function overlayTemporary(text,ms=1800){ overlayText.value=text; if(overlayTimer) clearTimeout(overlayTimer); overlayTimer=setTimeout(()=>{ overlayText.value='' }, ms) }

/* ========== OnResults ========== */
function onResults(results){
  debug.value.onResultsCalled=true
  debug.value.poseLandmarks=!!results.poseLandmarks
  debug.value.rightHandLandmarks=!!results.rightHandLandmarks
  debug.value.leftHandLandmarks=!!results.leftHandLandmarks

  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)
  if(results.image) ctx.value.drawImage(results.image,0,0,canvas.value.width,canvas.value.height)

  if(showSkeleton.value && window.drawConnectors && window.drawLandmarks){
    if(results.poseLandmarks) window.drawConnectors(ctx.value,results.poseLandmarks,window.POSE_CONNECTIONS,{color:'#00FF00',lineWidth:2})
    if(results.poseLandmarks) window.drawLandmarks(ctx.value,results.poseLandmarks,{color:'#FF0000',lineWidth:1})
    if(results.leftHandLandmarks) window.drawConnectors(ctx.value,results.leftHandLandmarks,window.HAND_CONNECTIONS,{color:'#FF8800',lineWidth:2})
    if(results.leftHandLandmarks) window.drawLandmarks(ctx.value,results.leftHandLandmarks,{color:'#FFFF00',lineWidth:1})
    if(results.rightHandLandmarks) window.drawConnectors(ctx.value,results.rightHandLandmarks,window.HAND_CONNECTIONS,{color:'#00FFFF',lineWidth:2})
    if(results.rightHandLandmarks) window.drawLandmarks(ctx.value,results.rightHandLandmarks,{color:'#FF00FF',lineWidth:1})
    if(results.faceLandmarks) window.drawLandmarks(ctx.value,results.faceLandmarks,{color:'#8888FF',lineWidth:0.5})
  }

  rightFingerStatus.value=results.rightHandLandmarks?fingerStatusString(results.rightHandLandmarks):'-'
  leftFingerStatus.value=results.leftHandLandmarks?fingerStatusString(results.leftHandLandmarks):'-'

  detectFingerGestures(results.leftHandLandmarks,results.rightHandLandmarks)
  detectHigherGestures(results)
}

/* ========== Init / Mount ========== */
async function waitForGlobals(){ return new Promise(resolve=>{ const check=()=>{ if(window.Holistic && window.Camera && window.drawConnectors) return resolve(true); setTimeout(check,80) }; check() }) }

onMounted(async ()=>{
  await enumerateVideoDevices()
  await startCamera(selectedDeviceId.value)
  await waitForGlobals()
  adaptCanvas()
  window.addEventListener('resize',adaptCanvas)

  holisticInst=new window.Holistic.Holistic({ locateFile:file=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}` })
  holisticInst.setOptions({ modelComplexity:0, smoothLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 })
  holisticInst.onResults(onResults)

  cameraInst=new window.Camera(video.value,{ onFrame: async ()=>{ try{ await holisticInst.send({image:video.value}) }catch(e){ console.warn('holistic send error',e) } }, width:640, height:480 })
  cameraInst.start()

  if('speechSynthesis' in window){ loadVoices(); setTimeout(loadVoices,500); ensureAudioUnlocked() }
})

onBeforeUnmount(()=>{
  try{
    if(holisticInst && holisticInst.close) holisticInst.close()
    if(cameraInst && cameraInst.stop) cameraInst.stop()
    if(localStream) localStream.getTracks().forEach(t=>t.stop())
  } catch(e){ console.warn('cleanup',e) }
  window.removeEventListener('resize',adaptCanvas)
})

/* ========== Utilities ========== */
function toggleSkeleton(){ showSkeleton.value=!showSkeleton.value }
function toggleAudio(){ audioEnabled.value=!audioEnabled.value }

function simulate(name){
  if(name==='thumbs'){ detectedGesture.value='Simulasi: Jempol'; overlayTemporary('👍 Jempol (Simulasi)'); speakText(lang.value.startsWith('id')?'Jempol':'Thumbs up') }
  else if(name==='point'){ detectedGesture.value='Simulasi: Menunjuk'; overlayTemporary('👉 Menunjuk (Simulasi)'); speakText(lang.value.startsWith('id')?'Menunjuk':'Pointing') }
  else if(name==='wave'){ detectedGesture.value='Simulasi: Lambaian'; overlayTemporary('👋 Lambaian (Simulasi)'); speakText(lang.value.startsWith('id')?'Hai':'Hello') }
  else if(name==='nod'){ detectedGesture.value='Simulasi: Angguk'; overlayTemporary('🙆 Angguk (Simulasi)'); speakText(lang.value.startsWith('id')?'Ya':'Yes') }
  else if(name==='shake'){ detectedGesture.value='Simulasi: Geleng'; overlayTemporary('🙅 Geleng (Simulasi)'); speakText(lang.value.startsWith('id')?'Tidak':'No') }
}

function takeScreenshot(){ const link=document.createElement('a'); link.download=`gesture-${Date.now()}.png`; link.href=canvas.value.toDataURL('image/png'); link.click() }

const voicesFiltered=computed(()=>{ if(!voices.value||!voices.value.length) return []; return voices.value.filter(v=>v.lang&&v.lang.startsWith(lang.value.split('-')[0])) })
</script>

<style scoped>
.gesture-root{ padding:12px; font-family:Inter,Arial,sans-serif; max-width:100%; box-sizing:border-box; }
.top-row{ display:flex; flex-direction:column-reverse; gap:12px; }
@media(min-width:768px){ .top-row{ flex-direction:row; align-items:flex-start; } }
.video-wrap{ position:relative; width:100%; max-width:640px; margin:0 auto; }
.video{ width:100%; border-radius:12px; background:#000; }
.canvas{ position:absolute; top:0; left:0; width:100%; height:100%; border-radius:12px; pointer-events:none; }
.overlay-text{ position:absolute; top:10%; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.45); color:#fff; padding:6px 10px; border-radius:10px; font-weight:600; font-size:16px; text-align:center; }
.panel{ width:100%; max-width:360px; margin:0 auto; padding:12px; background:#fff; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,0.1); overflow-y:auto; max-height:80vh; }
.control-row{ display:flex; flex-wrap:wrap; gap:8px; margin:6px 0; align-items:center; }
.control-row label{ min-width:100px; font-size:14px }
.control-row select, .control-row button{ padding:8px 10px; border-radius:8px; font-size:14px; border:1px solid #ccc; }
.control-row button{ background:#0066ff; color:#fff; cursor:pointer; }
.sim-buttons button{ margin-right:6px; background:#10b981; color:#fff; }
.status{ margin-top:6px; font-size:14px; }
.debug{ margin-top:10px; font-size:12px; color:#666; }
</style>
