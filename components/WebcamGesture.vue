<template>
  <div class="wrap">
    <h2>🔍 Camera Debug & Fix</h2>

    <div class="controls-row">
      <button @click="start" :disabled="starting">▶ Start Kamera</button>
      <button @click="stop" :disabled="!streamActive">■ Stop</button>
      <button @click="refresh" :disabled="starting">🔄 Refresh</button>
    </div>

    <div class="form-row">
      <label>📷 Pilih Kamera:</label>
      <select v-model="selectedDeviceId" @change="onDeviceChange">
        <option value="">(Auto / default)</option>
        <option
          v-for="d in videoDevices"
          :key="d.deviceId"
          :value="d.deviceId"
        >
          {{ d.label || "Camera " + d.deviceId }}
        </option>
      </select>
    </div>

    <div class="status">
      <div><strong>Permission:</strong> {{ permissionState }}</div>
      <div><strong>Stream active:</strong> {{ streamActive ? "yes" : "no" }}</div>
      <div v-if="lastError"><strong>Last error:</strong> {{ lastErrorMessage }}</div>
    </div>

    <div class="video-area">
      <video
        ref="video"
        autoplay
        playsinline
        muted
        class="video"
      ></video>
      <div v-if="userMessage" class="overlay">{{ userMessage }}</div>
    </div>

    <details class="debug">
      <summary>🧾 Debug info</summary>
      <pre>{{ debugText }}</pre>
    </details>

    <div class="tips">
      <h4>Tips cepat</h4>
      <ul>
        <li>Pastikan halaman diakses lewat <strong>HTTPS</strong> (Vercel sudah OK).</li>
        <li>Tutup aplikasi lain yang memakai kamera (Zoom, WhatsApp, dsb.).</li>
        <li>Jika di HP: buka Settings → App → Browser → Permissions → Camera → Allow untuk situs ini.</li>
        <li>Untuk iOS Safari: tekan <em>Start Kamera</em> (user gesture diperlukan).</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onBeforeUnmount } from "vue"

const video = ref(null)
const selectedDeviceId = ref("")
const videoDevices = ref([])
const permissionState = ref("unknown")
const streamActive = ref(false)
const lastError = ref(null)
const starting = ref(false)
const userMessage = ref("")

let currentStream = null

const debug = reactive({
  devices: [],
  logs: []
})

const debugText = computed(() => {
  return JSON.stringify(
    {
      permissionState: permissionState.value,
      selectedDeviceId: selectedDeviceId.value,
      streamActive: streamActive.value,
      devices: debug.devices,
      logs: debug.logs.slice(-30)
    },
    null,
    2
  )
})

const lastErrorMessage = computed(() => {
  if (!lastError.value) return ""
  const e = lastError.value
  return e.name ? `${e.name}: ${e.message || "(no message)"}` : String(e)
})

function logDebug(...args) {
  const txt = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ")
  debug.logs.push(`[${new Date().toISOString()}] ${txt}`)
  console.debug(...args)
}

// Stop and cleanup any existing stream
function stopStream() {
  if (!currentStream) return
  const tracks = currentStream.getTracks()
  tracks.forEach(t => {
    try { t.stop() } catch (e) { /* ignore */ }
  })
  currentStream = null
  streamActive.value = false
  if (video.value) {
    try {
      video.value.srcObject = null
    } catch (e) {}
  }
  logDebug("Stream stopped")
}

// Map common errors to friendly messages + store lastError
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

// Enumerate devices and fill videoDevices
async function enumerateVideoDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    debug.devices = devices
    videoDevices.value = devices.filter(d => d.kind === "videoinput")
    logDebug("Devices enumerated:", videoDevices.value.map(d => d.label || d.deviceId))
    return videoDevices.value
  } catch (e) {
    logDebug("enumerateDevices failed", e)
    // enumerateDevices may return limited info until permission granted
    videoDevices.value = []
    return []
  }
}

