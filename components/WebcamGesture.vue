<template>
  <div class="gesture-root">
    <video ref="video" class="video" autoplay playsinline muted></video>
    <canvas ref="canvas" class="canvas"></canvas>
    <div class="overlay-text" v-if="overlayText">{{ overlayText }}</div>

    <div class="panel" :class="{ open: panelOpen }">
      <button class="panel-toggle" @click="panelOpen=!panelOpen">{{ panelOpen ? '✖' : '⚙️' }}</button>

      <div v-if="panelOpen">
        <h3>Kontrol</h3>
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
          <button @click="toggleAudio">{{ audioEnabled?'🔇':'🔊' }}</button>
        </div>

        <div class="control-row">
          <button @click="toggleSkeleton">{{ showSkeleton?'Sembunyikan':'Tampilkan' }} Kerangka</button>
          <button @click="takeScreenshot">📸 Screenshot</button>
        </div>

        <hr />

        <div class="control-row">
          <label>Simulasi:</label>
          <div class="sim-buttons">
            <button @click="simulate('thumbs')">👍</button>
            <button @click="simulate('point')">☝️</button>
            <button @click="simulate('wave')">👋</button>
            <button @click="simulate('nod')">🙆</button>
            <button @click="simulate('shake')">🙅</button>
          </div>
        </div>
      </div>
    </div>

    <div class="status-bar">
      <span>{{ detectedGesture || '-' }}</span>
      <span>R: {{ rightFingerStatus || '-' }}</span>
      <span>L: {{ leftFingerStatus || '-' }}</span>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'

// Refs
const video = ref(null)
const canvas = ref(null)
const ctx = ref(null)

const detectedGesture = ref('')
const overlayText = ref('')
const rightFingerStatus = ref('')
const leftFingerStatus = ref('')

const showSkeleton = ref(true)
const audioEnabled = ref(true)
const panelOpen = ref(false)

let holistic=null, cameraInst=null, localStream=null, cooldown={}
const COOLDOWN_MS=300

// Devices
const videoDevices=ref([]), selectedDeviceId=ref(null)
async function enumerateVideoDevices(){
  const devices=await navigator.mediaDevices.enumerateDevices()
  videoDevices.value=devices.filter(d=>d.kind==='videoinput')
  if(!selectedDeviceId.value && videoDevices.value.length) selectedDeviceId.value=videoDevices.value[0].deviceId
}
async function startCamera(deviceId){
  stopCamera()
  try{
    const stream=await navigator.mediaDevices.getUserMedia({ video: { deviceId: deviceId?{ exact: deviceId }:{ facingMode:'user' } } })
    localStream=stream
    video.value.srcObject=stream
    await video.value.play()
    adaptCanvas()
  }catch(e){ console.warn(e) }
}
function stopCamera(){
  if(cameraInst && cameraInst.stop) cameraInst.stop()
  if(localStream) localStream.getTracks().forEach(t=>t.stop())
  cameraInst=null
  localStream=null
}
async function switchCamera(){ await startCamera(selectedDeviceId.value) }

// Canvas
function adaptCanvas(){
  if(!video.value) return
  canvas.value.width=video.value.videoWidth || window.innerWidth
  canvas.value.height=video.value.videoHeight || window.innerHeight
  ctx.value=canvas.value.getContext('2d')
}

// TTS
const lang=ref('id-ID'), voices=ref([]), selectedVoiceURI=ref(null)
function loadVoices(){ voices.value=window.speechSynthesis.getVoices() }
function updateVoiceList(){ loadVoices(); const match=voices.value.find(v=>v.lang.startsWith(lang.value)); if(match) selectedVoiceURI.value=match.voiceURI }
function getVoiceByURI(uri){ return voices.value.find(v=>v.voiceURI===uri)||null }
function speakText(text){ if(!audioEnabled.value) return; const u=new SpeechSynthesisUtterance(text); u.lang=lang.value; const v=getVoiceByURI(selectedVoiceURI.value); if(v) u.voice=v; window.speechSynthesis.cancel(); window.speechSynthesis.speak(u) }
function testVoice(){ speakText(lang.value.startsWith('id')?'Halo, ini tes suara':'Hello, this is a voice test') }

// Gesture helpers
const TIP={thumb:4,index:8,middle:12,ring:16,pinky:20}, PIP={thumb:3,index:6,middle:10,ring:14,pinky:18}, MCP={thumb:2,index:5,middle:9,ring:13,pinky:17}
function isFingerExtended(hand,f){ if(!hand) return false; const tip=hand[TIP[f]],pip=hand[PIP[f]],mcp=hand[MCP[f]]; if(!tip||!pip||!mcp) return false; if(f!=='thumb') return tip.y<pip.y-0.01; return Math.abs(tip.x-mcp.x)>0.04 } 
function fingerStatusString(hand){ return !hand?'-':['thumb','index','middle','ring','pinky'].map(f=>isFingerExtended(hand,f)?f[0].toUpperCase()+f.slice(1):`-${f[0]}`).join(', ') }
function tryTrigger(name,fn){ const now=Date.now(); if(!cooldown[name]||now-cooldown[name]>COOLDOWN_MS){ cooldown[name]=now; fn() } }

// === INIT ===
onMounted(async()=>{
  await enumerateVideoDevices()
  await startCamera(selectedDeviceId.value)
  window.addEventListener('resize',adaptCanvas)

  // ✅ FIX: cara benar buat Holistic instance
  holistic = new Holistic.Holistic({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
  })

  holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
  })

  holistic.onResults(onResults)

  // Jalankan kamera → feed ke holistic
  cameraInst = new Camera(video.value, {
    onFrame: async () => {
      await holistic.send({ image: video.value })
    },
    width: 640,
    height: 480
  })
  cameraInst.start()
})

onBeforeUnmount(()=>{
  stopCamera()
  window.removeEventListener('resize',adaptCanvas)
})
</script>

<style scoped>
.gesture-root{ position:relative; width:100%; height:100vh; overflow:hidden; background:#000; }
.video, .canvas{ position:absolute; top:0; left:0; width:100%; height:100%; object-fit:cover; }
.overlay-text{ position:absolute; top:10%; left:50%; transform:translateX(-50%); color:#fff; background:rgba(0,0,0,0.4); padding:6px 10px; border-radius:10px; font-size:18px; font-weight:600; text-align:center; z-index:10 }
.panel{ position:absolute; top:10px; right:10px; width:300px; max-width:80%; background:#fff; border-radius:12px; box-shadow:0 4px 16px rgba(0,0,0,0.2); overflow:hidden; transition:all 0.3s; z-index:15 }
.panel-toggle{ position:absolute; top:6px; right:6px; background:#0066ff; color:#fff; border:none; border-radius:50%; width:36px; height:36px; font-size:18px; cursor:pointer; z-index:20 }
.control-row{ display:flex; flex-wrap:wrap; gap:6px; padding:6px; align-items:center }
.control-row select, .control-row button {
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 14px;
  border: 1px solid #ccc;
}
.sim-buttons button{ margin:2px; background:#10b981; color:#fff; padding:6px 8px; border-radius:6px; border:none; cursor:pointer }
.status-bar{ position:absolute; bottom:10px; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.5); color:#fff; padding:4px 8px; border-radius:8px; font-size:14px; display:flex; gap:12px; z-index:10 }
</style>
