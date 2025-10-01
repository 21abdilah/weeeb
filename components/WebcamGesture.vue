<template>
  <div class="gesture-container">
    <video ref="video" class="video" autoplay playsinline></video>
    <canvas ref="canvas" class="canvas"></canvas>

    <!-- Panel -->
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const video = ref(null)
const canvas = ref(null)
const ctx = ref(null)

const showSkeleton = ref(true)
const audioEnabled = ref(true)
const detectedGesture = ref('')
const rightFingerStatus = ref('')
const leftFingerStatus = ref('')

let cooldown = {} // map gesture->timestamp
const COOLDOWN_MS = 1400 // 1.4s between same gesture announcements

function toggleSkeleton(){ showSkeleton.value = !showSkeleton.value }
function toggleAudio(){ audioEnabled.value = !audioEnabled.value }

function speak(text){
  if(!audioEnabled.value) return
  if(window.speechSynthesis) {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(text)
    u.lang = 'id-ID' // ubah kalau perlu
    window.speechSynthesis.speak(u)
  }
}

// === finger helpers (mediapipe hand landmark indices) ===
// indices: thumb:4 tip, 3 ip, 2 mcp? (mediapipe hand indexing used below)
const TIP = { thumb:4, index:8, middle:12, ring:16, pinky:20 }
const PIP = { thumb:3, index:6, middle:10, ring:14, pinky:18 }
const MCP = { thumb:2, index:5, middle:9, ring:13, pinky:17 }

// return whether finger is extended (simple vertical test)
// handLandmarks: array of {x,y,z,...}
// orientation: assume y increases downward (normalized coords)
function isFingerExtended(handLandmarks, finger){
  if(!handLandmarks) return false
  const tip = handLandmarks[TIP[finger]]
  const pip = handLandmarks[PIP[finger]]
  const mcp = handLandmarks[MCP[finger]]
  if(!tip || !pip || !mcp) return false

  // For index/middle/ring/pinky: tip.y < pip.y => extended (finger up)
  if(finger !== 'thumb'){
    return tip.y < pip.y - 0.01 // small margin
  }

  // Thumb heuristic: check horizontal separation (thumb often points sideways)
  // If thumb tip is significantly away from palm (mcp) in x direction, consider extended.
  const dx = Math.abs(tip.x - mcp.x)
  const dy = Math.abs(tip.y - mcp.y)
  return dx > 0.04 && dx > dy*0.6
}

// human-readable status string
function fingerStatusString(handLandmarks){
  if(!handLandmarks) return '-'
  const fingers=['thumb','index','middle','ring','pinky']
  const statuses = fingers.map(f => (isFingerExtended(handLandmarks,f) ? f[0].toUpperCase()+f.slice(1) : `-${f[0]}`))
  return statuses.join(', ')
}

// cooldown guard
function tryTrigger(name, fn){
  const now = Date.now()
  if(!cooldown[name] || now - cooldown[name] > COOLDOWN_MS){
    cooldown[name] = now
    fn()
  }
}

// Detect finger gestures: point (index extended only), thumbs-up
function detectFingerGestures(leftHand, rightHand){
  // Right hand gestures (prefer right for voice)
  if(rightHand){
    const idx = isFingerExtended(rightHand,'index')
    const mid = isFingerExtended(rightHand,'middle')
    const ring = isFingerExtended(rightHand,'ring')
    const pinky = isFingerExtended(rightHand,'pinky')
    const thumb = isFingerExtended(rightHand,'thumb')

    // Pointing: index extended, others (middle,ring,pinky) not extended
    if(idx && !mid && !ring && !pinky){
      tryTrigger('right_point', () => {
        detectedGesture.value = 'Right: Pointing (Index)'
        speak('Menunjuk dengan jari telunjuk')
      })
      return
    }

    // Thumbs up: thumb extended and most other fingers folded
    const otherExtended = mid || ring || pinky
    if(thumb && !otherExtended){
      tryTrigger('right_thumbs', () => {
        detectedGesture.value = 'Right: Thumbs Up'
        speak('Jempol ke atas')
      })
      return
    }
  }

  // Left hand symmetrical
  if(leftHand){
    const idx = isFingerExtended(leftHand,'index')
    const mid = isFingerExtended(leftHand,'middle')
    const ring = isFingerExtended(leftHand,'ring')
    const pinky = isFingerExtended(leftHand,'pinky')
    const thumb = isFingerExtended(leftHand,'thumb')

    if(idx && !mid && !ring && !pinky){
      tryTrigger('left_point', () => {
        detectedGesture.value = 'Left: Pointing (Index)'
        speak('Menunjuk dengan jari telunjuk (kiri)')
      })
      return
    }

    const otherExtended = mid || ring || pinky
    if(thumb && !otherExtended){
      tryTrigger('left_thumbs', () => {
        detectedGesture.value = 'Left: Thumbs Up'
        speak('Jempol ke atas (kiri)')
      })
      return
    }
  }
}

