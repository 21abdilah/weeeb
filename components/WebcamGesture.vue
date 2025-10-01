<template>
  <div class="gesture-container">
    <!-- Kamera tampil -->
    <video ref="video" class="video" autoplay playsinline></video>
    <!-- Canvas overlay -->
    <canvas ref="canvas" class="canvas"></canvas>

    <!-- Panel Kontrol & Info -->
    <div class="panel">
      <h3>⚙️ Controls</h3>
      <button @click="toggleSkeleton">{{ showSkeleton ? 'Hide Skeleton' : 'Show Skeleton' }}</button>
      <button @click="toggleAudio">{{ audioEnabled ? '🔊 Audio On' : '🔇 Audio Off' }}</button>
      <div style="margin-top:8px">
        <strong>Detected:</strong> <span>{{ detectedGesture || '-' }}</span>
      </div>
      <div style="margin-top:8px">
        <strong>Finger status (R):</strong>
        <div style="font-size:12px">{{ rightFingerStatus }}</div>
      </div>
      <div style="margin-top:6px">
        <strong>Finger status (L):</strong>
        <div style="font-size:12px">{{ leftFingerStatus }}</div>
      </div>
    </div>

    <!-- DEBUG PANEL -->
    <div class="panel debug-panel">
      <strong>Debug Info</strong>
      <div style="font-size:11px; text-align:left;">
        onResults called: <b>{{ debug.onResultsCalled ? 'Ya' : 'Tidak' }}</b><br>
        poseLandmarks: <b>{{ debug.poseLandmarks ? 'Ada' : 'Tidak' }}</b><br>
        rightHandLandmarks: <b>{{ debug.rightHandLandmarks ? 'Ada' : 'Tidak' }}</b><br>
        leftHandLandmarks: <b>{{ debug.leftHandLandmarks ? 'Ada' : 'Tidak' }}</b><br>
        <span v-if="debug.lastError" style="color:red;">Error: {{ debug.lastError }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// Data refs
const video = ref(null)
const canvas = ref(null)
const ctx = ref(null)

const showSkeleton = ref(true)
const audioEnabled = ref(true)
const detectedGesture = ref('')
const rightFingerStatus = ref('')
const leftFingerStatus = ref('')

// Debug state
const debug = ref({
  onResultsCalled: false,
  poseLandmarks: false,
  rightHandLandmarks: false,
  leftHandLandmarks: false,
  lastError: ''
})

let cooldown = {}
const COOLDOWN_MS = 900 // lebih responsif

function toggleSkeleton(){ showSkeleton.value = !showSkeleton.value }
function toggleAudio(){ audioEnabled.value = !audioEnabled.value }

function speak(text){
  if(!audioEnabled.value) return
  if(window.speechSynthesis) {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'id-ID'
    window.speechSynthesis.speak(u)
  }
}

// === Finger helpers ===
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
  return dx > 0.04 && dx > dy*0.6
}

function fingerStatusString(handLandmarks){
  if(!handLandmarks) return '-'
  const fingers=['thumb','index','middle','ring','pinky']
  const statuses = fingers.map(f => (isFingerExtended(handLandmarks,f) ? f[0].toUpperCase()+f.slice(1) : `-${f[0]}`))
  return statuses.join(', ')
}

function tryTrigger(name, fn){
  const now = Date.now()
  if(!cooldown[name] || now - cooldown[name] > COOLDOWN_MS){
    cooldown[name] = now
    fn()
  }
}

// Deteksi gesture sederhana
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
        detectedGesture.value = 'Right: Pointing (Index)'
        speak('Menunjuk dengan jari telunjuk')
      })
      return
    }
    const otherExtended = mid || ring || pinky
    if(thumb && !otherExtended){
      tryTrigger('right_thumbs', () => {
        detectedGesture.value = 'Right: Thumbs Up'
        speak('Jempol ke atas')
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
        detectedGesture.value = 'Left: Pointing (Index)'
        speak('Menunjuk dengan jari telunjuk kiri')
      })
      return
    }
    const otherExtended = mid || ring || pinky
    if(thumb && !otherExtended){
      tryTrigger('left_thumbs', () => {
        detectedGesture.value = 'Left: Thumbs Up'
        speak('Jempol ke atas kiri')
      })
      return
    }
  }
}

