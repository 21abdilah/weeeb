<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue"
import { Play, Square, Bug, Mic } from "lucide-vue-next" // pakai lucide-react versi vue

const videoRef = ref(null)
const canvasRef = ref(null)
const running = ref(false)
const lang = ref("id-ID")
const drawLandmarks = ref(true)
const debugMode = ref(true)
const lastGesture = ref("—")

// ✅ Mapping default gesture -> audio/text
const gestureMap = ref({
  wave: { text: "Halo!", lang: "id-ID" },
  thumbsUp: { text: "Bagus sekali!", lang: "id-ID" },
  leftHandUp: { text: "Saya di sini!", lang: "id-ID" }
})

let holistic, camera

// ✅ Debug helper
function debugError(context, error) {
  console.error(`[${context}]`, error)
  const panel = document.getElementById("debug-panel")
  if (panel && debugMode.value) {
    const el = document.createElement("div")
    el.className = "error"
    el.innerHTML = `<strong>${context}:</strong> ${error.message || error}`
    panel.appendChild(el)
    panel.scrollTop = panel.scrollHeight
  }
}

// ✅ Text-to-Speech
function speak(text, language = "id-ID") {
  try {
    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = language
    window.speechSynthesis.speak(utter)
  } catch (err) {
    debugError("Speech", err)
  }
}

// ✅ Gesture Detector (contoh sederhana)
function detectGesture(results) {
  if (results.rightHandLandmarks) return "wave"
  if (results.leftHandLandmarks) return "leftHandUp"
  if (results.poseLandmarks) {
    const rightThumb = results.poseLandmarks[4]
    if (rightThumb && rightThumb.y < 0.3) return "thumbsUp"
  }
  return null
}

// ✅ Init Holistic
function initHolistic() {
  holistic = new window.Holistic.Holistic({
    locateFile: (file) =>
      `https://cdn.jsdelivr.net/npm/@mediapipe/holistic/${file}`,
  })
  holistic.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    refineFaceLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  })
  holistic.onResults(onResults)
}

// ✅ Handle results
function onResults(results) {
  const canvas = canvasRef.value
  const ctx = canvas.getContext("2d")
  ctx.save()
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height)

  if (drawLandmarks.value) {
    const mp_drawing = window.drawConnectors
    const mp_landmarks = window.drawLandmarks

    if (results.poseLandmarks) {
      mp_drawing(ctx, results.poseLandmarks, window.POSE_CONNECTIONS, { color: "#00FF00", lineWidth: 2 })
      mp_landmarks(ctx, results.poseLandmarks, { color: "#FF0000", radius: 3 })
    }

    if (results.leftHandLandmarks) {
      mp_drawing(ctx, results.leftHandLandmarks, window.HAND_CONNECTIONS, { color: "#FFCC00", lineWidth: 2 })
      mp_landmarks(ctx, results.leftHandLandmarks, { color: "#FFFFFF", radius: 3 })
    }
    if (results.rightHandLandmarks) {
      mp_drawing(ctx, results.rightHandLandmarks, window.HAND_CONNECTIONS, { color: "#FFCC00", lineWidth: 2 })
      mp_landmarks(ctx, results.rightHandLandmarks, { color: "#FFFFFF", radius: 3 })
    }

    if (results.faceLandmarks) {
      mp_landmarks(ctx, results.faceLandmarks, { color: "#00FFFF", radius: 1 })
    }
  }

  // ✅ Gesture recognition + Audio
  const detected = detectGesture(results)
  if (detected && gestureMap.value[detected]) {
    if (lastGesture.value !== detected) {
      lastGesture.value = detected
      speak(gestureMap.value[detected].text, gestureMap.value[detected].lang)
    }
  }

  ctx.restore()
}

// ✅ Camera controls
async function startCamera() {
  const video = videoRef.value
  camera = new window.Camera(video, {
    onFrame: async () => {
      await holistic.send({ image: video })
    },
    width: 640,
    height: 480,
  })
  camera.start()
  running.value = true
}
function stopCamera() {
  if (camera) {
    camera.stop()
    running.value = false
  }
}

onMounted(() => initHolistic())
onBeforeUnmount(() => stopCamera())
</script>

<template>
  <div class="flex flex-col items-center gap-6 w-full max-w-3xl mx-auto">
    
    <!-- Live Camera Card -->
    <div class="bg-gray-900 rounded-2xl shadow-xl p-4 relative w-full">
      <h2 class="text-lg font-semibold text-white mb-2">Live Camera</h2>
      <div class="relative w-full aspect-video rounded-lg overflow-hidden">
        <video ref="videoRef" autoplay playsinline muted class="absolute w-full h-full object-cover"></video>
        <canvas ref="canvasRef" width="640" height="480" class="absolute w-full h-full"></canvas>
      </div>
      <div class="absolute top-2 right-2 bg-black/60 text-white px-3 py-1 rounded-lg text-sm">
        Gesture: <span class="font-bold">{{ lastGesture }}</span>
      </div>
    </div>

    <!-- Controls -->
    <div class="flex gap-4">
      <button @click="startCamera" :disabled="running"
        class="px-4 py-2 rounded-full bg-green-600 hover:bg-green-700 text-white flex items-center gap-2">
        <Play class="w-4 h-4"/> Start
      </button>
      <button @click="stopCamera" :disabled="!running"
        class="px-4 py-2 rounded-full bg-red-600 hover:bg-red-700 text-white flex items-center gap-2">
        <Square class="w-4 h-4"/> Stop
      </button>
    </div>

    <!-- Gesture Mapping -->
    <div class="w-full bg-gray-800 p-4 rounded-xl shadow-md">
      <h3 class="text-white font-semibold mb-3">Custom Gesture Mapping</h3>
      <div class="space-y-3">
        <div v-for="(data, key) in gestureMap" :key="key" class="flex items-center gap-3">
          <span class="w-32 text-white font-medium capitalize">{{ key }}</span>
          <input v-model="data.text" class="flex-1 px-3 py-2 rounded-md text-sm" />
          <button @click="speak(data.text, data.lang)" class="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-md flex items-center gap-1">
            <Mic class="w-4 h-4"/> Test
          </button>
        </div>
      </div>
    </div>

    <!-- Debug Panel -->
    <transition name="fade">
      <div v-if="debugMode" id="debug-panel" class="bg-black/70 text-red-400 p-3 rounded-md w-full max-h-40 overflow-y-auto text-sm"></div>
    </transition>
  </div>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
