<template>
  <div class="min-h-screen flex items-center justify-center p-6 bg-themeDark transition-colors duration-300">
    <div class="glass w-full max-w-md p-8 rounded-2xl border border-white/10 shadow-2xl">
      <h2 class="text-3xl font-bold font-outfit text-white text-center mb-6">Sign In</h2>
      
      <!-- Error Alert Message -->
      <div 
        v-if="errorMessage" 
        class="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2 animate-fade-in"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0"></span>
        {{ errorMessage }}
      </div>

      <!-- OAuth buttons — Added on 2026-05-24 00:32:00 -->
      <!-- Hidden until provider creds configured in Supabase dashboard. See docs/OAUTH_SETUP.md -->
      <div v-if="showOAuth" class="space-y-2 mb-5">
        <button type="button" @click="handleOAuth('google')" :disabled="isLoading" class="oauth-btn">
          <svg viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true">
            <path fill="#EA4335" d="M12 11v3.2h5.3c-.2 1.4-1.6 4-5.3 4-3.2 0-5.8-2.6-5.8-5.9S8.8 6.4 12 6.4c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.6 3.9 14.5 3 12 3 7 3 3 7 3 12s4 9 9 9c5.2 0 8.6-3.6 8.6-8.8 0-.6-.1-1-.2-1.2H12z"/>
          </svg>
          <span>Continue with Google</span>
        </button>
        <button type="button" @click="handleOAuth('github')" :disabled="isLoading" class="oauth-btn">
          <Github class="w-4 h-4" />
          <span>Continue with GitHub</span>
        </button>
        <button type="button" @click="handleOAuth('facebook')" :disabled="isLoading" class="oauth-btn">
          <svg viewBox="0 0 24 24" class="w-4 h-4" aria-hidden="true">
            <path fill="#1877F2" d="M24 12a12 12 0 1 0-13.9 11.9v-8.4H7v-3.5h3.1V9.4c0-3 1.8-4.7 4.6-4.7 1.3 0 2.7.2 2.7.2v3h-1.5c-1.5 0-2 .9-2 1.9V12H17l-.5 3.5h-2.9v8.4A12 12 0 0 0 24 12z"/>
          </svg>
          <span>Continue with Facebook</span>
        </button>
      </div>

      <div v-if="showOAuth" class="flex items-center gap-2 text-[10px] uppercase tracking-wider text-slate-500 mb-5">
        <div class="flex-1 h-px bg-white/10"></div>
        <span>or with email</span>
        <div class="flex-1 h-px bg-white/10"></div>
      </div>

      <form @submit.prevent="handleLogin" class="space-y-5">
        <div>
          <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
          <input 
            type="email" 
            v-model="email"
            required
            placeholder="you@example.com" 
            class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500 transition placeholder:text-slate-500 text-sm" 
          />
        </div>
        <div>
          <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Password</label>
          <input 
            type="password" 
            v-model="password"
            required
            placeholder="••••••••" 
            class="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-violet-500 transition placeholder:text-slate-500 text-sm" 
          />
        </div>
        
        <button 
          type="submit" 
          :disabled="isLoading"
          class="w-full py-3 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 transition rounded-xl font-bold text-white shadow-lg shadow-violet-500/25 cursor-pointer text-sm flex items-center justify-center gap-2"
        >
          <span v-if="isLoading" class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
          {{ isLoading ? 'Connecting...' : 'Access Music Station' }}
        </button>
      </form>
      
      <div class="mt-6 text-center text-sm text-slate-400">
        Don't have an account? <router-link to="/about" class="text-violet-400 hover:underline">Explore features</router-link>
      </div>
    </div>
  </div>
</template>

<script>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Github } from 'lucide-vue-next'
import { signInWithEmailAndPassword, signInWithOAuth } from '../firebase'

export default {
  name: 'LoginView',
  components: { Github },
  setup() {
    const router = useRouter()
    const email = ref('')
    const password = ref('')
    const isLoading = ref(false)
    const errorMessage = ref('')
    // OAuth feature flag — see docs/OAUTH_SETUP.md
    const showOAuth = ref(false)

    const handleOAuth = async (provider) => {
      isLoading.value = true
      errorMessage.value = ''
      try {
        await signInWithOAuth(provider)
      } catch (err) {
        errorMessage.value = err.message || `Sign-in with ${provider} failed.`
        isLoading.value = false
      }
    }

    const handleLogin = async () => {
      isLoading.value = true
      errorMessage.value = ''
      try {
        await signInWithEmailAndPassword(email.value.trim(), password.value)
        router.push({ name: 'Home' })
      } catch (err) {
        console.error("Login failed:", err)
        errorMessage.value = err.message || "Invalid credentials. Please try again."
      } finally {
        isLoading.value = false
      }
    }

    return {
      email,
      password,
      isLoading,
      errorMessage,
      handleLogin,
      handleOAuth,
      showOAuth
    }
  }
}
</script>

<!-- Changed on 2026-05-24 00:32:00 — OAuth buttons added -->

<style scoped>
.oauth-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: #fff;
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}
.oauth-btn:hover:not(:disabled) { background: rgba(255,255,255,0.1); }
.oauth-btn:disabled { opacity: 0.5; cursor: not-allowed; }
</style>

