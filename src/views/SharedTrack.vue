<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-themeDark transition-colors duration-300">
    <!-- Fading Loader Card -->
    <div 
      v-if="isLoading" 
      class="glass p-8 rounded-2xl border border-panelBorder bg-panelBg shadow-2xl flex flex-col items-center justify-center text-center max-w-md w-full"
    >
      <Music class="w-12 h-12 text-violet-500 animate-bounce mb-4" />
      <h3 class="text-xl font-bold font-outfit text-textMain mb-1">Resolving Link</h3>
      <p class="text-xs text-slate-400 max-w-xs mb-4">Securing cloud connection and loading audio stream...</p>
      <div class="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
        <div class="h-full bg-gradient-to-r from-violet-500 to-pink-500 animate-pulse w-3/4"></div>
      </div>
    </div>

    <!-- Error/NotFound Banner -->
    <div 
      v-else-if="error" 
      class="glass p-8 rounded-2xl border border-panelBorder bg-panelBg shadow-2xl flex flex-col items-center justify-center text-center max-w-md w-full"
    >
      <ShieldAlert class="w-12 h-12 text-rose-500 mb-4 animate-pulse" />
      <h3 class="text-xl font-bold font-outfit text-textMain mb-1">Link Unresolved</h3>
      <p class="text-xs text-slate-400 max-w-xs mb-6">
        The sharing link might have expired, or this private track has been removed by the owner.
      </p>
      <router-link to="/login" class="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 transition rounded-xl font-bold text-xs text-white shadow-lg shadow-violet-500/25">
        Return to Portal
      </router-link>
    </div>

    <!-- Active Media Shared Player Card -->
    <div 
      v-else-if="track" 
      class="glass p-8 rounded-3xl border border-panelBorder bg-panelBg shadow-2xl max-w-md w-full flex flex-col items-center text-center"
    >
      <!-- Branding Logo top line -->
      <span class="text-[9px] font-extrabold tracking-widest text-violet-500 uppercase mb-6 font-mono">
        Jarir's Music Station Sharing
      </span>

      <!-- Graphical Cover Art and Overlay Play button -->
      <div class="relative w-48 h-48 rounded-2xl overflow-hidden border border-panelBorder shadow-xl mb-6 bg-slate-300 dark:bg-white/5 group">
        <img :src="track.coverUrl || '/logo.png'" alt="Art" class="w-full h-full object-cover group-hover:scale-105 transition duration-300" />
        <button 
          @click="togglePlay"
          class="absolute inset-0 bg-black/35 flex items-center justify-center transition duration-200 text-white"
        >
          <Pause v-if="isActiveTrack && audioStore.isPlaying" class="w-10 h-10 fill-current" />
          <Play v-else class="w-10 h-10 fill-current translate-x-1" />
        </button>
      </div>

      <!-- Description Info -->
      <h2 class="text-2xl font-bold font-outfit text-textMain leading-tight truncate w-full px-2">{{ track.title }}</h2>
      <p class="text-sm text-slate-400 mb-2 truncate w-full px-2">{{ track.artist }}</p>
      <span class="px-2 py-0.5 rounded-full bg-violet-600/10 text-violet-500 text-[9px] font-bold tracking-wide uppercase mb-6">
        {{ track.genre }}
      </span>

      <!-- Scrubber timeline for shared card -->
      <div v-if="isActiveTrack" class="w-full space-y-2 mb-6">
        <div 
          @mousedown="startScrub"
          class="w-full h-1.5 bg-slate-200 dark:bg-white/10 hover:h-2 rounded-full relative cursor-pointer transition-all group"
          ref="progressBar"
        >
          <div 
            class="absolute top-0 left-0 h-full bg-gradient-to-r from-violet-500 to-pink-500 rounded-full"
            :style="{ width: `${progressPercent}%` }"
          ></div>
        </div>
        <div class="flex items-center justify-between text-[10px] text-slate-400 font-mono">
          <span>{{ formattedTime }}</span>
          <span>{{ formattedDuration }}</span>
        </div>
      </div>

      <!-- Footer Buttons -->
      <div class="flex flex-col gap-3 w-full border-t border-panelBorder pt-6">
        <button 
          @click="togglePlay"
          class="w-full py-3 rounded-xl font-bold text-xs text-white shadow-lg transition duration-200 flex items-center justify-center gap-2"
          :class="[
            isActiveTrack && audioStore.isPlaying 
              ? 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20' 
              : 'bg-violet-600 hover:bg-violet-500 shadow-violet-500/20'
          ]"
        >
          <Pause v-if="isActiveTrack && audioStore.isPlaying" class="w-4 h-4 fill-current" />
          <Play v-else class="w-4 h-4 fill-current" />
          {{ isActiveTrack && audioStore.isPlaying ? 'Mute/Pause Track' : 'Stream Shared Track' }}
        </button>

        <router-link to="/" class="w-full py-3 bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 border border-panelBorder rounded-xl font-bold text-xs text-textMain transition text-center">
          Open Global Catalog
        </router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { useAudioStore } from '../stores/audioStore'
import { getCollectionData, getDocumentData, where } from '../firebase'
import { Music, ShieldAlert, Play, Pause } from 'lucide-vue-next'

export default {
  name: 'SharedTrackView',
  components: {
    Music,
    ShieldAlert,
    Play,
    Pause
  },
  setup() {
    const route = useRoute()
    const audioStore = useAudioStore()
    const isLoading = ref(true)
    const error = ref(false)
    const track = ref(null)
    
    const progressBar = ref(null)
    let isDragging = false

    const isActiveTrack = computed(() => {
      return track.value && audioStore.currentTrack?.id === track.value.id
    })

    const progressPercent = computed(() => {
      if (!isActiveTrack.value || audioStore.duration === 0) return 0
      return (audioStore.currentTime / audioStore.duration) * 100
    })

    // DRY: Reusable time formatter
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

    onMounted(async () => {
      const token = route.params.token
      if (!token) {
        error.value = true
        isLoading.value = false
        return
      }

      try {
        // 1. First, search for matches inside the tracks shareToken field
        const matches = await getCollectionData('tracks', [where('shareToken', '==', token)])
        
        if (matches.length > 0) {
          track.value = matches[0]
        } else {
          // 2. Fallback: Search directly by document ID (for public sharing)
          const direct = await getDocumentData('tracks', token)
          if (direct) {
            track.value = direct
          } else {
            error.value = true
          }
        }
      } catch (err) {
        console.error("Shared track resolve error:", err)
        error.value = true
      } finally {
        isLoading.value = false
      }
    })

    const togglePlay = () => {
      if (!track.value) return
      
      if (isActiveTrack.value) {
        audioStore.togglePlay()
      } else {
        // Play track singly (with empty queue list)
        audioStore.playTrack(track.value, [track.value])
      }
    }

    // Scrub handlers
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
      isLoading,
      error,
      track,
      isActiveTrack,
      progressPercent,
      formattedTime,
      formattedDuration,
      progressBar,
      togglePlay,
      startScrub
    }
  }
}
</script>

<!-- Changed on 2026-05-23 19:19:00 -->
