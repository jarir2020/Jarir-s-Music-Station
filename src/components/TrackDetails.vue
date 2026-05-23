<template>
  <div 
    v-if="currentTrack" 
    class="glass p-6 rounded-2xl border border-panelBorder bg-panelBg shadow-xl flex flex-col h-full justify-between gap-6"
  >
    <!-- Header: Active Track Profile -->
    <div class="border-b border-panelBorder pb-4 space-y-3">
      <div class="flex items-center gap-4">
        <img 
          :src="currentTrack.coverUrl || '/src/assets/logo.png'" 
          alt="Art" 
          class="w-16 h-16 rounded-xl object-cover border border-panelBorder shadow shrink-0" 
        />
        <div class="min-w-0">
          <h4 class="text-base font-bold font-outfit text-textMain truncate leading-snug">{{ currentTrack.title }}</h4>
          <p class="text-xs text-slate-400 truncate">{{ currentTrack.artist }}</p>
        </div>
      </div>
    </div>

    <!-- Scrollable Feed: Timed Comments thread -->
    <div class="flex-1 overflow-y-auto custom-scrollbar space-y-4 max-h-[300px] pr-2">
      <h4 class="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Community Chat</h4>
      
      <div v-if="comments.length > 0" class="space-y-3">
        <div 
          v-for="cmt in comments" 
          :key="cmt.id"
          class="p-3 rounded-xl bg-slate-200/30 dark:bg-white/5 border border-panelBorder transition duration-300"
          :class="{'border-violet-500/40 bg-violet-600/5!': isCommentActive(cmt)}"
        >
          <div class="flex items-center justify-between gap-2 mb-1">
            <span class="text-xs font-bold text-textMain truncate">{{ cmt.userName }}</span>
            <span class="text-[9px] text-slate-400 font-mono">{{ formatDate(cmt.createdAt) }}</span>
          </div>
          <p class="text-xs text-slate-300 leading-relaxed break-words">{{ cmt.content }}</p>
          
          <!-- Clickable Timed Tag -->
          <button 
            v-if="cmt.songTimestamp !== undefined && cmt.songTimestamp !== null" 
            @click="scrubToComment(cmt.songTimestamp)"
            class="mt-1.5 px-2 py-0.5 rounded bg-violet-600/10 text-violet-500 hover:bg-violet-600 hover:text-white transition duration-200 text-[10px] font-bold font-mono flex items-center gap-1 cursor-pointer"
          >
            <Clock class="w-3 h-3" />
            {{ formatTime(cmt.songTimestamp) }}
          </button>
        </div>
      </div>

      <!-- Empty chat banner -->
      <div v-else class="text-center py-8 text-slate-400 text-xs">
        No comments yet. Be the first to express your thoughts!
      </div>
    </div>

    <!-- Bottom Input Box: Add Timed Comments -->
    <div class="border-t border-panelBorder pt-4 space-y-3">
      <textarea 
        v-model="commentText"
        placeholder="Write a timed comment..."
        rows="2"
        class="w-full px-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-xs leading-relaxed"
      ></textarea>
      
      <div class="flex items-center justify-between">
        <!-- Timed check box -->
        <label class="flex items-center gap-2 text-[10px] text-slate-400 font-semibold cursor-pointer select-none">
          <input 
            type="checkbox" 
            v-model="isTimed"
            class="rounded border-panelBorder text-violet-600 focus:ring-violet-500 bg-white/5 w-3.5 h-3.5" 
          />
          Attach to playhead [{{ formattedCurrentTime }}]
        </label>

        <!-- Submit btn -->
        <button 
          @click="postComment"
          :disabled="!commentText.trim()"
          class="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white rounded-lg font-bold text-xs shadow-md shadow-violet-500/20 transition flex items-center gap-1.5"
        >
          <Send class="w-3.5 h-3.5" />
          Send
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import { ref, computed, watch, onMounted } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { getCollectionData, saveDocumentData, auth } from '../firebase'
import { Clock, Send } from 'lucide-vue-next'

export default {
  name: 'TrackCommentsDrawer',
  components: {
    Clock,
    Send
  },
  setup() {
    const audioStore = useAudioStore()
    const comments = ref([])
    const commentText = ref('')
    const isTimed = ref(true)

    const currentTrack = computed(() => audioStore.currentTrack)

    // Load comments thread
    const loadComments = async () => {
      if (!currentTrack.value) return
      
      try {
        const colPath = `tracks/${currentTrack.value.id}/comments`
        const list = await getCollectionData(colPath)
        
        // Sort chronologically
        comments.value = list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      } catch (err) {
        console.error("Error loading comments:", err)
      }
    }

    watch(currentTrack, () => {
      loadComments()
    }, { immediate: true })

    // DRY: Reusable time formatter
    const formatTime = (secs) => {
      if (isNaN(secs) || secs === null) return '00:00'
      const m = Math.floor(secs / 60)
      const s = Math.floor(secs % 60)
      const mm = m < 10 ? `0${m}` : m
      const ss = s < 10 ? `0${s}` : s
      return `${mm}:${ss}`
    }

    const formattedCurrentTime = computed(() => formatTime(audioStore.currentTime))

    // Check if the comment matches the playhead timeline for highlighting
    const isCommentActive = (cmt) => {
      if (cmt.songTimestamp === undefined || cmt.songTimestamp === null) return false
      const diff = Math.abs(audioStore.currentTime - cmt.songTimestamp)
      return diff <= 2.5 // Active within a 2.5-second buffer
    }

    const scrubToComment = (secs) => {
      audioStore.seek(secs)
    }

    const formatDate = (isoStr) => {
      try {
        const date = new Date(isoStr)
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
      } catch (e) {
        return ''
      }
    }

    // Submit a comment — Changed on 2026-05-23 23:57:00
    const postComment = async () => {
      if (!commentText.value.trim() || !currentTrack.value) return

      const user = auth.currentUser
      if (!user) {
        window.dispatchEvent(new CustomEvent('open-login-modal'))
        return
      }

      try {
        const colPath = `tracks/${currentTrack.value.id}/comments`
        const commentData = {
          userId: user.uid,
          userName: user.displayName || user.email?.split('@')[0] || 'User',
          content: commentText.value.trim(),
          songTimestamp: isTimed.value ? audioStore.currentTime : null,
          createdAt: new Date().toISOString()
        }

        await saveDocumentData(colPath, null, commentData)
        commentText.value = ''
        
        // Reload list
        await loadComments()
      } catch (err) {
        console.error("Error posting comment:", err)
      }
    }

    return {
      audioStore,
      comments,
      commentText,
      isTimed,
      currentTrack,
      formattedCurrentTime,
      formatTime,
      isCommentActive,
      scrubToComment,
      formatDate,
      postComment
    }
  }
}
</script>

<!-- Changed on 2026-05-23 19:21:00 -->