// Higher-level gestures (raise hand, wave, nod) reuse earlier logic
let lastNoseY = null, lastNoseX = null, waveBuffer = []
function detectHigherGestures(results){
  const pose = results.poseLandmarks
  const rightHand = results.rightHandLandmarks
  const leftHand = results.leftHandLandmarks
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

    // Raise hand: wrist above nose (y smaller)
    const leftW = pose[15], rightW = pose[16]
    if(leftW && rightW && nose){
      if((leftW.y < nose.y) || (rightW.y < nose.y)){
        tryTrigger('raise', ()=>{ detectedGesture.value = 'Raise Hand'; speak('Halo!') })
      }
    }
  }

  // Wave detection using x-oscillation of right wrist
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

// draw & helpers
function onResults(results){
  if(!ctx.value) return
  ctx.value.clearRect(0,0,canvas.value.width,canvas.value.height)
  // draw background camera frame
  if(results.image) ctx.value.drawImage(results.image, 0, 0, canvas.value.width, canvas.value.height)

  if(showSkeleton.value){
    // use drawing_utils from CDN (window.drawConnectors etc.)
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

  // update finger status strings
  rightFingerStatus.value = results.rightHandLandmarks ? fingerStatusString(results.rightHandLandmarks) : '-'
  leftFingerStatus.value = results.leftHandLandmarks ? fingerStatusString(results.leftHandLandmarks) : '-'

  // run detections
  detectFingerGestures(results.leftHandLandmarks, results.rightHandLandmarks)
  detectHigherGestures(results)
}

// adapt canvas to video size
function adaptCanvas(){
  const w = video.value.videoWidth || 640
  const h = video.value.videoHeight || 480
  canvas.value.width = w
  canvas.value.height = h
}

// onMounted: setup camera & mediapipe (CDN)
onMounted(async ()=>{
  ctx.value = canvas.value.getContext('2d')
  // request camera
  const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } })
  video.value.srcObject = stream
  await video.value.play()
  adaptCanvas()

  // wait until the global Holistic & Camera objects are available (loaded via CDN in app head)
  if(!window.Holistic || !window.Camera){
    // If CDN not loaded, inject script (fallback)
    const s = document.createElement('script')
    s.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/holistic/holistic.js'
    document.head.appendChild(s)
    // camera_utils and drawing_utils usually bundled; ensure camera utils
    const s2 = document.createElement('script')
    s2.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'
    document.head.appendChild(s2)
    const s3 = document.createElement('script')
    s3.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js'
    document.head.appendChild(s3)
    // wait a short while for scripts to load
    await new Promise(res => setTimeout(res, 700))
  }

  // create Holistic from global
  const holistic = new window.Holistic.Holistic({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`
  })
  holistic.setOptions({
    modelComplexity: 0, // optimized for mobile
    smoothLandmarks: true,
    minDetectionConfidence: 0.45,
    minTrackingConfidence: 0.45
  })
  holistic.onResults(onResults)

  // Camera (camera_utils) will call holistic on each frame
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
.video{ display:none }
.canvas{ width:100%; border-radius:12px; box-shadow:0 6px 20px rgba(0,0,0,0.2) }
.panel{ margin-top:10px; padding:10px; background:#fff; border-radius:8px; text-align:center; box-shadow:0 2px 8px rgba(0,0,0,0.08) }
.panel button{ margin:6px; padding:8px 12px; border-radius:6px; border:none; background:#0066ff; color:#fff; cursor:pointer }
.panel button:hover{ opacity:0.9 }
</style>
