<template>
  <div class="gesture-root">
    <div class="top-row">
      <div class="video-wrap">
        <video ref="video" class="video" autoplay playsinline muted></video>
        <canvas ref="canvas" class="canvas"></canvas>
        <div class="overlay-text" v-if="overlayText">{{ overlayText }}</div>
      </div>

      <div class="panel">
        <h3>⚙️ Kontrol</h3>

        <div class="control-row">
          <label>Kamera:</label>
          <select v-model="selectedDeviceId" @change="switchCamera">
            <option v-for="d in videoDevices" :key="d.deviceId" :value="d.deviceId">
              {{ d.label || ('Camera ' + (videoDevices.indexOf(d)+1)) }}
            </option>
          </select>
        </div>

        <div class="control-row">
          <label>Bahasa Suara:</label>
          <select v-model="lang" @change="updateVoiceList">
            <option value="id-ID">Indonesia</option>
            <option value="en-US">English</option>
          </select>
        </div>

        <div class="control-row">
          <label>Voice:</label>
          <select v-model="selectedVoiceURI">
            <option v-for="v in voicesFiltered" :key="v.voiceURI" :value="v.voiceURI">
              {{ v.name }} ({{ v.lang }})
            </option>
          </select>
        </div>

        <div class="control-row">
          <button @click="testVoice">🔊 Tes Suara</button>
          <button @click="toggleAudio">{{ audioEnabled ? '🔇 Matikan Suara' : '🔊 Aktifkan Suara' }}</button>
        </div>

        <div class="control-row">
          <button @click="toggleSkeleton">{{ showSkeleton ? 'Sembunyikan Kerangka' : 'Tampilkan Kerangka' }}</button>
          <button @click="takeScreenshot">📸 Screenshot</button>
        </div>

        <hr />

        <div class="control-row">
          <label>Simulasi Gesture:</label>
          <div class="sim-buttons">
            <button @click="simulate('thumbs')">👍 Jempol</button>
            <button @click="simulate('point')">☝️ Menunjuk</button>
            <button @click="simulate('wave')">👋 Lambaian</button>
            <button @click="simulate('nod')">🙆 Angguk</button>
            <button @click="simulate('shake')">🙅 Geleng</button>
          </div>
        </div>

        <hr />

        <div class="status">
          <div><strong>Gestur Terakhir:</strong> {{ detectedGesture || '-' }}</div>
          <div><strong>Status Jari Kanan:</strong> {{ rightFingerStatus || '-' }}</div>
          <div><strong>Status Jari Kiri:</strong> {{ leftFingerStatus || '-' }}</div>
        </div>

        <div class="debug">
          <small>
            Debug: onResultsCalled: {{ debug.onResultsCalled ? 'Ya' : 'Tidak' }} | 
            Pose: {{ debug.poseLandmarks ? 'Ada' : 'Tidak' }} | 
            Tangan Kanan: {{ debug.rightHandLandmarks ? 'Ada' : 'Tidak' }} | 
            Tangan Kiri: {{ debug.leftHandLandmarks ? 'Ada' : 'Tidak' }} | 
            Wajah: {{ debug.faceLandmarks ? 'Ada' : 'Tidak' }}
          </small>
          <div v-if="debug.lastError" style="color:red">⚠️ {{ debug.lastError }}</div>
        </div>
      </div>
    </div>
  </div>
</template>
