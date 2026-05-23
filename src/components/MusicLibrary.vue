<template>
  <div class="space-y-6">
    <!-- Top search, sort, and tab bar header -->
    <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
      <!-- Search Input box -->
      <div class="relative flex-1 max-w-md">
        <Search class="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input 
          type="text" 
          v-model="searchQuery" 
          placeholder="Search by song, artist, or genre..."
          class="w-full pl-11 pr-4 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-sm shadow-sm"
        />
      </div>

      <!-- Filters & Dynamic Tabs -->
      <div class="flex items-center gap-3">
        <!-- Tabs -->
        <div class="flex items-center bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl p-1 shrink-0">
          <button 
            @click="setTab('global')" 
            class="px-4 py-1.5 rounded-lg text-xs font-bold transition duration-200"
            :class="[activeTab === 'global' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-textMain']"
          >
            Discovery
          </button>
          <button 
            @click="setTab('private')" 
            class="px-4 py-1.5 rounded-lg text-xs font-bold transition duration-200"
            :class="[activeTab === 'private' ? 'bg-violet-600 text-white shadow' : 'text-slate-400 hover:text-textMain']"
          >
            My Studio
          </button>
        </div>

        <!-- Sort dropdown selection -->
        <div class="relative shrink-0">
          <select 
            v-model="sortBy" 
            class="pl-4 pr-10 py-2.5 bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-xl text-textMain focus:outline-none focus:border-violet-500 transition text-xs font-semibold cursor-pointer appearance-none"
          >
            <option value="newest">Newest</option>
            <option value="title">Alphabetical</option>
            <option value="likes">Most Popular</option>
          </select>
          <ChevronDown class="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        </div>
      </div>
    </div>

    <!-- Floating Toast copy notification -->
    <div 
      v-if="toastMessage" 
      class="fixed top-6 right-6 z-50 px-4 py-3 bg-emerald-600 text-white font-semibold rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-2 animate-fade-in-down"
    >
      <Check class="w-4 h-4" />
      <span class="text-xs">{{ toastMessage }}</span>
    </div>

    <!-- Dynamic tracks display container -->
    <div v-if="pagedTracks.length > 0" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <div 
        v-for="track in pagedTracks" 
        :key="track.id" 
        class="glass group relative p-4 rounded-2xl border border-panelBorder bg-panelBg shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1"
      >
        <div class="flex items-center gap-4">
          <!-- Hoverable Cover Art + Circular Play trigger overlay -->
          <div class="relative w-16 h-16 rounded-xl overflow-hidden border border-panelBorder shrink-0 bg-slate-300 dark:bg-white/5">
            <img :src="track.coverUrl || '/logo.png'" alt="Art" class="w-full h-full object-cover group-hover:scale-110 transition duration-300" />
            <button 
              @click="playTrack(track)" 
              class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition duration-200 text-white"
            >
              <Play v-if="activeTrackId !== track.id || !audioStore.isPlaying" class="w-6 h-6 fill-current" />
              <Pause v-else class="w-6 h-6 fill-current animate-pulse" />
            </button>
          </div>

          <!-- Description Info -->
          <div class="flex-1 min-w-0">
            <h4 class="text-sm font-bold text-textMain truncate font-outfit">{{ track.title }}</h4>
            <p class="text-xs text-slate-400 truncate mb-1">{{ track.artist }}</p>
            <div class="flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded-full bg-violet-600/10 text-violet-500 text-[9px] font-bold tracking-wide uppercase">
                {{ track.genre }}
              </span>
              
              <!-- Visibility Badges for My Studio -->
              <span 
                v-if="activeTab === 'private'"
                class="px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wide uppercase"
                :class="[
                  track.visibility === 'public' ? 'bg-emerald-600/10 text-emerald-500' :
                  track.visibility === 'private' ? 'bg-rose-600/10 text-rose-500' :
                  'bg-amber-600/10 text-amber-500'
                ]"
              >
                {{ track.visibility }}
              </span>
            </div>
          </div>
        </div>

        <!-- Card bottom actions row -->
        <div class="mt-4 pt-3 border-t border-panelBorder flex items-center justify-between">
          <!-- Play length -->
          <span class="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            <Clock class="w-3 h-3" />
            {{ formatTrackDuration(track.duration) }}
          </span>

          <!-- Social Like / Share Links -->
          <div class="flex items-center gap-1">
            <!-- Heart Likes Toggle -->
            <button 
              @click="toggleLike(track)"
              class="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/5 transition flex items-center gap-1"
              :class="{'text-rose-500!': isFavorite(track.id)}"
            >
              <Heart class="w-3.5 h-3.5" :class="{'fill-current': isFavorite(track.id)}" />
              <span class="text-[10px] font-bold font-mono">{{ track.likesCount || 0 }}</span>
            </button>

            <!-- Secure Share copy action -->
            <button 
              v-if="track.visibility !== 'private'"
              @click="shareTrackLink(track)"
              class="p-1.5 text-slate-400 hover:text-violet-500 rounded-lg hover:bg-slate-200/50 dark:hover:bg-white/5 transition"
              title="Copy share link"
            >
              <Share2 class="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty collection loader banner -->
    <div 
      v-else 
      class="glass p-12 rounded-2xl border border-panelBorder text-center flex flex-col items-center justify-center min-h-[300px]"
    >
      <Music class="w-12 h-12 text-slate-400 mb-4 animate-pulse" />
      <h3 class="text-lg font-bold font-outfit text-textMain mb-1">No songs found</h3>
      <p class="text-sm text-slate-400 max-w-sm">
        {{ 
          activeTab === 'private' 
            ? "Your local studio is empty! Drag and drop files in the uploader to add personal tracks."
            : "The global feed is empty. Set your uploads to public visibility to share them here."
        }}
      </p>
    </div>

    <!-- ─── Pagination Controls ─── -->
    <!-- Only render when there is more than one page worth of tracks -->
    <div v-if="totalPages > 1" class="flex flex-col items-center gap-4 pt-2">

      <!-- Track count info line -->
      <p class="text-xs text-slate-400 font-mono">
        Showing 
        <span class="text-violet-400 font-bold">{{ rangeStart }}</span>–<span class="text-violet-400 font-bold">{{ rangeEnd }}</span>
        of 
        <span class="text-violet-400 font-bold">{{ filteredTracks.length }}</span>
        tracks
      </p>

      <!-- Page buttons row -->
      <div class="flex items-center gap-2 flex-wrap justify-center">

        <!-- Previous button -->
        <button
          @click="prevPage"
          :disabled="currentPage === 1"
          class="pagination-btn group"
          :class="currentPage === 1 ? 'opacity-40 cursor-not-allowed' : 'hover:border-violet-500 hover:text-violet-400'"
          title="Previous page"
        >
          <ChevronLeft class="w-4 h-4" />
        </button>

        <!-- Page number buttons (smart window) -->
        <template v-for="page in visiblePages" :key="page">
          <!-- Ellipsis separator -->
          <span v-if="page === '...'" class="text-slate-500 text-xs px-1">…</span>

          <!-- Actual page number button -->
          <button
            v-else
            @click="goToPage(page)"
            class="pagination-btn"
            :class="page === currentPage
              ? 'bg-violet-600 text-white border-violet-600 shadow shadow-violet-500/30'
              : 'hover:border-violet-500 hover:text-violet-400'"
          >
            {{ page }}
          </button>
        </template>

        <!-- Next button -->
        <button
          @click="nextPage"
          :disabled="currentPage === totalPages"
          class="pagination-btn group"
          :class="currentPage === totalPages ? 'opacity-40 cursor-not-allowed' : 'hover:border-violet-500 hover:text-violet-400'"
          title="Next page"
        >
          <ChevronRight class="w-4 h-4" />
        </button>
      </div>

      <!-- Per-page selector -->
      <div class="flex items-center gap-2 text-xs text-slate-400">
        <span>Per page:</span>
        <select
          v-model.number="tracksPerPage"
          class="bg-slate-200/50 dark:bg-white/5 border border-panelBorder rounded-lg px-2 py-1 text-xs text-textMain focus:outline-none focus:border-violet-500 transition cursor-pointer"
        >
          <option :value="6">6</option>
          <option :value="12">12</option>
          <option :value="24">24</option>
          <option :value="48">48</option>
        </select>
      </div>

      <!-- ── Jamendo Load More Banner ───────────────────────────── -->
      <!-- Only shown on the Discovery tab when on the last loaded page -->
      <!-- Changed on 2026-05-23 21:52:00 -->
      <div v-if="activeTab === 'global' && isOnLastPage" class="flex flex-col items-center gap-3 pt-2 w-full">

        <!-- Loading spinner (while fetching next Jamendo page) -->
        <div v-if="audioStore.isLoadingMore" class="flex items-center gap-2 text-violet-400 text-xs font-semibold">
          <Loader2 class="w-4 h-4 animate-spin" />
          Fetching more tracks from Jamendo…
        </div>

        <!-- Load More button (when more tracks exist) -->
        <button
          v-else-if="audioStore.jamendoHasMore"
          @click="loadMore"
          class="jamendo-load-more-btn"
          id="btn-load-more-jamendo"
        >
          <Flame class="w-4 h-4" />
          Load More from Jamendo
          <span class="text-[10px] opacity-60 font-mono ml-1">(+{{ 8 * 30 }} tracks)</span>
        </button>

        <!-- End of catalog message -->
        <p v-else class="text-xs text-slate-500 font-mono flex items-center gap-1">
          <span>✦</span> You've reached the end of Jamendo's catalog
        </p>
      </div>

    </div>

  </div>
