<template>
  <div class="wrap">
    <header class="header">
      <h1>📸 Perkenalan Interaktif</h1>
      <p class="sub">Angkat tangan → muncul teks & suara. Cocok di HP & laptop.</p>
    </header>

    <!-- Controls top -->
    <section class="controls-top">
      <div class="left">
        <label class="label">Pilih Kamera</label>
        <select v-model="selectedDeviceId" @change="onDeviceChange">
          <option value="">(Auto / Default)</option>
          <option v-for="d in videoDevices" :key="d.deviceId" :value="d.deviceId">
            {{ d.label || "Camera " + d.deviceId }}
          </option>
        </select>
      </div>

      <div class="buttons">
        <button @click="start" :disabled="starting" class="btn">▶ Start</button>
        <button @click="stop" :disabled="!streamActive" class="btn secondary">■ Stop</button>
        <button @click="refresh" :disabled="starting" class="btn">🔄 Refresh</button>
      </div>
    </section>

    <!-- Status -->
    <section class="status-row">
      <div><strong>Permission:</strong> {{ permissionState }}</div>
      <div><strong>Stream:</strong> {{ streamActive ? "active" : "stopped" }}</div>
      <div v-if="lastError"><strong>Last error:</strong> {{ lastErrorMessage }}</div>
    </section>

    <!-- Video area -->
    <section class="video-area">
      <video ref="video" autoplay playsinline muted class="video"></video>
      <div v-if="userMessage" class="overlay">{{ userMessage }}</div>
    </section>

    <!-- Info / Perkenalan -->
    <transition name="fade">
      <div v-if="showInfo" class="info-card" v-html="infoText"></div>
    </transition>

    <!-- Simulation & detection control -->
    <section class="sim-controls">
      <button @click="simulateGesture('hand')" class="btn">👋 Simulasi Angkat Tangan</button>
      <button @click="simulateGesture('head')" class="btn">🤓 Simulasi Angguk</button>
      <button @click="simulateGesture('wave')" class="btn">👏 Simulasi Lambaikan</button>
      <button v-if="streamActive" @click="toggleDetection" class="btn">
        {{ isDetecting ? "⏸ Pause Detection" : "▶ Resume Detection" }}
      </button>
    </section>

    <!-- Debug -->
    <details class="debug">
      <summary>🧾 Debug info</summary>
      <pre>{{ debugText }}</pre>
    </details>

    <footer class="tips">
      <p>Tips: buka site lewat HTTPS (Vercel OK). Jika di mobile, tekan <strong>Start</strong> untuk memberi gesture yang diperlukan.</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from "vue"
import * as tf from "@tensorflow/tfjs"
import * as poseDetection from "@tensorflow-models/pose-detection"

// ---------- refs / state ----------
const video = ref(null)

const videoDevices = ref([])
const selectedDeviceId = ref("")

const permissionState = ref("unknown")
const streamActive = ref(false)
const starting = ref(false)
const lastError = ref(null)
const userMessage = ref("")
const showInfo = ref(false)
const infoText = ref("")
const isDetecting = ref(true)

const myInfo = `
  <strong>Halo! Saya Hilal Abdilah</strong><br/>
  Mahasiswa baru Teknik Informatika<br/>
`

let currentStream = null
let detector = null
let detectionLoopId = null
let isSpeaking = false

const debug = reactive({ devices: [], logs: [] })
function logDebug(...args) {
  const txt = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")
  debug.logs.push(`[${new Date().toISOString()}] ${txt}`)
  console.debug(...args)
}

const debugText = computed(() => JSON.stringify({
  permissionState: permissionState.value,
  selectedDeviceId: selectedDeviceId.value,
  streamActive: streamActive.value,
  devices: debug.devices,
  logs: debug.logs.slice(-60)
}, null, 2))

const lastErrorMessage = computed(() => {
  if (!lastError.value) return ""
  const e = lastError.value
  return e && e.name ? `${e.name}: ${e.message || "(no message)"}` : String(e)
})

