<template>
  <div class="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
    <!-- Header banner -->
    <header class="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-panelBorder pb-6">
      <div>
        <h1 class="text-3xl md:text-4xl font-extrabold text-textMain font-outfit tracking-tight">
          Cloud Studio
        </h1>
        <p class="text-xs md:text-sm text-slate-400">
          Listen to dynamic audio, upload custom tracks, adjust equalizers, and comment at exact song timestamps.
        </p>
      </div>

      <!-- Quick Platform Stats & Login Action -->
      <div class="flex items-center gap-4 flex-wrap">
        <div class="glass px-4 py-2 rounded-xl flex items-center gap-3 border border-panelBorder">
          <div class="w-8 h-8 rounded-lg bg-violet-600/10 flex items-center justify-center text-violet-500 font-bold font-mono">
            {{ tracksCount }}
          </div>
          <span class="text-xs text-slate-400 font-medium">Tracks</span>
        </div>

        <!-- Dynamic Sign In Trigger -->
        <button 
          v-if="!currentUser" 
          @click="triggerLoginPopup"
          class="px-5 py-2.5 bg-violet-600 hover:bg-violet-500 transition rounded-xl font-bold text-xs text-white shadow-lg shadow-violet-500/20 flex items-center gap-2 cursor-pointer shrink-0"
        >
          <User class="w-4 h-4" />
          Sign In / Register
        </button>
        <div v-else class="text-xs text-slate-400 font-semibold px-4 py-2.5 rounded-xl border border-panelBorder glass flex items-center gap-2">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          Session Active: {{ currentUser.displayName }}
        </div>
      </div>
    </header>

    <!-- Main Content Dashboard Columns -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
      <!-- Left side: Core library grid (Col span 2) -->
      <section class="lg:col-span-2 space-y-6">
        <h3 class="text-lg font-bold font-outfit text-textMain flex items-center gap-2">
          <Disc class="w-5 h-5 text-violet-500 animate-spin" />
          Music Catalog
        </h3>
        <MusicLibrary ref="library" />
      </section>

      <!-- Right side: Dynamic Visual workstation panels -->
      <section class="space-y-6">
        <!-- 1. Track Comments Drawer (Renders dynamically if a track is playing!) -->
        <TrackDetails v-if="audioStore.currentTrack" />

        <!-- 2. Audio Visualizer Canvas -->
        <AudioVisualizer />

        <!-- 3. Studio Equalizer sliding decks -->
        <AudioEqualizer />

        <!-- 4. Track Uploader studio panel -->
        <TrackUploader @upload-success="reloadLibrary" />
      </section>
    </div>
  </div>
</template>

<script>
// Changed on 2026-05-23 20:22:00
import { ref, computed, onMounted } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import MusicLibrary from '../components/MusicLibrary.vue'
import TrackUploader from '../components/TrackUploader.vue'
import AudioVisualizer from '../components/AudioVisualizer.vue'
import AudioEqualizer from '../components/AudioEqualizer.vue'
import TrackDetails from '../components/TrackDetails.vue'
import { Disc, User } from 'lucide-vue-next'
import { onAuthStateChanged } from '../firebase'

export default {
  name: 'HomeDashboardView',
  components: {
    MusicLibrary,
    TrackUploader,
    AudioVisualizer,
    AudioEqualizer,
    TrackDetails,
    Disc,
    User
  },
  setup() {
    const audioStore = useAudioStore()
    const library = ref(null)
    const currentUser = ref(null)

    const tracksCount = computed(() => audioStore.tracks.length)

    onAuthStateChanged(null, (user) => {
      currentUser.value = user
    })

    onMounted(async () => {
      await audioStore.loadTracks()
    })

    const reloadLibrary = async () => {
      await audioStore.loadTracks()
    }

    const triggerLoginPopup = () => {
      window.dispatchEvent(new CustomEvent('open-login-modal'))
    }

    return {
      audioStore,
      library,
      tracksCount,
      reloadLibrary,
      currentUser,
      triggerLoginPopup
    }
  }
}
</script>

<!-- Changed on 2026-05-23 20:22:00 -->