</template>

<script>
// Changed on 2026-05-23 21:52:00 — Added Jamendo multi-genre pagination integration
import { ref, computed, watch, onMounted } from 'vue'
import { useAudioStore } from '../stores/audioStore'
import { copyToClipboard } from '../utils/helpers'
import { saveDocumentData, auth, onAuthStateChanged } from '../firebase'
import { 
  Search, 
  Play, 
  Pause, 
  Heart, 
  Share2, 
  Clock, 
  Music, 
  Check, 
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Flame
} from 'lucide-vue-next'

export default {
  name: 'MusicLibraryGrid',
  components: {
    Search,
    Play,
    Pause,
    Heart,
    Share2,
    Clock,
    Music,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Flame
  },
  setup() {
    const audioStore = useAudioStore()
    const activeTab = ref('global')
    const searchQuery = ref('')
    const sortBy = ref('newest')
    const toastMessage = ref('')
    // Changed on 2026-05-23 23:58:00 — track current user for private-tab + likedBy
    const currentUserId = ref(auth.currentUser?.uid || null)
    onAuthStateChanged(null, (u) => { currentUserId.value = u?.uid || null })

    // ── Pagination state ──────────────────────────────────────────
    const currentPage = ref(1)
    const tracksPerPage = ref(12) // default: 12 tracks per page

    onMounted(async () => {
      await audioStore.loadTracks()
    })

    const isFavorite = (trackId) => audioStore.isFavorite(trackId)
    const activeTrackId = computed(() => audioStore.currentTrack?.id || null)

    // Dynamic Filtered & Sorted Tracks resolver (full set, before paging)
    const filteredTracks = computed(() => {
      let list = [...audioStore.tracks]

      // 1. Filter by Tab visibility
      if (activeTab.value === 'global') {
        list = list.filter(track => track.visibility === 'public')
      } else {
        list = list.filter(track => track.uploadedBy === currentUserId.value)
      }

      // 2. Search query matches
      const query = searchQuery.value.trim().toLowerCase()
      if (query) {
        list = list.filter(track => 
          track.title.toLowerCase().includes(query) ||
          track.artist.toLowerCase().includes(query) ||
          track.genre.toLowerCase().includes(query)
        )
      }

      // 3. Sorting logic
      if (sortBy.value === 'title') {
        list.sort((a, b) => a.title.localeCompare(b.title))
      } else if (sortBy.value === 'likes') {
        list.sort((a, b) => (b.likesCount || 0) - (a.likesCount || 0))
      } else {
        // newest (by createdAt string)
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      }

      return list
    })

    // Reset to page 1 whenever the filter criteria change
    watch([searchQuery, sortBy, activeTab, tracksPerPage], () => {
      currentPage.value = 1
    })

    // ── Pagination computed helpers ─────────────────────────────────────────────────
    const totalPages = computed(() =>
      Math.max(1, Math.ceil(filteredTracks.value.length / tracksPerPage.value))
    )

    // The visible slice for the current page
    const pagedTracks = computed(() => {
      const start = (currentPage.value - 1) * tracksPerPage.value
      return filteredTracks.value.slice(start, start + tracksPerPage.value)
    })

    // Human-readable range info e.g. "1 – 12 of 47"
    const rangeStart = computed(() =>
      filteredTracks.value.length === 0
        ? 0
        : (currentPage.value - 1) * tracksPerPage.value + 1
    )
    const rangeEnd = computed(() =>
      Math.min(currentPage.value * tracksPerPage.value, filteredTracks.value.length)
    )

    // True when the user is viewing the very last page of currently-loaded tracks
    // → This is when we show the "Load More from Jamendo" button
    // Changed on 2026-05-23 21:52:00
    const isOnLastPage = computed(() => currentPage.value >= totalPages.value)

    /**
     * Smart page-number window:
     * Always shows first, last, current ±1, and fills gaps with "..." separators.
     * E.g.: [1, '...', 4, 5, 6, '...', 12]
     */
    const visiblePages = computed(() => {
      const total = totalPages.value
      const cur = currentPage.value

      if (total <= 7) {
        // Small enough: show all pages
        return Array.from({ length: total }, (_, i) => i + 1)
      }

      const pages = new Set([1, total, cur])
      if (cur > 1) pages.add(cur - 1)
      if (cur < total) pages.add(cur + 1)

      const sorted = [...pages].sort((a, b) => a - b)

      // Insert '...' separators where gaps are > 1
      const result = []
      for (let i = 0; i < sorted.length; i++) {
        if (i > 0 && sorted[i] - sorted[i - 1] > 1) {
          result.push('...')
        }
        result.push(sorted[i])
      }
      return result
    })

    // ── Navigation actions ─────────────────────────────────────────
    const goToPage = (page) => {
      if (page >= 1 && page <= totalPages.value) {
        currentPage.value = page
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }
    const prevPage = () => goToPage(currentPage.value - 1)
    const nextPage = () => goToPage(currentPage.value + 1)

    // Helper to switch tab and reset page
    const setTab = (tab) => {
      activeTab.value = tab
      currentPage.value = 1
    }

    /**
     * Load the next batch of Jamendo tracks and jump to the new last page.
     * Changed on 2026-05-23 21:52:00
     */
    const loadMore = async () => {
      if (audioStore.isLoadingMore || !audioStore.jamendoHasMore) return
      const prevTotal = filteredTracks.value.length
      await audioStore.loadMoreJamendo()
      // After new tracks arrive, jump to the next page that contains them
      const newTotal = filteredTracks.value.length
      if (newTotal > prevTotal) {
        // Advance to the first page of newly loaded content
        currentPage.value = Math.ceil(prevTotal / tracksPerPage.value) + 1
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
    }

    // Reusable Time Formatting helper (DRY principle)
    const formatTrackDuration = (secs) => {
      if (!secs || isNaN(secs)) return '02:30'
      const m = Math.floor(secs / 60)
      const s = Math.floor(secs % 60)
      const mm = m < 10 ? `0${m}` : m
      const ss = s < 10 ? `0${s}` : s
      return `${mm}:${ss}`
    }

    const playTrack = (track) => {
      if (activeTrackId.value === track.id) {
        audioStore.togglePlay()
      } else {
        // Pass the full filtered list so next/prev traversal works correctly
        audioStore.playTrack(track, filteredTracks.value)
      }
    }

    // Toggle heart-like count dynamically
    const toggleLike = async (track) => {
      audioStore.toggleFavorite(track.id)
      
      const isFav = isFavorite(track.id)
      const inc = isFav ? 1 : -1
      const newCount = Math.max(0, (track.likesCount || 0) + inc)

      track.likesCount = newCount
      
      // Save updated count to Supabase / LocalStorage
      await saveDocumentData('tracks', track.id, {
        likesCount: newCount,
        likedBy: isFav && currentUserId.value ? [currentUserId.value] : []
      })
    }

    // Secure Share URL copier using the clipboard utility
    const shareTrackLink = (track) => {
      let pathToken = track.shareToken
      
      // Fallback: Generate if none exists (for public tracks sharing)
      if (!pathToken) {
        pathToken = track.id
      }

      const host = window.location.origin
      const secureUrl = `${host}/track/shared/${pathToken}`

      copyToClipboard(secureUrl, () => {
        toastMessage.value = 'Secure share link copied to clipboard!'
        setTimeout(() => {
          toastMessage.value = ''
        }, 3000)
      })
    }

    return {
      audioStore,
      activeTab,
      searchQuery,
      sortBy,
      toastMessage,
      filteredTracks,
      pagedTracks,
      isFavorite,
      activeTrackId,
      formatTrackDuration,
      playTrack,
      toggleLike,
      shareTrackLink,
      // Pagination
      currentPage,
      tracksPerPage,
      totalPages,
      rangeStart,
      rangeEnd,
      visiblePages,
      goToPage,
      prevPage,
      nextPage,
      setTab,
      // Jamendo load more
      isOnLastPage,
      loadMore
    }
  }
}
</script>

<style scoped>
/* ── Shared pagination button style ────────────────────────── */
/* Changed on 2026-05-23 21:52:00 */
.pagination-btn {
  min-width: 2rem;
  height: 2rem;
  padding: 0 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 0.5rem;
  border: 1px solid var(--color-panel-border, rgba(255,255,255,0.08));
  background: rgba(255,255,255,0.03);
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 700;
  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  transition: all 0.18s ease;
  user-select: none;
}
.pagination-btn:hover:not(:disabled) {
  background: rgba(124, 58, 237, 0.12);
}

/* ── Jamendo Load More CTA button ──────────────────────────── */
/* Changed on 2026-05-23 21:52:00 */
.jamendo-load-more-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1.5rem;
  border-radius: 9999px;
  border: 1px solid rgba(139, 92, 246, 0.5);
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.18), rgba(167, 139, 250, 0.10));
  color: #a78bfa;
  font-size: 0.75rem;
  font-weight: 700;
  font-family: 'Outfit', sans-serif;
  cursor: pointer;
  transition: all 0.22s ease;
  user-select: none;
  position: relative;
  overflow: hidden;
  box-shadow: 0 0 18px rgba(124, 58, 237, 0.18);
}
.jamendo-load-more-btn::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent);
  transform: translateX(-100%);
  animation: shimmer 2.2s infinite;
}
.jamendo-load-more-btn:hover {
  background: linear-gradient(135deg, rgba(124, 58, 237, 0.32), rgba(167, 139, 250, 0.20));
  border-color: rgba(139, 92, 246, 0.85);
  box-shadow: 0 0 28px rgba(124, 58, 237, 0.35);
  transform: translateY(-1px);
  color: #c4b5fd;
}
@keyframes shimmer {
  100% { transform: translateX(100%); }
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.animate-fade-in-down {
  animation: fadeInDown 0.3s ease forwards;
}
</style>

<!-- Changed on 2026-05-23 21:52:00 -->

