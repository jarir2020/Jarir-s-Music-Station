<template>
  <div 
    v-if="currentTrack" 
    class="fixed bottom-0 left-0 w-full z-40 border-t border-panelBorder bg-themeDark/75 backdrop-blur-xl py-4 px-6 flex flex-col md:flex-row items-center justify-between gap-4 glass-glow transition-all duration-300"
  >
    <!-- Absolute Close Button -->
    <!-- Changed on 2026-05-23 20:36:55 -->
    <button 
      @click="audioStore.stop()"
      class="absolute top-2 right-2 p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-slate-200/50 dark:hover:bg-white/5 transition duration-200 cursor-pointer"
      title="Close Player"
    >
      <X class="w-4 h-4" />
    </button>
    <!-- Left Hand Track Profile Card -->
    <div class="flex items-center gap-4 w-full md:w-1/4 justify-start">
      <img 
        :src="currentTrack.coverUrl || '/logo.png'"
        alt="Album Art" 
        class="w-14 h-14 rounded-xl object-cover border border-panelBorder shadow-md shadow-black/20"
      />
      <div class="min-w-0">
        <h4 class="text-sm font-bold font-outfit text-textMain truncate">{{ currentTrack.title }}</h4>
        <p class="text-xs text-slate-400 truncate">{{ currentTrack.artist }}</p>
      </div>
      <button 
        @click="audioStore.toggleFavorite(currentTrack.id)"
        class="p-2 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-lg text-slate-400 hover:text-rose-500 transition ml-2"
        :class="{'text-rose-500!': isFavorite(currentTrack.id)}"
      >
        <Heart class="w-4 h-4" :class="{'fill-current': isFavorite(currentTrack.id)}" />
      </button>
    </div>

    <!-- Center Control Deck & Progress Timeline -->
    <div class="flex-1 w-full flex flex-col items-center gap-2">
      <!-- Media Keys -->
      <div class="flex items-center gap-5">
        <!-- Shuffle -->
        <button 
          @click="audioStore.toggleShuffle()"
          class="p-2 text-slate-400 hover:text-textMain transition rounded-lg"
          :class="{'text-violet-550!': isShuffling}"
          title="Shuffle"
        >
          <Shuffle class="w-4 h-4" />
        </button>

        <!-- Previous -->
        <button 
          @click="audioStore.prev()"
          class="p-2 text-slate-400 hover:text-textMain transition rounded-lg"
          title="Previous"
        >
          <SkipBack class="w-5 h-5 fill-current" />
        </button>

        <!-- Play/Pause circle -->
        <button 
          @click="audioStore.togglePlay()"
          class="w-11 h-11 bg-violet-600 hover:bg-violet-500 hover:scale-105 active:scale-95 text-white rounded-full flex items-center justify-center transition shadow-lg shadow-violet-500/25"
          title="Play/Pause"
        >
          <Pause v-if="isPlaying" class="w-5 h-5 fill-current" />
          <Play v-else class="w-5 h-5 fill-current translate-x-0.5" />
        </button>

        <!-- Next -->
        <button 
          @click="audioStore.next()"
          class="p-2 text-slate-400 hover:text-textMain transition rounded-lg"
          title="Next"
        >
          <SkipForward class="w-5 h-5 fill-current" />
        </button>

        <!-- Loop -->
        <button 
          @click="audioStore.toggleLoop()"
          class="p-2 text-slate-400 hover:text-textMain transition rounded-lg relative"
          :class="{'text-violet-550!': isLooping !== 'none'}"
          title="Repeat"
        >
          <Repeat class="w-4 h-4" />
          <span v-if="isLooping === 'one'" class="absolute -top-0.5 -right-0.5 bg-violet-500 text-white font-extrabold text-[8px] px-1 rounded-full scale-75">1</span>
        </button>
      </div>

      <!-- Scrubber Line Slider -->
      <div class="w-full max-w-2xl flex items-center gap-3">
        <span class="text-[10px] text-slate-400 font-mono w-10 text-right">{{ formattedTime }}</span>
        
        <!-- Interactive Progress Scrubber -->
        <div 
          @mousedown="startScrub"
          class="flex-1 h-1.5 bg-slate-200 dark:bg-white/10 hover:h-2 rounded-full relative cursor-pointer transition-all group"
          ref="progressBar"
        >
          <!-- Active Filled Bar -->
          <div 
            class="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
            :style="{ width: `${progressPercent}%` }"
          ></div>
          <!-- Drag Handle Knob -->
          <div 
            class="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white border-2 border-violet-500 rounded-full opacity-0 group-hover:opacity-100 transition shadow"
            :style="{ left: `calc(${progressPercent}% - 6px)` }"
          ></div>
        </div>

        <span class="text-[10px] text-slate-400 font-mono w-10 text-left">{{ formattedDuration }}</span>
      </div>
    </div>

    <!-- Right Side Speaker Volume & Quick Settings -->
    <div class="hidden md:flex items-center justify-end gap-3 w-full md:w-1/4">
      <button 
        @click="audioStore.toggleMute()"
        class="p-2 text-slate-400 hover:text-textMain transition rounded-lg"
      >
        <VolumeX v-if="isMuted || volume === 0" class="w-4 h-4 text-rose-500" />
        <Volume1 v-else-if="volume < 0.4" class="w-4 h-4" />
        <Volume2 v-else class="w-4 h-4" />
      </button>
      
      <!-- Volume Slider line -->
      <input 
        type="range" 
        min="0" 
        max="1" 
        step="0.05"
        :value="volume" 
        @input="updateVolume"
        class="w-24 h-1 bg-slate-200 dark:bg-white/10 hover:bg-slate-300 dark:hover:bg-white/20 rounded-lg appearance-none cursor-pointer accent-violet-500 outline-none transition"
      />
    </div>
  </div>
