<template>
  <div class="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
    <!-- Header banner -->
    <header class="flex items-center gap-3 border-b border-panelBorder pb-6">
      <div class="w-12 h-12 rounded-xl bg-gradient-to-tr from-violet-600 to-pink-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
        <Info class="w-6 h-6 text-white" />
      </div>
      <div>
        <h1 class="text-3xl font-extrabold text-textMain font-outfit tracking-tight">Platform Information</h1>
        <p class="text-xs md:text-sm text-slate-400">Discover our story, mission, and dynamic collaborative frameworks.</p>
      </div>
    </header>

    <!-- Fading loader -->
    <div v-if="isLoading" class="glass p-12 rounded-3xl border border-panelBorder bg-panelBg text-center flex flex-col items-center justify-center min-h-[300px]">
      <Loader2 class="w-10 h-10 text-violet-500 animate-spin mb-3" />
      <span class="text-xs text-slate-400">Syncing brand configurations...</span>
    </div>

    <!-- Active dynamic branding cards -->
    <div v-else class="grid grid-cols-1 md:grid-cols-3 gap-8 items-start">
      <!-- Left side: Description columns (Col span 2) -->
      <div class="md:col-span-2 space-y-6">
        <div class="glass p-6 md:p-8 rounded-3xl border border-panelBorder bg-panelBg shadow-xl">
          <h2 class="text-2xl font-bold font-outfit text-textMain mb-4">{{ platformInfo.title }}</h2>
          <p class="text-sm text-slate-300 dark:text-slate-300 leading-relaxed whitespace-pre-line break-words">{{ platformInfo.description }}</p>
        </div>

        <div v-if="platformInfo.mission" class="glass p-6 md:p-8 rounded-3xl border border-panelBorder bg-panelBg shadow-xl space-y-3">
          <h3 class="text-base font-bold font-outfit text-textMain uppercase tracking-wide flex items-center gap-2">
            <Compass class="w-5 h-5 text-violet-500" />
            Our Core Vision
          </h3>
          <p class="text-xs md:text-sm text-slate-400 leading-relaxed">{{ platformInfo.mission }}</p>
        </div>
      </div>

      <!-- Right side: Contact Columns -->
      <div class="space-y-6">
        <div class="glass p-6 rounded-3xl border border-panelBorder bg-panelBg shadow-xl space-y-4">
          <h3 class="text-base font-bold font-outfit text-textMain uppercase tracking-wide flex items-center gap-2">
            <Mail class="w-5 h-5 text-violet-500" />
            Get in Touch
          </h3>
          <p class="text-xs text-slate-400 leading-relaxed">
            Have questions, feedback, or want to contribute to the music station? Write to us directly!
          </p>
          <div v-if="platformInfo.contactEmail" class="p-3 rounded-xl bg-violet-600/10 border border-violet-500/20 text-center">
            <a :href="'mailto:' + platformInfo.contactEmail" class="text-xs font-bold text-violet-500 hover:underline break-all">
              {{ platformInfo.contactEmail }}
            </a>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, onMounted } from 'vue'
import { getDocumentData } from '../firebase'
import { Info, Compass, Mail, Loader2 } from 'lucide-vue-next'

export default {
  name: 'AboutUsView',
  components: {
    Info,
    Compass,
    Mail,
    Loader2
  },
  setup() {
    const isLoading = ref(true)
    const platformInfo = ref({
      title: '',
      description: '',
      mission: '',
      contactEmail: ''
    })

    onMounted(async () => {
      try {
        const data = await getDocumentData('settings', 'aboutUs')
        if (data) {
          platformInfo.value = {
            title: data.title || "About Jarir's Music Station",
            description: data.description || '',
            mission: data.mission || '',
            contactEmail: data.contactEmail || ''
          }
        }
      } catch (err) {
        console.error("Error loading brand settings:", err)
      } finally {
        isLoading.value = false
      }
    })

    return {
      isLoading,
      platformInfo
    }
  }
}
</script>

<!-- Changed on 2026-05-23 19:22:00 -->
