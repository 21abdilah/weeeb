<template>
  <div class="gesture-root">
    <!-- Toggle Button -->
    <button class="toggle-btn" @click="panelOpen = !panelOpen">
      ⚙️
    </button>

    <div class="top-row">
      <!-- Video + Canvas -->
      <div class="video-wrap">
        <video ref="videoEl" class="video" autoplay playsinline muted></video>
        <canvas ref="canvasEl" class="canvas"></canvas>
        <div class="overlay" v-if="overlayText">{{ overlayText }}</div>
      </div>

      <!-- Panel Control -->
      <transition name="slide">
        <div class="panel" v-if="panelOpen">
          <h3>⚙️ BEBENAH</h3>

          <div class="control-row">
            <label>Kamera:</label>
            <select v-model="selectedDeviceId" @change="switchCamera">
              <option v-for="d in videoDevices" :key="d.deviceId" :value="d.deviceId">
                {{ d.label || 'Camera ' + (videoDevices.indexOf(d)+1) }}
              </option>
            </select>
          </div>

          <div class="control-row">
            <label>Sora:</label>
            <button @click="toggleAudio">{{ audioEnabled ? '🔊 Hirup' : '🔇 Paeh' }}</button>
          </div>

          <div class="control-row">
            <button @click="simulate('thumbs')">👍 Jempol</button>
            <button @click="simulate('point')">☝️ Tunjuk</button>
            <button @click="simulate('wave')">👋 Dadah</button>
          </div>

          <div class="status">
            <div><strong>Gestur:</strong> {{ detectedGesture || '-' }}</div>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

// refs
const videoEl = ref(null)
const canvasEl = ref(null)
const overlayText = ref('')
const detectedGesture = ref('')
const videoDevices = ref([])
const selectedDeviceId = ref(null)
const audioEnabled = ref(true)
const panelOpen = ref(true)

let ctx, holistic, camera, localStream

/* ===== Kamera ===== */
async function enumerateVideoDevices(){
  const devices = await navigator.mediaDevices.enumerateDevices()
  videoDevices.value = devices.filter(d => d.kind === 'videoinput')
  if (!selectedDeviceId.value && videoDevices.value.length) {
    selectedDeviceId.value = videoDevices.value[0].deviceId
  }
}
async function startCamera(deviceId){
  stopCamera()
  localStream = await navigator.mediaDevices.getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId }, width:640, height:480 }
                     : { facingMode: 'user', width:640, height:480 }
  })
  videoEl.value.srcObject = localStream
  await videoEl.value.play()
  canvasEl.value.width = videoEl.value.videoWidth
  canvasEl.value.height = videoEl.value.videoHeight
}
function stopCamera(){ if(localStream) localStream.getTracks().forEach(t => t.stop()) }
async function switchCamera(){ await startCamera(selectedDeviceId.value) }

/* ===== Overlay ===== */
function showOverlay(text, ms=1500){
  overlayText.value = text
  setTimeout(() => overlayText.value = '', ms)
}

/* ===== Simulasi ===== */
function simulate(name){
  if(name==='thumbs'){ detectedGesture.value='Jempol'; showOverlay('👍 Jempol') }
  else if(name==='point'){ detectedGesture.value='Tunjuk'; showOverlay('☝️ Tunjuk') }
  else if(name==='wave'){ detectedGesture.value='Dadah'; showOverlay('👋 Dadah') }
}

/* ===== Audio ===== */
function toggleAudio(){ audioEnabled.value = !audioEnabled.value }

/* ===== Init ===== */
onMounted(async ()=>{
  ctx = canvasEl.value.getContext('2d')
  await enumerateVideoDevices()
  await startCamera(selectedDeviceId.value)

  const { Holistic, POSE_CONNECTIONS, HAND_CONNECTIONS, FACEMESH_TESSELATION } = await import('@mediapipe/holistic')
  const { Camera } = await import('@mediapipe/camera_utils')
  const { drawConnectors, drawLandmarks } = await import('@mediapipe/drawing_utils')

  holistic = new Holistic({
    locateFile: file => `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
  })
  holistic.setOptions({ modelComplexity:1, smoothLandmarks:true, minDetectionConfidence:0.5, minTrackingConfidence:0.5 })

  holistic.onResults((results)=>{
    ctx.clearRect(0,0,canvasEl.value.width,canvasEl.value.height)
    ctx.drawImage(results.image,0,0,canvasEl.value.width,canvasEl.value.height)

    if(results.poseLandmarks){
      drawConnectors(ctx, results.poseLandmarks, POSE_CONNECTIONS, { color:'#00FF00', lineWidth:2 })
      drawLandmarks(ctx, results.poseLandmarks, { color:'#FF0000', lineWidth:1 })
    }
    if(results.leftHandLandmarks){
      drawConnectors(ctx, results.leftHandLandmarks, HAND_CONNECTIONS, { color:'#FF00FF', lineWidth:2 })
      drawLandmarks(ctx, results.leftHandLandmarks, { color:'#00FFFF', lineWidth:1 })
    }
    if(results.rightHandLandmarks){
      drawConnectors(ctx, results.rightHandLandmarks, HAND_CONNECTIONS, { color:'#FFFF00', lineWidth:2 })
      drawLandmarks(ctx, results.rightHandLandmarks, { color:'#FFFFFF', lineWidth:1 })
    }
    if(results.faceLandmarks){
      drawConnectors(ctx, results.faceLandmarks, FACEMESH_TESSELATION, { color:'#8888FF', lineWidth:0.5 })
      drawLandmarks(ctx, results.faceLandmarks, { color:'#00FFEA', lineWidth:0.5 })
    }
  })

  camera = new Camera(videoEl.value, {
    onFrame: async ()=>{ await holistic.send({ image: videoEl.value }) },
    width:640, height:480
  })
  camera.start()
})
</script>

<style scoped>
.gesture-root{ padding:12px; font-family:Inter,Arial,sans-serif; max-width:100%; box-sizing:border-box; }
.top-row{ display:flex; flex-direction:column-reverse; gap:12px; }
@media(min-width:768px){ .top-row{ flex-direction:row; align-items:flex-start; } }
.video-wrap{ position:relative; width:100%; max-width:640px; margin:0 auto; }
.video{ width:100%; border-radius:12px; background:#000; }
.canvas{ position:absolute; top:0; left:0; width:100%; height:100%; border-radius:12px; pointer-events:none; }
.overlay{ position:absolute; top:10%; left:50%; transform:translateX(-50%); background:rgba(0,0,0,0.6); color:#fff; padding:6px 12px; border-radius:8px; font-weight:bold; }
.panel{ width:100%; max-width:300px; padding:12px; background:#fff; border-radius:10px; box-shadow:0 4px 16px rgba(0,0,0,0.1); }
.control-row{ display:flex; flex-wrap:wrap; gap:8px; margin:6px 0; align-items:center; }
.control-row label{ min-width:80px; font-size:14px }
.control-row select, .control-row button{ padding:6px 10px; border-radius:8px; font-size:14px; border:1px solid #ccc; cursor:pointer; }
.status{ margin-top:6px; font-size:14px; }
.toggle-btn{ position:absolute; top:10px; right:10px; z-index:10; background:#0066ff; color:#fff; border:none; border-radius:8px; padding:6px 10px; cursor:pointer; }
.slide-enter-active,.slide-leave-active{ transition:all 0.3s ease; }
.slide-enter-from,.slide-leave-to{ opacity:0; transform:translateX(20px); }
</style>
