<template>
  <div class="page-wrapper">
    <!-- Kamera -->
    <div class="camera-box">
      <h2 v-if="loading" class="loader">📷 Menyiapkan Kamera...</h2>
      <video v-else ref="video" autoplay playsinline></video>
    </div>

    <!-- Kontrol -->
    <div class="controls">
      <button class="btn" @click="flipCamera">🔄 Ganti Kamera</button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"

const video = ref(null)
const loading = ref(true)
let currentFacing = "user" // default kamera depan

// --- Setup Kamera ---
async function setupCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: currentFacing }
    })
    video.value.srcObject = stream
    await new Promise(resolve => {
      video.value.onloadedmetadata = () => resolve()
    })
    loading.value = false
  } catch (err) {
    console.error("Kamera gagal diakses:", err)
    loading.value = false
  }
}

// --- Ganti Kamera (depan <-> belakang) ---
async function flipCamera() {
  currentFacing = currentFacing === "user" ? "environment" : "user"
  loading.value = true
  await setupCamera()
}

onMounted(() => {
  setupCamera()
})
</script>

<style scoped>
.page-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  gap: 1rem;
  min-height: 100vh;
  background: #f9fafb;
}

/* Kamera */
.camera-box {
  width: 100%;
  max-width: 420px;
  background: #fff;
  border-radius: 16px;
  padding: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
video {
  width: 100%;
  border-radius: 12px;
  background: #000;
  object-fit: cover;
  transform: scaleX(1); /* <<< Tidak mirror */
}

/* Loader */
.loader {
  text-align: center;
  font-size: 1rem;
  color: #333;
}

/* Kontrol */
.controls {
  display: flex;
  justify-content: center;
}
.btn {
  padding: 0.6rem 1.2rem;
  border-radius: 10px;
  border: none;
  background: #2563eb;
  color: white;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.2s ease;
}
.btn:hover {
  background: #1e40af;
}
</style>