// ---------- permission & devices ----------
async function checkPermission() {
  permissionState.value = "unknown"
  userMessage.value = ""
  try {
    if (navigator.permissions && navigator.permissions.query) {
      try {
        const p = await navigator.permissions.query({ name: "camera" })
        permissionState.value = p.state
        p.onchange = () => { permissionState.value = p.state }
        logDebug("Permissions API (camera):", p.state)
        return p.state
      } catch (err) {
        logDebug("Permissions API camera not supported", err)
      }
    }
    // fallback: enumerateDevices -> check label visibility
    const devices = await navigator.mediaDevices.enumerateDevices()
    debug.devices = devices
    const anyLabels = devices.some(d => !!d.label)
    permissionState.value = anyLabels ? "granted" : "prompt/unknown"
    logDebug("Permissions fallback anyLabels:", anyLabels)
    return permissionState.value
  } catch (e) {
    logDebug("checkPermission failed", e)
    permissionState.value = "unknown"
    return "unknown"
  }
}

async function enumerateVideoDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    debug.devices = devices
    videoDevices.value = devices.filter(d => d.kind === "videoinput")
    logDebug("enumerateDevices:", videoDevices.value.map(d => d.label || d.deviceId))
    return videoDevices.value
  } catch (e) {
    logDebug("enumerateDevices failed", e)
    videoDevices.value = []
    return []
  }
}

// ---------- stream management ----------
function stopStream() {
  if (!currentStream) return
  const tracks = currentStream.getTracks()
  tracks.forEach(t => {
    try { t.stop() } catch (err) { /* ignore */ }
  })
  currentStream = null
  streamActive.value = false
  if (video.value) video.value.srcObject = null
  logDebug("Stream stopped")
}

function handleGetUserMediaError(e) {
  lastError.value = e
  logDebug("getUserMedia error:", e)
  if (e.name === "NotAllowedError" || e.name === "PermissionDeniedError") {
    userMessage.value = "❌ Izin kamera ditolak. Periksa pengaturan situs di browser."
    permissionState.value = "denied"
  } else if (e.name === "NotFoundError" || e.name === "DevicesNotFoundError") {
    userMessage.value = "📭 Tidak menemukan kamera di perangkat."
    permissionState.value = "not-found"
  } else if (e.name === "NotReadableError" || e.name === "TrackStartError") {
    userMessage.value = "🔒 Kamera sedang dipakai aplikasi lain atau tidak dapat dibuka."
    permissionState.value = "in-use"
  } else if (e.name === "OverconstrainedError" || e.name === "ConstraintNotSatisfiedError") {
    userMessage.value = "⚠️ Konfigurasi kamera tidak tersedia (coba pilih device lain)."
    permissionState.value = "constraint"
  } else {
    userMessage.value = `⚠️ Error: ${e.name || e}`
  }
}

// Build constraint list (selected device -> facing user -> environment -> generic)
function buildConstraintsList() {
  const list = []
  if (selectedDeviceId.value) {
    list.push({ video: { deviceId: { exact: selectedDeviceId.value } }, audio: false })
  }
  list.push({ video: { facingMode: "user" }, audio: false })
  list.push({ video: { facingMode: "environment" }, audio: false })
  list.push({ video: true, audio: false })
  return list
}

// Start stream (tries constraints list)
async function start() {
  starting.value = true
  lastError.value = null
  userMessage.value = "⏳ Meminta akses kamera..."
  stopStream() // ensure clean

  try {
    await checkPermission()
    await enumerateVideoDevices()

    const constraintsList = buildConstraintsList()
    let stream = null
    for (const c of constraintsList) {
      try {
        logDebug("Trying getUserMedia with", c)
        stream = await navigator.mediaDevices.getUserMedia(c)
        if (stream) break
      } catch (e) {
        logDebug("getUserMedia failed for constraints", c, e)
      }
    }

    if (!stream) throw new Error("Tidak ada kamera yang bisa diakses")

    currentStream = stream
    if (video.value) {
      video.value.srcObject = stream
      // force play (may still be blocked on some browsers without user gesture)
      await video.value.play().catch(err => {
        logDebug("video.play() rejected", err)
      })
    }
    streamActive.value = true
    userMessage.value = ""
    lastError.value = null
    await enumerateVideoDevices() // update labels after grant
    logDebug("Stream started OK")
    // start detection if allowed backend ready
    await setupBackendAndDetectorIfNeeded()
  } catch (e) {
    handleGetUserMediaError(e)
    logDebug("start() error:", e)
  } finally {
    starting.value = false
  }
}

