<template>
  <div class="home">
    <ClientOnly fallback="<p>Antosan sakedap...</p>">
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