</template>

<script>
import { computed, ref, onUnmounted } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Heart, 
  Volume1, 
  Volume2, 
  VolumeX,
  X 
} from 'lucide-vue-next'

export default {
  name: 'BottomAudioPlayerBar',
  components: {
    Play,
    Pause,
    SkipBack,
    SkipForward,
    Shuffle,
    Repeat,
    Heart,
    Volume1,
    Volume2,
    VolumeX,
    X
  },
  setup() {
    const audioStore = useAudioStore()
    const progressBar = ref(null)
    let isDragging = false

    const isPlaying = computed(() => audioStore.isPlaying)
    const currentTrack = computed(() => audioStore.currentTrack)
    const volume = computed(() => audioStore.volume)
    const isMuted = computed(() => audioStore.isMuted)
    const isLooping = computed(() => audioStore.isLooping)
    const isShuffling = computed(() => audioStore.isShuffling)

    const progressPercent = computed(() => {
      if (audioStore.duration === 0) return 0
      return (audioStore.currentTime / audioStore.duration) * 100
    })

    // REUSABLE TIME FORMATTING HELPER (DRY compliance)
    const formatTime = (secs) => {
      if (isNaN(secs) || secs === null) return '00:00'
      const m = Math.floor(secs / 60)
      const s = Math.floor(secs % 60)
      const mm = m < 10 ? `0${m}` : m
      const ss = s < 10 ? `0${s}` : s
      return `${mm}:${ss}`
    }

    const formattedTime = computed(() => formatTime(audioStore.currentTime))
    const formattedDuration = computed(() => formatTime(audioStore.duration))

    const isFavorite = (trackId) => audioStore.isFavorite(trackId)

    const updateVolume = (e) => {
      audioStore.setVolume(parseFloat(e.target.value))
    }

    // Scrub handling implementation
    const startScrub = (e) => {
      isDragging = true
      scrub(e)
      window.addEventListener('mousemove', scrub)
      window.addEventListener('mouseup', stopScrub)
    }

    const scrub = (e) => {
      if (!isDragging || !progressBar.value || !audioStore.duration) return
      const rect = progressBar.value.getBoundingClientRect()
      const clickX = e.clientX - rect.left
      const width = rect.width
      const percent = Math.max(0, Math.min(1, clickX / width))
      const targetSeconds = percent * audioStore.duration
      audioStore.seek(targetSeconds)
    }

    const stopScrub = () => {
      isDragging = false
      window.removeEventListener('mousemove', scrub)
      window.removeEventListener('mouseup', stopScrub)
    }

    onUnmounted(() => {
      stopScrub()
    })

    return {
      audioStore,
      progressBar,
      isPlaying,
      currentTrack,
      volume,
      isMuted,
      isLooping,
      isShuffling,
      progressPercent,
      formattedTime,
      formattedDuration,
      isFavorite,
      updateVolume,
      startScrub
    }
  }
}
</script>

<style scoped>
/* Custom style parameters for audio range sliders */
input[type="range"]::-webkit-slider-runnable-track {
  background: rgba(120, 120, 120, 0.15);
  height: 4px;
  border-radius: 9999px;
}
input[type="range"]::-webkit-slider-thumb {
  margin-top: -4px;
}
</style>

<!-- Changed on 2026-05-23 20:36:55 -->
