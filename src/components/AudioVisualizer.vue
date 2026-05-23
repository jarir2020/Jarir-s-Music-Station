<template>
  <div class="glass p-6 rounded-2xl border border-panelBorder bg-panelBg shadow-xl flex flex-col gap-4">
    <h3 class="text-xl font-bold font-outfit text-textMain flex items-center gap-2">
      <Activity class="w-5 h-5 text-violet-500" />
      Interactive Visualizer
    </h3>
    <p class="text-xs text-slate-400">
      Real-time digital signal processing canvas. Plays dynamically synchronized spectrum waves.
    </p>

    <!-- Canvas Frame -->
    <div class="w-full relative rounded-xl border border-panelBorder bg-black/20 overflow-hidden">
      <canvas 
        ref="canvas" 
        class="w-full h-[180px] block"
      ></canvas>
    </div>
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { Activity } from 'lucide-vue-next'

export default {
  name: 'AudioVisualizerCanvas',
  components: {
    Activity
  },
  setup() {
    const audioStore = useAudioStore()
    const canvas = ref(null)
    let ctx = null
    let animationId = null
    let resizeObserver = null

    // Changed on 2026-05-23 20:27:00
    // Draw baseline when audio is not actively playing
    const drawPlaceholderBaseline = (width, height) => {
      ctx.clearRect(0, 0, width, height)
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      
      const waveSpeed = Date.now() * 0.003
      for (let x = 0; x < width; x++) {
        const y = height / 2 + Math.sin(x * 0.01 + waveSpeed) * 3
        ctx.lineTo(x, y)
      }
      
      ctx.strokeStyle = 'rgba(124, 58, 237, 0.4)'
      ctx.lineWidth = 2
      ctx.stroke()
    }

    // Render an animated breathing sine wave for active stream fallbacks (CORS zero outputs)
    const drawStreamingPlaceholder = (width, height) => {
      ctx.clearRect(0, 0, width, height)
      
      const time = Date.now() * 0.002
      const centerY = height / 2

      // Draw 3 layers of glowing neon waves with different frequencies and phases
      const waves = [
        { amplitude: 18, frequency: 0.015, phase: time, color: 'rgba(124, 58, 237, 0.5)' }, // themePurple
        { amplitude: 12, frequency: 0.02, phase: time * 1.5, color: 'rgba(219, 39, 119, 0.4)' }, // themePink
        { amplitude: 6, frequency: 0.01, phase: time * 0.7, color: 'rgba(244, 63, 94, 0.3)' }  // rose
      ]

      ctx.lineWidth = 2
      for (const w of waves) {
        ctx.beginPath()
        ctx.moveTo(0, centerY)
        
        for (let x = 0; x < width; x++) {
          const y = centerY + Math.sin(x * w.frequency + w.phase) * w.amplitude
          ctx.lineTo(x, y)
        }
        ctx.strokeStyle = w.color
        ctx.stroke()
      }
    }

    // High performance visualizer drawing loop
    const startRenderLoop = () => {
      if (!canvas.value) return
      ctx = canvas.value.getContext('2d')

      const draw = () => {
        animationId = requestAnimationFrame(draw)

        const width = canvas.value.width
        const height = canvas.value.height

        const isPlaying = audioStore.isPlaying
        const analyser = audioStore.analyser

        if (!isPlaying || !analyser) {
          drawPlaceholderBaseline(width, height)
          return
        }

        const bufferLength = analyser.frequencyBinCount
        const dataArray = new Uint8Array(bufferLength)
        analyser.getByteFrequencyData(dataArray)

        // Detect if audio data is blocked or flat (zeros due to CORS access restrictions)
        let isFlat = true
        for (let i = 0; i < bufferLength; i++) {
          if (dataArray[i] > 0) {
            isFlat = false
            break
          }
        }

        if (isFlat) {
          drawStreamingPlaceholder(width, height)
          return
        }

        ctx.clearRect(0, 0, width, height)

        // Render bar graphs
        const barWidth = (width / bufferLength) * 2.5
        let barHeight
        let x = 0

        // Create glowing visualizer gradient (purple to pink)
        const gradient = ctx.createLinearGradient(0, height, 0, 0)
        gradient.addColorStop(0, '#7c3aed') // themePurple
        gradient.addColorStop(0.5, '#db2777') // themePink
        gradient.addColorStop(1, '#f43f5e') // rose

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i] / 1.5 // Scaling down slightly

          // Draw bouncing spectrum bar
          ctx.fillStyle = gradient
          ctx.fillRect(x, height - barHeight, barWidth - 1, barHeight)

          x += barWidth
        }
      }

      draw()
    }

    // Adjust canvas resolution dynamically on viewport modifications
    const handleResize = () => {
      if (!canvas.value) return
      const rect = canvas.value.getBoundingClientRect()
      canvas.value.width = rect.width * window.devicePixelRatio
      canvas.value.height = rect.height * window.devicePixelRatio
      
      ctx = canvas.value.getContext('2d')
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    }

    onMounted(() => {
      handleResize()
      startRenderLoop()

      if (window.ResizeObserver) {
        resizeObserver = new ResizeObserver(handleResize)
        resizeObserver.observe(canvas.value)
      }
    })

    onUnmounted(() => {
      if (animationId) {
        cancelAnimationFrame(animationId)
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
    })

    return {
      canvas
    }
  }
}
</script>

<!-- Changed on 2026-05-23 19:21:00 -->
