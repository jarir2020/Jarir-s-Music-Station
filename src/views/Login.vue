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
import { signInWithEmailAndPassword } from '../firebase'

export default {
  name: 'LoginView',
  setup() {
    const router = useRouter()
    const email = ref('')
    const password = ref('')
    const isLoading = ref(false)
    const errorMessage = ref('')

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
      handleLogin
    }
  }
}
</script>

<!-- Changed on 2026-05-23 20:05:00 -->

