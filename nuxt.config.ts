// nuxt.config.ts
import { defineNuxtConfig } from 'nuxt/config'

export default defineNuxtConfig({
  ssr: false, // non-SSR karena pakai webcam
  css: ['~/assets/css/global.css'],
  vite: {
    define: { 'process.env': {} }
  }
})