function stop() {
  stopStream()
  userMessage.value = "Kamera dihentikan."
  stopDetection()
}

// refresh: stop + enumerate + start
async function refresh() {
  userMessage.value = "🔄 Refreshing..."
  stopStream()
  await enumerateVideoDevices()
  setTimeout(() => start(), 300)
}

// device changed by user
function onDeviceChange() {
  logDebug("Device changed", selectedDeviceId.value)
  start()
}

// ---------- TensorFlow backend & detector ----------
let backendChosen = null
async function setupBackendAndDetectorIfNeeded() {
  if (!streamActive.value) return
  if (!detector) {
    await chooseBackend()
    try {
      // create detector - MoveNet (lightweight & fast)
      detector = await poseDetection.createDetector(poseDetection.SupportedModels.MoveNet)
      logDebug("Detector created")
      startDetectionLoop()
    } catch (e) {
      logDebug("createDetector failed", e)
      userMessage.value = "⚠️ Gagal inisialisasi detector pose."
    }
  } else {
    startDetectionLoop()
  }
}

async function chooseBackend() {
  const backends = ["webgl", "wasm", "cpu"]
  for (const b of backends) {
    try {
      await tf.setBackend(b)
      await tf.ready()
      backendChosen = b
      logDebug("TF backend set:", b)
      return
    } catch (e) {
      logDebug(`Backend ${b} failed`, e)
    }
  }
  logDebug("No TF backend succeeded")
}

// ---------- detection loop ----------
async function detectOnce() {
  if (!detector || !video.value || video.value.readyState < 2) return null
  try {
    const poses = await detector.estimatePoses(video.value)
    return poses
  } catch (e) {
    logDebug("estimatePoses error", e)
    return null
  }
}

let lastDetectTs = 0
function startDetectionLoop() {
  if (detectionLoopId) return
  userMessage.value = ""
  const loop = async () => {
    if (!isDetecting.value) {
      detectionLoopId = requestAnimationFrame(loop)
      return
    }
    const now = Date.now()
    const delta = now - lastDetectTs
    if (delta < 80) { // throttle ~12fps
      detectionLoopId = requestAnimationFrame(loop)
      return
    }
    lastDetectTs = now
    const poses = await detectOnce()
    if (poses && poses.length > 0) {
      const keypoints = poses[0].keypoints || []
      const leftWrist = keypoints.find(p => p.name === "left_wrist")
      const rightWrist = keypoints.find(p => p.name === "right_wrist")
      const nose = keypoints.find(p => p.name === "nose")
      if ((leftWrist?.y < nose?.y || rightWrist?.y < nose?.y) && !showInfo.value) {
        showInfo.value = true
        infoText.value = myInfo
        speak("Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika.")
      }
    }
    detectionLoopId = requestAnimationFrame(loop)
  }
  detectionLoopId = requestAnimationFrame(loop)
  logDebug("Detection loop started")
}

function stopDetection() {
  if (detectionLoopId) {
    cancelAnimationFrame(detectionLoopId)
    detectionLoopId = null
    logDebug("Detection loop stopped")
  }
}

// toggle detection
function toggleDetection() {
  isDetecting.value = !isDetecting.value
  if (isDetecting.value) startDetectionLoop()
  else stopDetection()
}

// ---------- TTS ----------
function loadVoices() {
  const synth = window.speechSynthesis
  if (!synth) return []
  const vs = synth.getVoices()
  logDebug("voices loaded", vs.map(v => v.name))
  return vs
}
let voicesCache = []
function ensureVoices() {
  voicesCache = loadVoices()
  if (!voicesCache.length && window.speechSynthesis && window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      voicesCache = loadVoices()
    }
  }
}

