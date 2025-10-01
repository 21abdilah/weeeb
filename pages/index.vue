<template>
  <div class="p-4">
    <h1 class="mb-2 font-bold text-xl">Demo Webcam Gesture</h1>
    <p class="mb-4 text-gray-700">
      Silakan aktifkan kamera dan coba beberapa gesture (angkat tangan, lambaikan tangan, angguk, atau lompat) untuk melihat demo deteksi gesture secara real-time dengan suara otomatis!
    </p>
    <client-only>
      <WebcamGesture />
    </client-only>
    <noscript>
      <div class="mt-6 p-4 bg-yellow-200 text-yellow-900 rounded">
        Aktifkan JavaScript di browser Anda untuk menggunakan fitur webcam dan gesture interaktif.
      </div>
    </noscript>
  </div>
</template>

<script setup>
import WebcamGesture from '~/components/WebcamGesture.vue'
</script>