// Check permission using Permissions API (best effort)
async function checkPermission() {
  permissionState.value = "unknown"
  userMessage.value = ""
  try {
    if (navigator.permissions && navigator.permissions.query) {
      // try 'camera' first (not supported everywhere), fallback to 'microphone' or use getUserMedia check
      try {
        const p = await navigator.permissions.query({ name: "camera" })
        permissionState.value = p.state
        p.onchange = () => { permissionState.value = p.state }
        logDebug("Permissions API (camera) state:", p.state)
        return p.state
      } catch (err) {
        // some browsers throw; fallback: check via enumerateDevices (labels only visible when allowed)
        logDebug("Permissions API camera not supported:", err)
      }
    }
    // fallback probing: enumerateDevices — if labels are empty, likely permission not granted yet
    const devices = await navigator.mediaDevices.enumerateDevices()
    const anyLabels = devices.some(d => !!d.label)
    permissionState.value = anyLabels ? "granted" : "prompt/unknown"
    logDebug("Permissions fallback, anyLabels:", anyLabels)
    return permissionState.value
  } catch (e) {
    logDebug("permission check failed:", e)
    permissionState.value = "unknown"
    return "unknown"
  }
}

// Start camera with selected device or fallback
async function start() {
  starting.value = true
  lastError.value = null
  userMessage.value = "⏳ Meminta akses kamera..."
  try {
    // stop existing
    stopStream()

    // Ensure we know permission & devices first
    await checkPermission()
    await enumerateVideoDevices()

    // Build constraints
    const constraints = {
      video: {}
    }
    if (selectedDeviceId.value) {
      constraints.video.deviceId = { exact: selectedDeviceId.value }
    } else {
      // let browser choose; still give facingMode hint
      constraints.video.facingMode = { ideal: "user" }
    }

    logDebug("Requesting getUserMedia with", constraints)
    try {
      const s = await navigator.mediaDevices.getUserMedia(constraints)
      currentStream = s
      if (video.value) {
        video.value.srcObject = s
        // Try to force play; mobile browsers often require user interaction (we have Start button)
        await video.value.play().catch(err => {
          logDebug("video.play() catch:", err)
        })
      }
      streamActive.value = true
      userMessage.value = ""
      lastError.value = null
      logDebug("Stream started OK")
      // Re-enumerate to get labels (some browsers reveal labels only after grant)
      await enumerateVideoDevices()
    } catch (e) {
      handleGetUserMediaError(e)
      throw e // rethrow to outer catch for logging
    }
  } catch (e) {
    logDebug("start() failed:", e)
  } finally {
    starting.value = false
  }
}

function stop() {
  stopStream()
  userMessage.value = "Kamera dihentikan."
}

async function refresh() {
  userMessage.value = "🔄 Refreshing..."
  stopStream()
  await enumerateVideoDevices()
  // small pause then start automatically
  setTimeout(() => { start() }, 300)
}

function onDeviceChange() {
  // When user picks a different device, restart stream
  logDebug("Device changed to", selectedDeviceId.value)
  start()
}

onMounted(async () => {
  // initial checks (don't auto-start to respect mobile Safari/Chrome user gesture requirement)
  await checkPermission()
  await enumerateVideoDevices()
  // show message instructing user to start
  userMessage.value = "Tekan \"Start Kamera\" untuk memberikan izin / menampilkan preview."
})

onBeforeUnmount(() => {
  stopStream()
})
</script>

<style scoped>
.wrap {
  max-width: 820px;
  margin: 1rem auto;
  padding: 1rem;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial;
  color: #111;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(0,0,0,0.08);
}
.controls-row { display:flex; gap:8px; margin-bottom:10px; }
.controls-row button { padding:8px 14px; border-radius:8px; border:none; background:#007bff; color:white; cursor:pointer; }
.controls-row button:disabled { opacity:0.5; cursor:not-allowed; }
.form-row { margin:10px 0; display:flex; gap:8px; align-items:center; }
.form-row select { padding:6px 8px; border-radius:6px; }

.status { margin:10px 0; font-size:0.95rem; color:#333; }
.video-area { position:relative; margin-top:10px; display:flex; justify-content:center; }
.video { width:100%; max-width:560px; border-radius:12px; background:#000; box-shadow:0 6px 18px rgba(0,0,0,0.12); }
.overlay { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); color:#fff; background:rgba(0,0,0,0.55); padding:10px 14px; border-radius:8px; }
.debug { margin-top:12px; font-size:0.85rem; background:#fafafa; padding:10px; border-radius:8px; }
.tips { margin-top:12px; font-size:0.9rem; color:#333; }
.tips ul { margin:6px 0 0 18px; }
</style>