// Deteksi gestur kepala & lambaikan tangan
let lastNoseY = null, lastNoseX = null, waveBuffer = []
function detectHigherGestures(results){
  const pose = results.poseLandmarks
  if(pose){
    const nose = pose[0]
    if(nose){
      if(lastNoseY !== null && Math.abs(nose.y - lastNoseY) > 0.06){
        tryTrigger('nod', ()=>{ detectedGesture.value = 'Nod'; speak('Ya') })
      }
      lastNoseY = nose.y
      if(lastNoseX !== null && Math.abs(nose.x - lastNoseX) > 0.10){
        tryTrigger('shake', ()=>{ detectedGesture.value = 'Shake Head'; speak('Tidak') })
      }
      lastNoseX = nose.x
    }
    // Raise hand: wrist above nose
    const leftW = pose[15], rightW = pose[16]
    if(leftW && rightW && nose){
      if((leftW.y < nose.y) || (rightW.y < nose.y)){
        tryTrigger('raise', ()=>{ detectedGesture.value = 'Raise Hand'; speak('Halo!') })
      }
    }
  }
  if(results.rightHandLandmarks && results.rightHandLandmarks[0]){
    const wx = results.rightHandLandmarks[0].x
    waveBuffer.push(wx)
    if(waveBuffer.length > 12) waveBuffer.shift()
    const min = Math.min(...waveBuffer), max = Math.max(...waveBuffer)
    if(max - min > 0.25){
      tryTrigger('wave', ()=>{ detectedGesture.value = 'Wave'; speak('Hai!'); waveBuffer = [] })
    }
  } else {
    waveBuffer = []
  }
}

// Gambar hasil deteksi
function onResults(results){
  debug.value.onResultsCalled = true
  debug.value.poseLandmarks = !!results.poseLandmarks
  debug.value.rightHandLandmarks = !!results.rightHandLandmarks
  debug.value.leftHandLandmarks = !!results.leftHandLandmarks

  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)
  if(results.image) ctx.value.drawImage(results.image, 0, 0, canvas.value.width, canvas.value.height)

  if(showSkeleton.value){
    if(window.drawConnectors && window.drawLandmarks){
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
  }

  rightFingerStatus.value = results.rightHandLandmarks ? fingerStatusString(results.rightHandLandmarks) : '-'
  leftFingerStatus.value = results.leftHandLandmarks ? fingerStatusString(results.leftHandLandmarks) : '-'

  detectFingerGestures(results.leftHandLandmarks, results.rightHandLandmarks)
  detectHigherGestures(results)
}

// Sesuaikan ukuran canvas dengan video
function adaptCanvas(){
  const w = video.value.videoWidth || 640
  const h = video.value.videoHeight || 480
  canvas.value.width = w
  canvas.value.height = h
}

onMounted(async ()=>{
  ctx.value = canvas.value.getContext('2d')
  // Minta akses kamera
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
    video.value.srcObject = stream
    await video.value.play()
    adaptCanvas()
  } catch (e) {
    debug.value.lastError = e.message || String(e)
    detectedGesture.value = 'Tidak bisa akses kamera! Izinkan akses kamera browser.'
    return
  }
  // Pastikan Holistic, Camera, drawing_utils sudah tersedia
  function waitForGlobals() {
    return new Promise(resolve => {
      function check() {
        if (window.Holistic && window.Camera && window.drawConnectors) resolve();
        else setTimeout(check, 100);
      }
      check();
    });
  }
  // Inject CDN script jika belum ada
  if(!window.Holistic || !window.Camera || !window.drawConnectors){
    const scripts = [
      'https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js',
      'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js'
    ];
    for(const src of scripts){
      if(!document.querySelector(`script[src="${src}"]`)){
        const s = document.createElement('script')
        s.src = src
        document.head.appendChild(s)
      }
    }
    await waitForGlobals()
  }
  // Buat Holistic
  const holistic = new window.Holistic.Holistic({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
  })
  holistic.setOptions({
    modelComplexity: 0,
    smoothLandmarks: true,
    minDetectionConfidence: 0.45,
    minTrackingConfidence: 0.45
  })
  holistic.onResults(onResults)
  // Buat Camera (dari camera_utils)
  const cameraInst = new window.Camera(video.value, {
    onFrame: async () => {
      await holistic.send({ image: video.value })
    },
    width: 640,
    height: 480
  })
  cameraInst.start()
})
</script>

<style scoped>
.gesture-container{ position:relative; max-width:720px; margin:20px auto }
.video{ display:block; width:100%; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,0.2) }
.canvas{ position:absolute; top:0; left:0; width:100%; height:100%; border-radius:12px; pointer-events:none }
.panel{ margin-top:10px; padding:10px; background:#fff; border-radius:8px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.08) }
.panel button{ margin:6px; padding:8px 12px; border-radius:6px; border:none; background:#0066ff; color:#fff; cursor:pointer }
.panel button:hover{ opacity:0.9 }
.debug-panel{ background:#f7fafc; border:1px solid #e2e8f0; margin-top:8px; }
</style>