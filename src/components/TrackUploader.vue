<template>
  <!-- Locked state for guests -->
  <!-- Changed on 2026-05-23 20:41:00 -->
  <div 
    v-if="!isLoggedIn" 
    class="glass p-8 rounded-2xl border border-panelBorder bg-panelBg shadow-xl flex flex-col items-center justify-center text-center min-h-[300px] relative overflow-hidden group"
  >
    <!-- Glowing background neon accent -->
    <div class="absolute -top-12 -right-12 w-32 h-32 bg-violet-600/20 rounded-full blur-3xl group-hover:bg-violet-500/30 transition duration-500"></div>
    <div class="absolute -bottom-12 -left-12 w-32 h-32 bg-pink-600/20 rounded-full blur-3xl group-hover:bg-pink-500/30 transition duration-500"></div>

    <div class="relative z-10 flex flex-col items-center">
      <!-- Animated Lock icon circle -->
      <div class="w-16 h-16 rounded-full bg-violet-600/10 border border-violet-500/25 flex items-center justify-center mb-5 shadow-lg shadow-violet-500/5 group-hover:scale-110 transition duration-300">
        <Lock class="w-7 h-7 text-violet-500 animate-pulse" />
      </div>

      <h3 class="text-xl font-bold font-outfit text-textMain mb-2">Upload Studio Locked</h3>
      <p class="text-xs text-slate-400 max-w-xs mb-6 leading-relaxed">
        Unlock your personal cloud studio! Sign in to publish tracks, curate private databases, and share timed highlights with the community.
      </p>

      <!-- Glowing login trigger button -->
      <button 
        @click="triggerGlobalLogin"
        class="px-6 py-2.5 bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-violet-500/25 hover:scale-105 active:scale-95 transition duration-200 cursor-pointer"
      >
        Sign In / Register
      </button>
    </div>
  </div>

  <div v-else class="glass p-6 rounded-2xl border border-panelBorder bg-panelBg shadow-xl">
    <h3 class="text-xl font-bold font-outfit text-textMain mb-4 flex items-center gap-2">
      <Upload class="w-5 h-5 text-violet-500" />
      Upload Studio
    </h3>

    <!-- Step 1: File drop deck -->
    <div v-if="!audioFile" class="space-y-4">
      <div 
        @dragover.prevent="isDragging = true"
        @dragleave.prevent="isDragging = false"
        @drop.prevent="handleDrop"
        class="border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center transition duration-200 cursor-pointer min-h-[180px]"
        :class="[
          isDragging 
            ? 'border-violet-500 bg-violet-500/10' 
            : 'border-panelBorder hover:border-violet-500 hover:bg-slate-200/20 dark:hover:bg-white/5'
        ]"
        @click="triggerFileInput"
      >
        <Music class="w-10 h-10 text-slate-400 mb-3 animate-bounce" />
        <p class="text-sm font-semibold text-textMain text-center mb-1">Drag & drop your audio track here</p>
        <p class="text-xs text-slate-400 text-center">Supports MP3, WAV, or OGG (Max 10MB)</p>
        
        <input 
          type="file" 
          ref="fileInput" 
          accept="audio/*" 
          class="hidden" 
          @change="handleFileSelect" 
        />
      </div>
      <p v-if="error" class="text-xs text-rose-500 font-semibold">{{ error }}</p>
    </div>

    <!-- Step 2: Track uploader form -->
    <div v-else class="space-y-4">
      <div class="flex items-center justify-between p-3 rounded-xl bg-violet-600/10 border border-violet-500/20">
        <div class="flex items-center gap-3 min-w-0">
          <Music class="w-5 h-5 text-violet-500 shrink-0" />
          <span class="text-xs text-textMain truncate font-medium">{{ audioFile.name }}</span>
        </div>
        <button 
          @click="resetUploader" 
          class="text-xs text-rose-400 hover:text-rose-500 font-semibold hover:underline"
          :disabled="isUploading"
        >
          Change
        </button>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Title -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Song Title</label>
          <input 
            type="text" 
            v-model="form.title" 
            placeholder="e.g. Neon Shadows" 
            class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm"
          />
        </div>

        <!-- Artist -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Artist Name</label>
          <input 
            type="text" 
            v-model="form.artist" 
            placeholder="e.g. SynthRunner" 
            class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm"
          />
        </div>

        <!-- Album -->
        <div>
          <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Album Name</label>
          <input 
            type="text" 
            v-model="form.album" 
            placeholder="e.g. Retro Dreams (Optional)" 
            class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm"
          />
        </div>

        <!-- Genre & Visibility -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Genre</label>
            <select 
              v-model="form.genre" 
              class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm cursor-pointer"
            >
              <option value="Lofi">Lofi</option>
              <option value="Synthwave">Synthwave</option>
              <option value="Acoustic">Acoustic</option>
              <option value="Pop">Pop</option>
              <option value="Rock">Rock</option>
              <option value="Classical">Classical</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Visibility</label>
            <select 
              v-model="form.visibility" 
              class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm cursor-pointer"
            >
              <option value="public">Public</option>
              <option value="private">Private</option>
              <option value="shared">Shared Link</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Cover artwork upload input -->
      <div>
        <label class="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Album Cover Artwork</label>
        <div class="flex items-center gap-4">
          <div 
            class="w-16 h-16 rounded-xl border border-panelBorder bg-slate-200/50 dark:bg-white/5 flex items-center justify-center overflow-hidden shrink-0 relative"
          >
            <img v-if="coverPreview" :src="coverPreview" class="w-full h-full object-cover" />
            <Image v-else class="w-6 h-6 text-slate-400" />
          </div>
          <button 
            type="button" 
            @click="triggerCoverInput"
            class="px-4 py-2 bg-slate-200/50 dark:bg-white/5 hover:bg-slate-300 dark:hover:bg-white/10 border border-panelBorder rounded-xl text-xs font-bold text-textMain transition"
          >
            Select Artwork Image
          </button>
          <input 
            type="file" 
            ref="coverInput" 
            accept="image/*" 
            class="hidden" 
            @change="handleCoverSelect" 
          />
        </div>
        <p v-if="coverError" class="text-xs text-rose-500 font-semibold mt-2">{{ coverError }}</p>
      </div>

      <!-- Uploading percentage progress -->
      <div v-if="isUploading" class="space-y-2 py-2">
        <div class="flex items-center justify-between text-xs text-slate-400 font-semibold">
          <span>Publishing track to cloud...</span>
          <span>{{ uploadProgress }}%</span>
        </div>
        <div class="w-full h-2 bg-slate-200 dark:bg-white/10 rounded-full overflow-hidden">
          <div 
            class="h-full bg-gradient-to-r from-violet-500 to-pink-500 transition-all duration-300"
            :style="{ width: `${uploadProgress}%` }"
          ></div>
        </div>
      </div>

      <!-- Action Button -->
      <div class="flex justify-end gap-3 pt-2">
        <button 
          v-if="!isUploading"
          @click="resetUploader"
          class="px-5 py-2 bg-transparent hover:bg-slate-200/40 dark:hover:bg-white/5 text-slate-400 hover:text-textMain transition rounded-xl font-bold text-xs"
        >
          Cancel
        </button>
        <button 
          @click="uploadTrack" 
          :disabled="isUploading"
          class="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-xl font-bold text-xs shadow-lg shadow-violet-500/20 transition flex items-center gap-2"
        >
          <Loader2 v-if="isUploading" class="w-4 h-4 animate-spin" />
          {{ isUploading ? 'Uploading...' : 'Publish Song' }}
        </button>
      </div>
      <p v-if="error" class="text-xs text-rose-500 font-semibold mt-2">{{ error }}</p>
    </div>
  </div>
