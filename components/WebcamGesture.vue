<template>
  <div class="gesture-root">
    <div class="top-row">
      <!-- Video + Canvas -->
      <div class="video-wrap">
        <video ref="video" class="video" autoplay playsinline muted></video>
        <canvas ref="canvas" class="canvas"></canvas>
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
    videoDevices.value = devices.filter(d => d.kind==='videoinput')
    if(!selectedDeviceId.value && videoDevices.value.length)
      selectedDeviceId.value = videoDevices.value[0].deviceId
  } catch(e){ debug.value.lastError=e.message||String(e) }
}

async function startCamera(deviceId){
  stopCamera()
  try {
    const constraints = deviceId ? { video:{ deviceId:{ exact:deviceId }, width:480, height:360 } }
                                 : { video:{ facingMode:'user', width:480, height:360 } }
    localStream = await navigator.mediaDevices.getUserMedia(constraints)
    video.value.srcObject = localStream
    await video.value.play()
    adaptCanvas()
  } catch(e){ debug.value.lastError=e.message||String(e) }
}

function stopCamera(){
  try{
    if(cameraInst && cameraInst.stop) cameraInst.stop()
    if(localStream) localStream.getTracks().forEach(t=>t.stop())
  } catch(e){ console.warn('stopCamera', e) }
}

async function switchCamera(){ await startCamera(selectedDeviceId.value) }

function adaptCanvas(){
  if(!video.value) return
  canvas.value.width = video.value.videoWidth || 480
  canvas.value.height = video.value.videoHeight || 360
  ctx.value = canvas.value.getContext('2d')
}

// TTS
const lang = ref('id-ID')
const voices = ref([])
const selectedVoiceURI = ref(null)

