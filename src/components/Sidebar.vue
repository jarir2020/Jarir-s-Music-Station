<template>
  <aside 
    class="fixed top-0 left-0 h-screen z-30 transition-all duration-300 ease-in-out border-r border-panelBorder bg-themeDark/80 backdrop-blur-xl flex flex-col justify-between"
    :class="[isCollapsed ? 'w-20' : 'w-64']"
  >
    <!-- Top Branding Header -->
    <div class="p-6 flex items-center justify-between border-b border-panelBorder">
      <div v-if="!isCollapsed" class="flex items-center gap-3 animate-fade-in">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Music class="w-5 h-5 text-white" />
        </div>
        <span class="font-outfit font-extrabold text-lg bg-clip-text text-transparent bg-gradient-to-r from-violet-400 to-pink-400">
          Jarir's Station
        </span>
      </div>
      <div v-else class="mx-auto">
        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center shadow-lg">
          <Music class="w-5 h-5 text-white" />
        </div>
      </div>
      
      <!-- Collapse toggle button -->
      <button 
        @click="toggleCollapse"
        class="hidden md:block p-1.5 hover:bg-slate-200/50 dark:hover:bg-white/10 rounded-lg text-slate-400 hover:text-textMain transition"
      >
        <ChevronLeft v-if="!isCollapsed" class="w-4 h-4" />
        <ChevronRight v-else class="w-4 h-4" />
      </button>
    </div>

    <!-- Navigation Menu list -->
    <nav class="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
      <router-link 
        v-for="item in menuItems" 
        :key="item.path" 
        :to="item.path"
        v-show="!item.adminOnly || isAdmin"
        class="flex items-center gap-4 px-4 py-3 rounded-xl transition duration-200 group text-slate-400 hover:text-textMain hover:bg-slate-200/40 dark:hover:bg-white/5"
        active-class="bg-gradient-to-r from-violet-600/20 to-pink-600/10 border border-violet-500/30 text-textMain! font-semibold"
      >
        <component :is="item.icon" class="w-5 h-5 group-hover:scale-110 transition duration-200" />
        <span v-if="!isCollapsed" class="font-medium text-sm">{{ item.name }}</span>
      </router-link>
    </nav>

    <!-- Bottom User Profile Card / Action -->
    <div class="p-4 border-t border-panelBorder space-y-3">
      <!-- Dark/Light Theme Switcher Toggler -->
      <button 
        @click="toggleTheme"
        class="w-full flex items-center gap-4 px-4 py-2.5 rounded-xl text-slate-400 hover:text-textMain hover:bg-slate-200/40 dark:hover:bg-white/5 transition duration-200 group"
        title="Toggle Theme"
      >
        <Sun v-if="isDarkMode" class="w-5 h-5 text-amber-500 group-hover:rotate-45 transition duration-300" />
        <Moon v-else class="w-5 h-5 text-violet-500 group-hover:-rotate-12 transition duration-300" />
        <span v-if="!isCollapsed" class="text-sm font-medium">
          {{ isDarkMode ? 'Light Mode' : 'Dark Mode' }}
        </span>
      </button>

      <div class="flex items-center gap-3 p-2 rounded-xl bg-slate-200/40 dark:bg-white/5 border border-panelBorder">
        <div class="w-8 h-8 rounded-full bg-violet-600 flex items-center justify-center font-bold text-white uppercase shadow-sm shrink-0">
          {{ userInitials }}
        </div>
        <div v-if="!isCollapsed" class="flex-1 min-w-0">
          <p class="text-xs font-semibold text-textMain truncate">{{ userDisplayName }}</p>
          <p class="text-[10px] text-slate-400 truncate">{{ userRole }}</p>
        </div>
        <button 
          v-if="!isCollapsed" 
          @click="handleAuthAction"
          class="p-1.5 hover:bg-slate-200/50 dark:hover:bg-white/10 rounded-lg transition shrink-0"
          :class="[currentUser ? 'text-slate-400 hover:text-rose-500' : 'text-violet-500 hover:text-violet-400']"
          :title="currentUser ? 'Sign Out' : 'Sign In'"
        >
          <LogOut v-if="currentUser" class="w-4 h-4" />
          <LogIn v-else class="w-4 h-4" />
        </button>
      </div>
    </div>
  </aside>
</template>

<script>
// Changed on 2026-05-23 20:08:20
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { 
  Music, 
  Compass, 
  Info, 
  ShieldAlert, 
  LogOut, 
  LogIn,
  ChevronLeft, 
  ChevronRight,
  Sun,
  Moon
} from 'lucide-vue-next'
import { onAuthStateChanged, signOut } from '../firebase'

export default {
  name: 'SidebarNavigation',
  components: {
    Music,
    ChevronLeft,
    ChevronRight,
    LogOut,
    LogIn,
    Sun,
    Moon
  },
  setup() {
    const router = useRouter()
    const isCollapsed = ref(false)
    const isDarkMode = ref(localStorage.getItem('theme') !== 'light')
    const currentUser = ref(null)

    onAuthStateChanged(null, (user) => {
      currentUser.value = user
    })

    const isAdmin = computed(() => {
      return currentUser.value && currentUser.value.role === 'admin'
    })

    const menuItems = [
      { name: 'Global Library', path: '/', icon: Compass, adminOnly: false },
      { name: 'About Platform', path: '/about', icon: Info, adminOnly: false },
      { name: 'Admin Studio', path: '/admin', icon: ShieldAlert, adminOnly: true }
    ]

    const toggleCollapse = () => {
      isCollapsed.value = !isCollapsed.value
    }

    const toggleTheme = () => {
      isDarkMode.value = !isDarkMode.value
      if (isDarkMode.value) {
        document.documentElement.classList.add('dark')
        localStorage.setItem('theme', 'dark')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('theme', 'light')
      }
    }

    const userDisplayName = computed(() => {
      return currentUser.value ? currentUser.value.displayName : 'Guest Listener'
    })

    const userRole = computed(() => {
      return currentUser.value ? (currentUser.value.role === 'admin' ? 'Site Administrator' : 'Listener') : 'Free Guest Preview'
    })

    const userInitials = computed(() => {
      const name = userDisplayName.value
      return name ? name.charAt(0).toUpperCase() : 'G'
    })

    // Changed on 2026-05-23 21:02:45
    const handleAuthAction = async () => {
      if (currentUser.value) {
        await signOut()
        router.push('/')
      } else {
        window.dispatchEvent(new CustomEvent('open-login-modal'))
      }
    }

    return {
      isCollapsed,
      isAdmin,
      menuItems,
      toggleCollapse,
      userDisplayName,
      userRole,
      userInitials,
      currentUser,
      handleAuthAction,
      isDarkMode,
      toggleTheme
    }
  }
}
</script>

<!-- Changed on 2026-05-23 20:08:20 -->

