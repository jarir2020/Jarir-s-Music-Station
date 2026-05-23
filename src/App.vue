<template>
  <div id="app" class="min-h-screen bg-themeDark text-textMain font-sans antialiased selection:bg-violet-600 selection:text-white flex overflow-x-hidden transition-colors duration-300">
    <!-- Left Navigation Sidebar - Hide on Auth/Secure share screens -->
    <Sidebar v-if="showSidebar" />

    <!-- Right Side Content Container -->
    <div 
      class="flex-1 min-h-screen flex flex-col justify-between transition-all duration-300 w-full"
      :class="[showSidebar ? 'pl-20 md:pl-64' : 'pl-0']"
    >
      <main class="flex-1 w-full pb-32">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </main>

      <!-- Sticky Floating Playback Console -->
      <BottomPlayer />
    </div>

    <!-- Tabbed Login / Register Modal Popup (Global) -->
    <div 
      v-if="showLoginModal" 
      class="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-fade-in"
    >
      <div class="glass w-full max-w-md p-8 rounded-2xl border border-panelBorder bg-panelBg shadow-2xl relative space-y-6 animate-scale-up text-textMain">
        <!-- Close x button -->
        <button 
          @click="closeModal" 
          class="absolute top-4 right-4 text-slate-400 hover:text-textMain p-1 hover:bg-slate-200/50 dark:hover:bg-white/10 rounded-lg transition cursor-pointer"
        >
          <X class="w-5 h-5" />
        </button>

        <!-- Tab headers -->
        <div class="flex border-b border-panelBorder p-1 bg-slate-200/50 dark:bg-white/5 rounded-xl">
          <button 
            @click="activeModalTab = 'signin'" 
            class="flex-1 py-2 text-xs font-bold transition rounded-lg"
            :class="[activeModalTab === 'signin' ? 'bg-violet-600 text-white shadow' : 'text-slate-500 hover:text-textMain dark:text-slate-400 dark:hover:text-white']"
          >
            Sign In
          </button>
          <button 
            @click="activeModalTab = 'register'" 
            class="flex-1 py-2 text-xs font-bold transition rounded-lg"
            :class="[activeModalTab === 'register' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-white']"
          >
            Create Account
          </button>
        </div>

        <!-- Alert messages -->
        <div 
          v-if="modalError" 
          class="p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-fade-in"
        >
          <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
          {{ modalError }}
        </div>

        <!-- Form: Sign In -->
        <form v-if="activeModalTab === 'signin'" @submit.prevent="handleModalLogin" class="space-y-4">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <input 
              type="email" 
              v-model="loginEmail" 
              required 
              placeholder="you@example.com" 
              class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 animate-fade-in" 
            />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input 
              type="password" 
              v-model="loginPassword" 
              required 
              placeholder="••••••••" 
              class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 animate-fade-in" 
            />
          </div>
          <button 
            type="submit" 
            :disabled="modalLoading"
            class="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition rounded-xl font-bold text-white shadow-lg shadow-violet-500/25 cursor-pointer text-sm flex items-center justify-center gap-2"
          >
            <span v-if="modalLoading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ modalLoading ? 'Connecting...' : 'Sign In' }}
          </button>
        </form>

        <!-- Form: Register -->
        <form v-else @submit.prevent="handleModalRegister" class="space-y-4">
          <div>
            <label class="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">Username</label>
            <input 
              type="text" 
              v-model="registerUsername" 
              required 
              placeholder="musician2026" 
              class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 animate-fade-in" 
            />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
            <input 
              type="email" 
              v-model="registerEmail" 
              required 
              placeholder="you@example.com" 
              class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 animate-fade-in" 
            />
          </div>
          <div>
            <label class="block text-[10px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider mb-2">Password</label>
            <input 
              type="password" 
              v-model="registerPassword" 
              required 
              placeholder="••••••••" 
              class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm placeholder:text-slate-400 dark:placeholder:text-slate-500 animate-fade-in" 
            />
          </div>
          <button 
            type="submit" 
            :disabled="modalLoading"
            class="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition rounded-xl font-bold text-white shadow-lg shadow-violet-500/25 cursor-pointer text-sm flex items-center justify-center gap-2"
          >
            <span v-if="modalLoading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            {{ modalLoading ? 'Creating Account...' : 'Register' }}
          </button>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
// Changed on 2026-05-23 20:21:30
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import Sidebar from './components/Sidebar.vue'
import BottomPlayer from './components/BottomPlayer.vue'
import { Music, X } from 'lucide-vue-next'
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from './firebase'

export default {
  name: 'App',
  components: {
    Sidebar,
    BottomPlayer,
    Music,
    X
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const showLoginModal = ref(false)
    const activeModalTab = ref('signin')
    const modalLoading = ref(false)
    const modalError = ref('')
    const currentUser = ref(null)

    // Form inputs
    const loginEmail = ref('')
    const loginPassword = ref('')
    const registerUsername = ref('')
    const registerEmail = ref('')
    const registerPassword = ref('')

    // Reusable router route matcher for layout views
    const showSidebar = computed(() => {
      const excludedNames = ['Login', 'SharedTrack']
      return route.name && !excludedNames.includes(route.name)
    })

    const openLogin = () => {
      showLoginModal.value = true
      activeModalTab.value = 'signin'
    }

    const closeModal = () => {
      showLoginModal.value = false
      modalError.value = ''
      loginEmail.value = ''
      loginPassword.value = ''
      registerUsername.value = ''
      registerEmail.value = ''
      registerPassword.value = ''
    }

    const handleModalLogin = async () => {
      modalLoading.value = true
      modalError.value = ''
      try {
        await signInWithEmailAndPassword(loginEmail.value.trim(), loginPassword.value)
        closeModal()
      } catch (err) {
        modalError.value = err.message || "Invalid credentials."
      } finally {
        modalLoading.value = false
      }
    }

    const handleModalRegister = async () => {
      modalLoading.value = true
      modalError.value = ''
      try {
        await createUserWithEmailAndPassword(
          registerEmail.value.trim(), 
          registerPassword.value, 
          registerUsername.value.trim()
        )
        closeModal()
      } catch (err) {
        modalError.value = err.message || "Registration failed."
      } finally {
        modalLoading.value = false
      }
    }

    onMounted(() => {
      window.addEventListener('show-signin-prompt', openLogin)
      window.addEventListener('open-login-modal', openLogin)
    })

    onUnmounted(() => {
      window.removeEventListener('show-signin-prompt', openLogin)
      window.removeEventListener('open-login-modal', openLogin)
    })

    onAuthStateChanged(null, (user) => {
      currentUser.value = user
    })

    // Hydrate theme on startup
    const savedTheme = localStorage.getItem('theme') || 'dark'
    if (savedTheme === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }

    return {
      showSidebar,
      showLoginModal,
      activeModalTab,
      modalLoading,
      modalError,
      loginEmail,
      loginPassword,
      registerUsername,
      registerEmail,
      registerPassword,
      closeModal,
      handleModalLogin,
      handleModalRegister
    }
  }
}
</script>

<style>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
@keyframes scaleUp {
  from { transform: scale(0.95); opacity: 0; }
  to { transform: scale(1); opacity: 1; }
}
.animate-fade-in {
  animation: fadeIn 0.25s ease forwards;
}
.animate-scale-up {
  animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
</style>


