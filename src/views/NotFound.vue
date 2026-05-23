<template>
  <div class="p-4 md:p-8 max-w-2xl mx-auto space-y-8 animate-fade-in flex flex-col items-center justify-center min-h-[80vh]">
    <!-- Immersive 404 Glassmorphic workstation card -->
    <!-- Changed on 2026-05-23 21:04:15 -->
    <div class="glass p-8 md:p-12 rounded-3xl border border-panelBorder bg-panelBg shadow-2xl w-full text-center flex flex-col items-center justify-center relative overflow-hidden group">
      <!-- Glowing background neon blur bubbles -->
      <div class="absolute -top-24 -right-24 w-48 h-48 bg-violet-600/20 rounded-full blur-3xl group-hover:bg-violet-500/30 transition duration-500"></div>
      <div class="absolute -bottom-24 -left-24 w-48 h-48 bg-pink-600/20 rounded-full blur-3xl group-hover:bg-pink-500/30 transition duration-500"></div>

      <div class="relative z-10 flex flex-col items-center">
        <!-- Pulse glowing vinyl/disk icon visual -->
        <div class="w-24 h-24 rounded-full bg-violet-600/10 border border-violet-500/25 flex items-center justify-center mb-6 shadow-xl shadow-violet-500/10 hover:scale-105 active:scale-95 transition duration-300 relative">
          <Disc class="w-12 h-12 text-violet-500 animate-spin" style="animation-duration: 4s;" />
          <span class="absolute -bottom-1 -right-1 bg-pink-500 text-white font-mono font-extrabold text-[10px] px-2 py-0.5 rounded-full border-2 border-panelBorder shadow">404</span>
        </div>

        <h1 class="text-3xl md:text-4xl font-extrabold font-outfit text-textMain tracking-tight mb-3">
          Lost in the <span class="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent">Soundscape?</span>
        </h1>
        
        <p class="text-xs md:text-sm text-slate-400 max-w-sm mb-8 leading-relaxed">
          The track or page you are looking for has drifted off the global playlist. Let's redirect you back to the main console.
        </p>

        <!-- Dynamic Action Deck -->
        <div class="flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
          <!-- Return Home -->
          <router-link 
            to="/"
            class="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-500/25 hover:scale-105 active:scale-95 transition duration-200 cursor-pointer flex items-center justify-center gap-2"
          >
            <Music class="w-4 h-4" />
            Base Station
          </router-link>

          <!-- Toggle Login overlay if guest -->
          <button 
            v-if="!isLoggedIn"
            @click="triggerGlobalLogin"
            class="w-full sm:w-auto px-6 py-2.5 bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 border border-panelBorder text-xs font-bold text-textMain rounded-xl hover:scale-105 active:scale-95 transition duration-200 cursor-pointer flex items-center justify-center gap-2"
          >
            <User class="w-4 h-4 text-slate-400" />
            Sign In / Register
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { onAuthStateChanged } from '../firebase'
import { Disc, Music, User } from 'lucide-vue-next'

export default {
  name: 'NotFound',
  components: {
    Disc,
    Music,
    User
  },
  setup() {
    const isLoggedIn = ref(false)

    onAuthStateChanged(null, (user) => {
      isLoggedIn.value = !!user
    })

    const triggerGlobalLogin = () => {
      window.dispatchEvent(new CustomEvent('open-login-modal'))
    }

    return {
      isLoggedIn,
      triggerGlobalLogin
    }
  }
}
</script>

<style scoped>
.animate-fade-in {
  animation: fadeIn 0.4s ease forwards;
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>

<!-- Changed on 2026-05-23 21:04:15 -->
