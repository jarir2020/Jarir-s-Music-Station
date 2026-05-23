<template>
  <div class="glass p-6 rounded-2xl border border-panelBorder bg-panelBg shadow-xl">
    <h3 class="text-xl font-bold font-outfit text-textMain mb-4 flex items-center gap-2">
      <Sliders class="w-5 h-5 text-violet-500" />
      Studio Equalizer
    </h3>
    <p class="text-xs text-slate-400 mb-6">
      Fine-tune acoustic gains dynamically. Select pre-defined sound filters or drag mixers.
    </p>

    <!-- Preset quick links -->
    <div class="flex items-center gap-2 flex-wrap mb-6 border-b border-panelBorder pb-4">
      <button 
        v-for="(preset, name) in presets" 
        :key="name"
        @click="loadPreset(preset)"
        class="px-3 py-1.5 rounded-lg border border-panelBorder bg-slate-200/30 dark:bg-white/5 hover:bg-violet-600/10 hover:border-violet-500/20 text-[10px] font-bold text-slate-400 hover:text-violet-500 uppercase tracking-wide transition duration-200 cursor-pointer"
      >
        {{ name }}
      </button>
    </div>

    <!-- Triple Sliders mixer grids -->
    <div class="grid grid-cols-3 gap-6 py-2">
      <!-- Bass Slider -->
      <div class="flex flex-col items-center gap-3">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Bass</span>
        <div class="h-32 flex items-center justify-center relative group">
          <input 
            type="range" 
            min="-10" 
            max="10" 
            step="0.5"
            :value="bassLevel"
            @input="updateGain('bass', $event)"
            orient="vertical"
            class="h-full bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500 outline-none select-none py-1 vertical-slider"
          />
        </div>
        <span class="text-xs font-mono font-bold text-textMain">{{ formatDb(bassLevel) }}</span>
      </div>

      <!-- Mid Slider -->
      <div class="flex flex-col items-center gap-3">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Mid</span>
        <div class="h-32 flex items-center justify-center relative group">
          <input 
            type="range" 
            min="-10" 
            max="10" 
            step="0.5"
            :value="midLevel"
            @input="updateGain('mid', $event)"
            orient="vertical"
            class="h-full bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500 outline-none select-none py-1 vertical-slider"
          />
        </div>
        <span class="text-xs font-mono font-bold text-textMain">{{ formatDb(midLevel) }}</span>
      </div>

      <!-- Treble Slider -->
      <div class="flex flex-col items-center gap-3">
        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Treble</span>
        <div class="h-32 flex items-center justify-center relative group">
          <input 
            type="range" 
            min="-10" 
            max="10" 
            step="0.5"
            :value="trebleLevel"
            @input="updateGain('treble', $event)"
            orient="vertical"
            class="h-full bg-white/10 rounded-lg appearance-none cursor-pointer accent-violet-500 outline-none select-none py-1 vertical-slider"
          />
        </div>
        <span class="text-xs font-mono font-bold text-textMain">{{ formatDb(trebleLevel) }}</span>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { Sliders } from 'lucide-vue-next'

export default {
  name: 'AudioEqualizerControls',
  components: {
    Sliders
  },
  setup() {
    const audioStore = useAudioStore()

    const bassLevel = computed(() => audioStore.eqLevels.bass)
    const midLevel = computed(() => audioStore.eqLevels.mid)
    const trebleLevel = computed(() => audioStore.eqLevels.treble)

    // Preset options configuration
    const presets = {
      flat: { bass: 0, mid: 0, treble: 0 },
      pop: { bass: 1.5, mid: 3.0, treble: 1.0 },
      rock: { bass: 3.5, mid: -1.0, treble: 2.0 },
      classical: { bass: 2.0, mid: 1.0, treble: -1.5 },
      'bass boost': { bass: 6.5, mid: 0, treble: 0 }
    }

    const updateGain = (band, e) => {
      audioStore.setEqGain(band, parseFloat(e.target.value))
    }

    // DRY: Reusable preset applier
    const loadPreset = (preset) => {
      Object.keys(preset).forEach(band => {
        audioStore.setEqGain(band, preset[band])
      })
    }

    const formatDb = (val) => {
      const sign = val > 0 ? '+' : ''
      return `${sign}${val.toFixed(1)} dB`
    }

    return {
      bassLevel,
      midLevel,
      trebleLevel,
      presets,
      updateGain,
      loadPreset,
      formatDb
    }
  }
}
</script>

<style scoped>
/* Styling for vertically aligned slide tracks */
.vertical-slider {
  writing-mode: bt-lr; /* IE */
  -webkit-appearance: slider-vertical; /* Webkit */
  width: 8px;
  height: 120px;
}
</style>

<!-- Changed on 2026-05-23 19:21:00 -->