function speak(text) {
  try {
    if (isSpeaking) return
    const synth = window.speechSynthesis
    if (!synth) return
    if (!voicesCache.length) ensureVoices()
    let voice = voicesCache.find(v => v.lang && v.lang.includes("id"))
      || voicesCache.find(v => v.name && v.name.toLowerCase().includes("indonesia"))
      || voicesCache[0] || null
    const u = new SpeechSynthesisUtterance(text)
    if (voice) u.voice = voice
    u.lang = "id-ID"
    u.rate = 0.95
    u.pitch = 1.05
    isSpeaking = true
    u.onend = () => (isSpeaking = false)
    synth.speak(u)
    logDebug("Speaking:", text, "voice:", voice && voice.name)
  } catch (e) {
    logDebug("speak failed", e)
  }
}

// simulation gestures
function simulateGesture(type) {
  if (type === "hand") {
    showInfo.value = true
    infoText.value = myInfo
    speak("Halo semuanya! Perkenalkan, saya Hilal Abdilah, mahasiswa baru Teknik Informatika.")
  } else if (type === "head") {
    speak("Terima kasih, sampai jumpa!")
  } else if (type === "wave") {
    speak("Himatika! Kita pasti bisa!")
  }
}

// ---------- lifecycle ----------
onMounted(async () => {
  ensureVoices()
  await checkPermission()
  await enumerateVideoDevices()
  userMessage.value = "Tekan Start untuk menampilkan preview kamera."
})

onBeforeUnmount(() => {
  stopStream()
  stopDetection()
  if (detector && detector.dispose) try { detector.dispose() } catch (_) {}
})
</script>

<style scoped>
:root {
  --bg: #ffffff;
  --muted: #6b7280;
  --accent: #2563eb;
  --danger: #d9534f;
}
.wrap {
  max-width: 920px;
  margin: 18px auto;
  padding: 18px;
  background: var(--bg);
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.06);
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  color: #111827;
}
.header { text-align: center; margin-bottom: 12px; }
.header h1 { margin: 0; font-size: 1.4rem; }
.sub { margin: 6px 0 0; color: var(--muted); font-size: 0.95rem; }

.controls-top {
  display:flex;
  gap:12px;
  align-items:center;
  justify-content:space-between;
  margin-bottom:12px;
  flex-wrap:wrap;
}
.controls-top .left { display:flex; gap:8px; align-items:center; }
.label { font-weight:600; color:var(--muted); font-size:0.9rem; }
select { padding:8px 10px; border-radius:8px; border:1px solid #e5e7eb; min-width:220px; }

.buttons { display:flex; gap:8px; }
.btn {
  padding:8px 12px;
  border-radius:8px;
  border:none;
  cursor:pointer;
  background: linear-gradient(90deg,#10b981,#06b6d4);
  color:white;
  font-weight:600;
}
.btn.secondary { background: #ef4444; }
.btn:disabled { opacity:0.55; cursor:not-allowed; }

.status-row { display:flex; gap:18px; color:var(--muted); margin-bottom:12px; flex-wrap:wrap; }

.video-area { position:relative; display:flex; justify-content:center; margin-bottom:12px; }
.video { width:100%; max-width:720px; border-radius:12px; background:#000; box-shadow:0 10px 30px rgba(2,6,23,0.12); }
.overlay { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); background:rgba(0,0,0,0.56); color:white; padding:10px 14px; border-radius:10px; }

.info-card {
  max-width:720px;
  margin: 10px auto;
  background: rgba(0,0,0,0.75);
  color: #fff;
  padding:12px 16px;
  border-radius:10px;
  text-align:center;
  font-size:1rem;
  line-height:1.4;
}

.sim-controls { display:flex; gap:8px; flex-wrap:wrap; justify-content:center; margin:10px 0; }
.debug { margin-top:14px; background:#fafafa; padding:12px; border-radius:8px; font-size:0.9rem; color:#374151; }
.tips { margin-top:12px; color:var(--muted); font-size:0.9rem; text-align:center; }

/* fade */
.fade-enter-active, .fade-leave-active { transition: opacity .4s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }

/* responsive */
@media (max-width:640px) {
  .controls-top { flex-direction:column; align-items:flex-start; gap:10px; }
  select { min-width:unset; width:100%; }
  .buttons { width:100%; justify-content:flex-start; }
  .video { max-width:100%; height:auto; }
}
</style>
