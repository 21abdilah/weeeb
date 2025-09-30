<template>
  <div id="app" class="app-wrapper">
    <header class="app-header">
      <h1>📸  Kamera </h1>
      <p class="subtitle">Tes kamera di HP & Laptop (mirip WebcamToy)</p>
    </header>

    <!-- Kamera -->
    <main>
      <div v-if="loading" class="loading">⏳ Menghubungkan kamera...</div>

      <div v-if="cameraError" class="error">{{ cameraError }}</div>

      <div v-if="hasCamera" class="video-container">
        <video ref="video" autoplay playsinline muted></video>
      </div>

      <div class="controls">
        <button @click="setupCamera">🔄 Refresh Kamera</button>
      </div>
    </main>

    <footer class="app-footer">
      <p>Made with ❤️ by Hilal Abdilah</p>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"

const video = ref(null)
const loading = ref(true)
const hasCamera = ref(false)
const cameraError = ref("")

async function setupCamera() {
  loading.value = true
  hasCamera.value = false
  cameraError.value = ""

  try {
    const constraintsList = [
      { video: { facingMode: "user" }, audio: false },        // kamera depan
      { video: { facingMode: "environment" }, audio: false }, // kamera belakang
      { video: true }                                         // fallback generic
    ]

    let stream = null
    for (const c of constraintsList) {
      try {
        stream = await navigator.mediaDevices.getUserMedia(c)
        if (stream) break
      } catch (e) {
        console.warn("Gagal dengan config:", c, e)
      }
    }

    if (!stream) throw new Error("Tidak ada kamera yang bisa diakses")

    video.value.srcObject = stream

    // paksa play (untuk mobile Safari/Chrome)
    await video.value.play().catch(err => {
      console.error("Video gagal play:", err)
    })

    hasCamera.value = true
  } catch (err) {
    console.error("Kamera error:", err)
    cameraError.value =
      "❌ Kamera gagal diakses. Pastikan izin kamera sudah diberikan di browser/HP."
    hasCamera.value = false
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  setupCamera()
})
</script>

<style scoped>
.app-wrapper {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: #f9f9f9;
  color: #333;
  font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
}

.app-header {
  text-align: center;
  padding: 1rem;
  background: #0077ff;
  color: white;
}
.app-header h1 {
  margin: 0;
  font-size: 1.8rem;
}
.subtitle {
  font-size: 0.9rem;
  opacity: 0.85;
}

main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
}

.loading {
  margin: 2rem 0;
  font-size: 1.1rem;
  color: #666;
}
.error {
  margin: 1rem 0;
  padding: 0.8rem 1rem;
  background: #ffdddd;
  color: #a10000;
  border-radius: 8px;
  font-weight: bold;
}

.video-container {
  display: flex;
  justify-content: center;
  margin: 1rem 0;
  width: 100%;
}
video {
  width: 100%;
  max-width: 480px;
  border-radius: 12px;
  background: black;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.controls {
  margin: 1rem 0;
}
.controls button {
  padding: 0.6rem 1.2rem;
  border: none;
  border-radius: 10px;
  background: #0077ff;
  color: white;
  font-size: 1rem;
  cursor: pointer;
}
.controls button:hover {
  background: #005fcc;
}

.app-footer {
  text-align: center;
  padding: 0.8rem;
  font-size: 0.85rem;
  background: #eee;
}
</style>
