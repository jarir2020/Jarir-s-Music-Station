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

        <!-- OAuth buttons (Google / GitHub / Facebook) — Added on 2026-05-24 00:30:00 -->
        <!-- Hidden until provider creds configured in Supabase dashboard. See docs/OAUTH_SETUP.md -->
        <div v-if="showOAuth" class="space-y-2">
          <button
            type="button"
            @click="handleOAuth('google')"
            :disabled="modalLoading"
            class="oauth-btn"
          >
            <svg viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true">
              <path fill="#EA4335" d="M12 11v3.2h5.3c-.2 1.4-1.6 4-5.3 4-3.2 0-5.8-2.6-5.8-5.9S8.8 6.4 12 6.4c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 3.9 14.5 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.6 8.6-8.8 0-.6-.1-1-.2-1.2H12z"/>
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            @click="handleOAuth('github')"
            :disabled="modalLoading"
            class="oauth-btn"
          >
            <Github class="w-4 h-4" />
            <span>Continue with GitHub</span>
          </button>

          <button
            type="button"
            @click="handleOAuth('facebook')"
            :disabled="modalLoading"
            class="oauth-btn"
          >
            <svg viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true">
              <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7v-3.5h3.1V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12H17l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/>
            </svg>
            <span>Continue with Facebook</span>
          </button>
        </div>

        <div v-if="showOAuth" class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500">
          <div class="flex-1 h-px bg-panelBorder"></div>
          <span>or with email</span>
          <div class="flex-1 h-px bg-panelBorder"></div>
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
import { Music, X, Github } from 'lucide-vue-next'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithOAuth
} from './firebase'

export default {
  name: 'App',
  components: {
    Sidebar,
    BottomPlayer,
    Music,
    X,
    Github
  },
  setup() {
    const route = useRoute()
    const router = useRouter()
    const showLoginModal = ref(false)
    const activeModalTab = ref('signin')
    // OAuth feature flag — flip to true once providers configured in Supabase.
    // Setup guide: docs/OAUTH_SETUP.md
    const showOAuth = ref(false)
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

    // OAuth handler — Added on 2026-05-24 00:30:00
    const handleOAuth = async (provider) => {
      modalLoading.value = true
      modalError.value = ''
      try {
        await signInWithOAuth(provider)
        // Redirect happens; flow continues after browser returns.
      } catch (err) {
        modalError.value = err.message || `Sign-in with ${provider} failed.`
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
      handleModalRegister,
      handleOAuth,
      showOAuth
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

/* OAuth provider buttons — Added on 2026-05-24 00:30:00, fixed 2026-05-24 00:50:00 */
.oauth-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.oauth-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.1);
}
.oauth-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>