function loadVoices(){
  const v = window.speechSynthesis.getVoices()
  if(v && v.length) voices.value=v
}
function updateVoiceList(){
  loadVoices()
  const match = voices.value.find(x=>x.lang && x.lang.startsWith(lang.value))
  if(match) selectedVoiceURI.value=match.voiceURI
}
function getVoiceByURI(uri){ return voices.value.find(v=>v.voiceURI===uri) || null }
function speakText(text){
  if(!audioEnabled.value || !('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = lang.value
  const voice = getVoiceByURI(selectedVoiceURI.value)
  if(voice) u.voice=voice
  window.speechSynthesis.speak(u)
}
function testVoice(){
  speakText(lang.value.startsWith('id') ? 'Halo, ini tes suara.' : 'Hello, this is a voice test.')
}
if('speechSynthesis' in window){
  loadVoices()
  window.speechSynthesis.onvoiceschanged=()=>{ loadVoices(); updateVoiceList() }
}

// Gesture detection helpers
const TIP={thumb:4,index:8,middle:12,ring:16,pinky:20}
const PIP={thumb:3,index:6,middle:10,ring:14,pinky:18}
const MCP={thumb:2,index:5,middle:9,ring:13,pinky:17}

function isFingerExtended(hand,finger){
  if(!hand) return false
  const tip=hand[TIP[finger]], pip=hand[PIP[finger]], mcp=hand[MCP[finger]]
  if(!tip||!pip||!mcp) return false
  if(finger!=='thumb') return tip.y < pip.y-0.01
  const dx=Math.abs(tip.x-mcp.x), dy=Math.abs(tip.y-mcp.y)
  return dx>0.04 && dx>dy*0.6
}

function fingerStatusString(hand){
  if(!hand) return '-'
  const fingers=['thumb','index','middle','ring','pinky']
  return fingers.map(f=>isFingerExtended(hand,f)?f[0].toUpperCase()+f.slice(1):`-${f[0]}`).join(', ')
}

function tryTrigger(name, fn){
  const now = Date.now()
  if(!cooldown[name] || now-cooldown[name]>COOLDOWN_MS){
    cooldown[name]=now
    fn()
  }
}

// Gesture logic
function detectFingerGestures(left,right){
  if(right){
    const idx=isFingerExtended(right,'index')
    const mid=isFingerExtended(right,'middle')
    const ring=isFingerExtended(right,'ring')
    const pinky=isFingerExtended(right,'pinky')
    const thumb=isFingerExtended(right,'thumb')
    if(idx && !mid && !ring && !pinky)
      tryTrigger('right_point',()=>{ detectedGesture.value='Kanan: Menunjuk'; overlayTemporary('👉 Menunjuk Kanan'); speakText(lang.value.startsWith('id')?'Menunjuk jari kanan':'Right pointing finger') })
    else if(thumb && !mid && !ring && !pinky)
      tryTrigger('right_thumbs',()=>{ detectedGesture.value='Kanan: Jempol'; overlayTemporary('👍 Jempol Kanan'); speakText(lang.value.startsWith('id')?'Jempol kanan':'Right Thumbs Up') })
  }
  if(left){
    const idx=isFingerExtended(left,'index')
    const mid=isFingerExtended(left,'middle')
    const ring=isFingerExtended(left,'ring')
    const pinky=isFingerExtended(left,'pinky')
    const thumb=isFingerExtended(left,'thumb')
    if(idx && !mid && !ring && !pinky)
      tryTrigger('left_point',()=>{ detectedGesture.value='Kiri: Menunjuk'; overlayTemporary('👉 Menunjuk Kiri'); speakText(lang.value.startsWith('id')?'Menunjuk jari kiri':'Left pointing finger') })
    else if(thumb && !mid && !ring && !pinky)
      tryTrigger('left_thumbs',()=>{ detectedGesture.value='Kiri: Jempol'; overlayTemporary('👍 Jempol Kiri'); speakText(lang.value.startsWith('id')?'Jempol kiri':'Left Thumbs Up') })
  }
}

let lastNoseY=null,lastNoseX=null,waveBuffer=[]
function detectHigherGestures(results){
  const pose=results.poseLandmarks
  if(pose){
    const nose=pose[0]
    if(nose){
      if(lastNoseY!==null && Math.abs(nose.y-lastNoseY)>0.06)
        tryTrigger('nod',()=>{ detectedGesture.value='Angguk'; overlayTemporary('🙆 Angguk'); speakText(lang.value.startsWith('id')?'Ya':'Yes') })
      lastNoseY=nose.y
      if(lastNoseX!==null && Math.abs(nose.x-lastNoseX)>0.1)
        tryTrigger('shake',()=>{ detectedGesture.value='Geleng'; overlayTemporary('🙅 Geleng'); speakText(lang.value.startsWith('id')?'Tidak':'No') })
      lastNoseX=nose.x
    }
    const leftW=pose[15], rightW=pose[16]
    if((leftW && leftW.y<nose.y)||(rightW && rightW.y<nose.y))
      tryTrigger('raise',()=>{ detectedGesture.value='Angkat Tangan'; overlayTemporary('✋ Angkat Tangan'); speakText(lang.value.startsWith('id')?'Halo':'Hello') })
  }
  if(results.rightHandLandmarks && results.rightHandLandmarks[0]){
    const wx=results.rightHandLandmarks[0].x
    waveBuffer.push(wx)
    if(waveBuffer.length>12) waveBuffer.shift()
    const min=Math.min(...waveBuffer), max=Math.max(...waveBuffer)
    if(max-min>0.25) tryTrigger('wave',()=>{ detectedGesture.value='Lambaian'; overlayTemporary('👋 Lambaian'); speakText(lang.value.startsWith('id')?'Hai':'Hi'); waveBuffer=[] })
  } else waveBuffer=[]
}

let overlayTimer=null
function overlayTemporary(text,ms=1800){
  overlayText.value=text
  if(overlayTimer) clearTimeout(overlayTimer)
  overlayTimer=setTimeout(()=>{ overlayText.value='' }, ms)
}

// onResults MediaPipe
function onResults(results){
  debug.value.onResultsCalled=true
  debug.value.poseLandmarks=!!results.poseLandmarks
  debug.value.rightHandLandmarks=!!results.rightHandLandmarks
  debug.value.leftHandLandmarks=!!results.leftHandLandmarks
  debug.value.faceLandmarks=!!results.faceLandmarks

  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)
  if(results.image) ctx.value.drawImage(results.image,0,0,canvas.value.width,canvas.value.height)

  if(showSkeleton.value){
    const draw=window.drawConnectors
    if(results.poseLandmarks) draw(ctx.value, results.poseLandmarks, window.POSE_CONNECTIONS, {color:'white', lineWidth:2})
    if(results.rightHandLandmarks) draw(ctx.value, results.rightHandLandmarks, window.HAND_CONNECTIONS, {color:'red', lineWidth:2})
    if(results.leftHandLandmarks) draw(ctx.value, results.leftHandLandmarks, window.HAND_CONNECTIONS, {color:'green', lineWidth:2})
    if(results.faceLandmarks) draw(ctx.value, results.faceLandmarks, window.FACEMESH_TESSELATION, {color:'yellow', lineWidth:1})
  }

  rightFingerStatus.value=fingerStatusString(results.rightHandLandmarks)
  leftFingerStatus.value=fingerStatusString(results.leftHandLandmarks)

  detectFingerGestures(results.leftHandLandmarks, results.rightHandLandmarks)
  detectHigherGestures(results)
}

// Simulasi gesture manual
function simulate(name){
  detectedGesture.value=name
  overlayTemporary(`Simulasi: ${name}`)
  if(audioEnabled.value) speakText(`Simulasi gesture ${name}`)
}

// Lifecycle
onMounted(async ()=>{
  if(process.client){
    await enumerateVideoDevices()
    await startCamera(selectedDeviceId.value)
    try{
      holisticInst = new window.Holistic.Holistic({ locateFile: f=>`https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${f}` })
      holisticInst.setOptions({
        modelComplexity: 1,
        smoothLandmarks: true,
        enableSegmentation: false,
        refineFaceLandmarks: true,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
      })
      holisticInst.onResults(onResults)
      cameraInst = new window.Camera(video.value,{
        onFrame: async()=> await holisticInst.send({image: video.value}),
        width:480, height:360
      })
      cameraInst.start()
    }catch(e){ debug.value.lastError=e.message||String(e) }
  }
})
onBeforeUnmount(()=>{ stopCamera() })

// Additional
function toggleSkeleton(){ showSkeleton.value=!showSkeleton.value }
function toggleAudio(){ audioEnabled.value=!audioEnabled.value }
function takeScreenshot(){
  const link=document.createElement('a')
  link.href=canvas.value.toDataURL('image/png')
  link.download='screenshot.png'
  link.click()
}

// Voices filtered
const voicesFiltered = computed(()=>voices.value.filter(v=>v.lang && v.lang.startsWith(lang.value)))

</script>

<style scoped>
.gesture-root { display:flex; flex-direction:column; align-items:center; }
.top-row { display:flex; flex-direction:row; flex-wrap:wrap; gap:12px; }
.video-wrap { position:relative; width:480px; max-width:90vw; height:360px; }
.video { width:100%; height:100%; transform:scaleX(-1); border-radius:8px; background:#000; }
.canvas { position:absolute; left:0; top:0; width:100%; height:100%; pointer-events:none; }
.overlay-text { position:absolute; top:12px; left:50%; transform:translateX(-50%); color:#fff; font-size:22px; font-weight:bold; text-shadow:0 0 6px #000; }
.panel { min-width:250px; max-width:350px; display:flex; flex-direction:column; gap:8px; background:#222; color:#fff; padding:12px; border-radius:8px; font-size:14px; }
.panel h3 { margin:0; margin-bottom:8px; text-align:center; }
.control-row { display:flex; flex-direction:row; gap:6px; align-items:center; flex-wrap:wrap; }
.sim-buttons button { margin:2px; }
.status { margin-top:6px; }
.debug { font-size:11px; color:#ccc; margin-top:4px; }
</style>
