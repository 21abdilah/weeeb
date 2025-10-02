<template>
  <div class="home">
    <h1 class="title">👋</h1>
    <ClientOnly fallback="<p>Loading camera...</p>">
      <WebcamGesture />
    </ClientOnly>
  </div>
</template>

<script setup>
import WebcamGesture from '~/components/WebcamGesture.vue'
</script>

<style scoped>
.home {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
}
.title {
  font-size: 28px;
  margin-bottom: 20px;
}
</style>