</template>

<script>
import { ref, reactive } from 'vue'
import { uploadFileToStorage, saveDocumentData, onAuthStateChanged, auth } from '../firebase'
import { validateAudioFile, validateImageFile, generateShareToken } from '../utils/helpers'
import { Music, Upload, Image, Loader2, Lock } from 'lucide-vue-next'

export default {
  name: 'TrackUploader',
  components: {
    Music,
    Upload,
    Image,
    Loader2,
    Lock
  },
  emits: ['upload-success'],
  setup(props, { emit }) {
    const isLoggedIn = ref(false)

    // Changed on 2026-05-23 20:41:00
    onAuthStateChanged(null, (user) => {
      isLoggedIn.value = !!user
    })

    const triggerGlobalLogin = () => {
      window.dispatchEvent(new CustomEvent('open-login-modal'))
    }

    const fileInput = ref(null)
    const coverInput = ref(null)
    const audioFile = ref(null)
    const coverFile = ref(null)
    const coverPreview = ref(null)
    const isDragging = ref(false)
    const isUploading = ref(false)
    const uploadProgress = ref(0)
    const error = ref('')
    const coverError = ref('')

    const form = reactive({
      title: '',
      artist: '',
      album: '',
      genre: 'Lofi',
      visibility: 'public'
    })

    const triggerFileInput = () => {
      fileInput.value.click()
    }

    const triggerCoverInput = () => {
      coverInput.value.click()
    }

    // DRY: Single logic handling files selections
    const processSelectedAudio = (file) => {
      error.value = ''
      const validationError = validateAudioFile(file)
      if (validationError) {
        error.value = validationError
        return
      }

      audioFile.value = file
      // Auto-populate Title based on filename (minus extension)
      const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name
      form.title = cleanName
    }

    const handleFileSelect = (e) => {
      if (e.target.files && e.target.files[0]) {
        processSelectedAudio(e.target.files[0])
      }
    }

    const handleDrop = (e) => {
      isDragging.value = false
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        processSelectedAudio(e.dataTransfer.files[0])
      }
    }

    const handleCoverSelect = (e) => {
      coverError.value = ''
      if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0]
        const validationError = validateImageFile(file)
        if (validationError) {
          coverError.value = validationError
          return
        }

        coverFile.value = file
        coverPreview.value = URL.createObjectURL(file)
      }
    }

    const resetUploader = () => {
      audioFile.value = null
      coverFile.value = null
      coverPreview.value = null
      uploadProgress.value = 0
      isUploading.value = false
      error.value = ''
      coverError.value = ''
      form.title = ''
      form.artist = ''
      form.album = ''
      form.genre = 'Lofi'
      form.visibility = 'public'
    }

    const uploadTrack = async () => {
      if (!audioFile.value) {
        error.value = 'Please select an audio file first.'
        return
      }
      if (!form.title.trim()) {
        error.value = 'Song title is required.'
        return
      }
      if (!form.artist.trim()) {
        error.value = 'Artist name is required.'
        return
      }

      isUploading.value = true
      uploadProgress.value = 0
      error.value = ''

      try {
        let audioUrl = ''
        let coverUrl = ''

        // 1. Upload Cover Artwork if provided
        if (coverFile.value) {
          coverUrl = await uploadFileToStorage('covers', coverFile.value)
        }

        // 2. Upload Audio File (with progress tracking)
        audioUrl = await uploadFileToStorage('tracks', audioFile.value, (progress) => {
          uploadProgress.value = progress
        })

        // 3. Prepare Track document
        const trackData = {
          title: form.title.trim(),
          artist: form.artist.trim(),
          album: form.album.trim(),
          genre: form.genre,
          visibility: form.visibility,
          audioUrl,
          coverUrl,
          likesCount: 0,
          likedBy: [],
          uploadedBy: auth.currentUser?.uid || 'mock_admin_uid', // Real auth uid; mock for offline dev
          shareToken: form.visibility === 'shared' ? generateShareToken() : '',
          createdAt: new Date().toISOString()
        }

        // 4. Save metadata to Firestore / LocalStorage
        await saveDocumentData('tracks', null, trackData)

        // Clear uploader & notify library to reload
        resetUploader()
        emit('upload-success')
      } catch (err) {
        console.error("Upload error:", err)
        error.value = 'Failed to upload track. Please try again.'
        isUploading.value = false
      }
    }

    return {
      isLoggedIn,
      triggerGlobalLogin,
      fileInput,
      coverInput,
      audioFile,
      coverFile,
      coverPreview,
      isDragging,
      isUploading,
      uploadProgress,
      error,
      coverError,
      form,
      triggerFileInput,
      triggerCoverInput,
      handleFileSelect,
      handleDrop,
      handleCoverSelect,
      resetUploader,
      uploadTrack
    }
  }
}
</script>

<!-- Changed on 2026-05-23 20:41:00 -->
