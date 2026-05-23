<template>
  <div class="p-4 md:p-8 max-w-7xl mx-auto space-y-8">
    <!-- Header banner -->
    <header class="flex items-center gap-3 border-b border-panelBorder pb-6">
      <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
        <ShieldAlert class="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 class="text-3xl font-extrabold text-textMain font-outfit tracking-tight">Admin Console</h1>
        <p class="text-xs md:text-sm text-slate-400">Dynamic uploader decks and brand content configurations.</p>
      </div>
    </header>

    <!-- Content Workspace -->
    <div class="glass p-6 md:p-8 rounded-3xl border border-panelBorder bg-panelBg shadow-xl space-y-6">
      <!-- Tabs Selector bar -->
      <div class="flex items-center border-b border-panelBorder gap-4">
        <button 
          @click="activeTab = 'audio'"
          class="pb-3 text-sm font-bold border-b-2 transition duration-200 cursor-pointer"
          :class="[activeTab === 'audio' ? 'border-violet-500 text-violet-500' : 'border-transparent text-slate-400 hover:text-textMain']"
        >
          Audio Studio
        </button>
        <button 
          @click="activeTab = 'about'"
          class="pb-3 text-sm font-bold border-b-2 transition duration-200 cursor-pointer"
          :class="[activeTab === 'about' ? 'border-violet-500 text-violet-500' : 'border-transparent text-slate-400 hover:text-textMain']"
        >
          Platform Settings
        </button>
      </div>

      <!-- Toast success indicator -->
      <div 
        v-if="toastMessage" 
        class="fixed top-6 right-6 z-50 px-4 py-3 bg-emerald-600 text-white font-semibold rounded-xl shadow-lg flex items-center gap-2 animate-fade-in-down"
      >
        <Check class="w-4 h-4" />
        <span class="text-xs">{{ toastMessage }}</span>
      </div>

      <!-- Tab 1: Audio Studio (Renders uploader stacked) -->
      <div v-if="activeTab === 'audio'" class="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        <div class="lg:col-span-2 space-y-4">
          <h3 class="text-lg font-bold font-outfit text-textMain">Active Upload Studio</h3>
          <p class="text-xs text-slate-400">
            Publish custom music files to the cloud. Public files will instantly register inside the Global Discovery catalog.
          </p>
          <TrackUploader @upload-success="handleUploadSuccess" />
        </div>
      </div>

      <!-- Tab 2: Dynamic About Us Settings Editor -->
      <div v-else-if="activeTab === 'about'" class="space-y-6 max-w-2xl">
        <h3 class="text-lg font-bold font-outfit text-textMain">Branding Configurator</h3>
        <p class="text-xs text-slate-400">
          Edit general description columns dynamically. Updates will propagate immediately across user feeds.
        </p>

        <form @submit.prevent="saveAboutUs" class="space-y-4">
          <!-- Title -->
          <div>
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">About Page Title</label>
            <input 
              type="text" 
              v-model="aboutForm.title" 
              placeholder="e.g. About Our Station" 
              class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Dynamic Description Column</label>
            <textarea 
              v-model="aboutForm.description" 
              rows="4"
              placeholder="Enter main text..." 
              class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm leading-relaxed"
            ></textarea>
          </div>

          <!-- Mission -->
          <div>
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Mission Statement</label>
            <textarea 
              v-model="aboutForm.mission" 
              rows="2"
              placeholder="Enter mission statements..." 
              class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm leading-relaxed"
            ></textarea>
          </div>

          <!-- Email -->
          <div>
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Support/Contact Email</label>
            <input 
              type="email" 
              v-model="aboutForm.contactEmail" 
              placeholder="e.g. support@music-station.com" 
              class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm"
            />
          </div>

          <!-- Submit Button -->
          <div class="flex justify-end gap-2 pt-2">
            <button 
              type="submit" 
              :disabled="isSaving"
              class="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-lg shadow-violet-500/25 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Loader2 v-if="isSaving" class="w-4 h-4 animate-spin" />
              Save Platform Info
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, reactive, onMounted } from 'vue'
import { getDocumentData, saveDocumentData } from '../firebase'
import TrackUploader from '../components/TrackUploader.vue'
import { ShieldAlert, Check, Loader2 } from 'lucide-vue-next'

export default {
  name: 'AdminDashboardPanel',
  components: {
    TrackUploader,
    ShieldAlert,
    Check,
    Loader2
  },
  setup() {
    const activeTab = ref('audio')
    const toastMessage = ref('')
    const isSaving = ref(false)

    const aboutForm = reactive({
      title: '',
      description: '',
      mission: '',
      contactEmail: ''
    })

    // Fetch existing About Us fields on mounted
    const fetchAboutData = async () => {
      try {
        const data = await getDocumentData('settings', 'aboutUs')
        if (data) {
          aboutForm.title = data.title || ''
          aboutForm.description = data.description || ''
          aboutForm.mission = data.mission || ''
          aboutForm.contactEmail = data.contactEmail || ''
        }
      } catch (err) {
        console.error("Error loading settings:", err)
      }
    }

    onMounted(() => {
      fetchAboutData()
    })

    const handleUploadSuccess = () => {
      toastMessage.value = 'Track uploaded successfully!'
      setTimeout(() => {
        toastMessage.value = ''
      }, 3000)
    }

    const saveAboutUs = async () => {
      isSaving.value = true
      try {
        await saveDocumentData('settings', 'aboutUs', {
          title: aboutForm.title.trim(),
          description: aboutForm.description.trim(),
          mission: aboutForm.mission.trim(),
          contactEmail: aboutForm.contactEmail.trim(),
          updatedAt: new Date().toISOString(),
          updatedBy: 'mock_admin_uid'
        })
        
        toastMessage.value = 'Branding configurations saved!'
        setTimeout(() => {
          toastMessage.value = ''
        }, 3000)
      } catch (err) {
        console.error("Error saving settings:", err)
      } finally {
        isSaving.value = false
      }
    }

    return {
      activeTab,
      toastMessage,
      isSaving,
      aboutForm,
      handleUploadSuccess,
      saveAboutUs
    }
  }
}
</script>

<style scoped>
@keyframes fadeInDown {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
.animate-fade-in-down {
  animation: fadeInDown 0.3s ease forwards;
}
</style>

<!-- Changed on 2026-05-23 19:22:00 -->
