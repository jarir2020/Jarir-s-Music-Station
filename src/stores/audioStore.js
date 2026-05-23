import { defineStore } from 'pinia'
import { getCollectionData, getJamendoTracksPage } from '../firebase'

export const useAudioStore = defineStore('audio', {
  state: () => ({
    audio: null,
    bypassAudio: null,
    audioContext: null,
    analyser: null,
    eqFilters: null,
    tracks: [],
    queue: [],
    currentIndex: -1,
    currentTrack: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    volume: parseFloat(localStorage.getItem('audio_volume') || '0.7'),
    isMuted: false,
    isLooping: localStorage.getItem('audio_loop') || 'none', // 'none', 'all', 'one'
    isShuffling: localStorage.getItem('audio_shuffle') === 'true',
    favorites: JSON.parse(localStorage.getItem('mock_favorites') || '[]'),
    hasPromptedCurrentTrack: false, // Prevents repetitive sign-in nag overlays for the same track
    // ── Jamendo pagination state ───────────────────────────────
    // Changed on 2026-05-23 21:52:00
    jamendoOffset: 0,         // Current API offset (0, 240, 480 …)
    jamendoHasMore: true,     // False once Jamendo returns an empty batch
    isLoadingMore: false,     // Loading spinner flag for MusicLibrary
    // Equalizer levels
    eqLevels: {
      bass: parseFloat(localStorage.getItem('eq_bass') || '0'),
      mid: parseFloat(localStorage.getItem('eq_mid') || '0'),
      treble: parseFloat(localStorage.getItem('eq_treble') || '0')
    }
  }),

  getters: {
    isFavorite: (state) => (trackId) => {
      return state.favorites.includes(trackId)
    }
  },

  actions: {
    // Dynamic routing helper to retrieve the correct audio element depending on stream CORS permissions
    // Changed on 2026-05-23 20:30:15
    getActiveAudio(track = this.currentTrack) {
      const isJamendo = track && (track.id?.startsWith('jamendo-') || track.audioUrl?.includes('jamendo.com'))
      return isJamendo ? this.bypassAudio : this.audio
    },

    // Reusable initialization helper to bind HTML5 audio event listeners to both elements
    // Changed on 2026-05-23 20:30:15
    initAudio() {
      if (this.audio) return

      this.audio = new Audio()
      this.audio.crossOrigin = "anonymous" // Best practice to prevent CORS issues for compliant sources
      this.audio.volume = this.isMuted ? 0 : this.volume

      this.bypassAudio = new Audio()
      this.bypassAudio.volume = this.isMuted ? 0 : this.volume

      const bindListeners = (audioEl) => {
        audioEl.addEventListener('timeupdate', () => {
          if (audioEl !== this.getActiveAudio()) return
          this.currentTime = Math.round(audioEl.currentTime)
          
          // Capped 60-second (1-minute) preview limit for non-logged-in guests
          // Changed on 2026-05-23 20:34:55
          const session = localStorage.getItem('user_session')
          if (!session && audioEl.currentTime >= 60) {
            audioEl.pause()
            audioEl.currentTime = 60
            this.currentTime = 60
            this.isPlaying = false
            
            if (!this.hasPromptedCurrentTrack) {
              this.hasPromptedCurrentTrack = true
              window.dispatchEvent(new CustomEvent('show-signin-prompt', { detail: { track: this.currentTrack } }))
            }
          }
        })

        audioEl.addEventListener('loadedmetadata', () => {
          if (audioEl !== this.getActiveAudio()) return
          this.duration = Math.round(audioEl.duration)
        })

        audioEl.addEventListener('ended', () => {
          if (audioEl !== this.getActiveAudio()) return
          this.handleTrackEnded()
        })
      }

      bindListeners(this.audio)
      bindListeners(this.bypassAudio)
    },

    // Initialize Web Audio API node chaining for EQ & Visualizers
    // Changed on 2026-05-23 20:30:15
    initWebAudio() {
      if (this.audioContext || !this.audio) return

      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext
        this.audioContext = new AudioCtx()
        
        // ONLY connect standard 'audio' element to Web Audio to avoid CORS silence blockades on cross-origin elements
        const source = this.audioContext.createMediaElementSource(this.audio)

        // Bass Filter (Low Shelf)
        const lowFilter = this.audioContext.createBiquadFilter()
        lowFilter.type = 'lowshelf'
        lowFilter.frequency.value = 250
        lowFilter.gain.value = this.eqLevels.bass

        // Midrange Filter (Peaking)
        const midFilter = this.audioContext.createBiquadFilter()
        midFilter.type = 'peaking'
        midFilter.Q.value = 1.0
        midFilter.frequency.value = 1000
        midFilter.gain.value = this.eqLevels.mid

        // Treble Filter (High Shelf)
        const highFilter = this.audioContext.createBiquadFilter()
        highFilter.type = 'highshelf'
        highFilter.frequency.value = 4000
        highFilter.gain.value = this.eqLevels.treble

        // Analyser node for drawing visualizers
        this.analyser = this.audioContext.createAnalyser()
        this.analyser.fftSize = 256

        // Connection Chaining: Source -> Bass -> Mid -> Treble -> Analyser -> Destination
        source.connect(lowFilter)
        lowFilter.connect(midFilter)
        midFilter.connect(highFilter)
        highFilter.connect(this.analyser)
        this.analyser.connect(this.audioContext.destination)

        this.eqFilters = {
          bass: lowFilter,
          mid: midFilter,
          treble: highFilter
        }
      } catch (err) {
        console.warn("Web Audio API failed to load or is blocked:", err)
      }
    },

    // Dynamic Loader: Fetches the initial track database and resets Jamendo pagination
    // Changed on 2026-05-23 21:52:00
    async loadTracks() {
      try {
        this.tracks = await getCollectionData('tracks')
        // Reset pagination state on fresh load
        this.jamendoOffset = 30  // initial load already fetched offset 0
        this.jamendoHasMore = true
      } catch (error) {
        console.error("Error loading tracks:", error)
      }
    },

    /**
     * Fetches the NEXT page of Jamendo tracks (multi-genre, offset-based) and
     * appends unique tracks to this.tracks. Called by MusicLibrary when the user
     * reaches the last page of currently loaded tracks.
     * Changed on 2026-05-23 21:52:00
     */
    async loadMoreJamendo() {
      if (this.isLoadingMore || !this.jamendoHasMore) return

      this.isLoadingMore = true
      try {
        const newTracks = await getJamendoTracksPage(this.jamendoOffset)

        if (!newTracks || newTracks.length === 0) {
          this.jamendoHasMore = false
          console.log('[Store] No more Jamendo tracks available.')
          return
        }

        // Append only tracks we don\'t already have (deduplicate by ID)
        const existingIds = new Set(this.tracks.map(t => t.id))
        const fresh = newTracks.filter(t => !existingIds.has(t.id))

        if (fresh.length === 0) {
          // Returned tracks are all duplicates — we\'ve likely exhausted the catalog
          this.jamendoHasMore = false
        } else {
          this.tracks = [...this.tracks, ...fresh]
          this.jamendoOffset += 30  // advance offset by tracksPerGenre
          console.log(`[Store] Loaded ${fresh.length} more Jamendo tracks. Total: ${this.tracks.length}`)
        }
      } catch (err) {
        console.error('[Store] loadMoreJamendo error:', err)
      } finally {
        this.isLoadingMore = false
      }
    },

    // Play a specific track and dynamically build the active play queue
    // Changed on 2026-05-23 20:30:15
    playTrack(track, list = []) {
      this.initAudio()

      if (!track) return

      const activeAudio = this.getActiveAudio(track)
      const otherAudio = activeAudio === this.audio ? this.bypassAudio : this.audio

      // Completely pause and tear down the alternative audio element to prevent double playback
      if (otherAudio) {
        otherAudio.pause()
        try {
          otherAudio.src = ''
        } catch (e) {}
      }

      // Initialize Web Audio graph ONLY if it's a standard/CORS-compliant track
      if (activeAudio === this.audio) {
        this.initWebAudio()
        // Resume AudioContext if suspended (browser autoplay policy)
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume()
        }
      }

      // Build or update the play queue
      if (list.length > 0) {
        this.queue = [...list]
      } else if (this.queue.length === 0 || !this.queue.some(t => t.id === track.id)) {
        this.queue = [track]
      }

      this.currentTrack = track
      this.currentIndex = this.queue.findIndex(t => t.id === track.id)
      this.hasPromptedCurrentTrack = false // Reset popup prompt flag for the new track

      // Ensure active audio is set with correct volume
      activeAudio.volume = this.isMuted ? 0 : this.volume

      // Load URL source and play
      activeAudio.src = track.audioUrl
      activeAudio.play()
        .then(() => {
          this.isPlaying = true
        })
        .catch(err => {
          console.error("Audio playback error:", err)
          this.isPlaying = false
        })
    },

    // Toggle Play/Pause state
    // Changed on 2026-05-23 20:30:15
    togglePlay() {
      this.initAudio()

      if (!this.currentTrack && this.tracks.length > 0) {
        // Fallback: Play first song in library if none loaded
        this.playTrack(this.tracks[0], this.tracks)
        return
      }

      if (!this.currentTrack) return

      const activeAudio = this.getActiveAudio()

      if (activeAudio === this.audio) {
        this.initWebAudio()
        if (this.audioContext && this.audioContext.state === 'suspended') {
          this.audioContext.resume()
        }
      }

      if (this.isPlaying) {
        activeAudio.pause()
        this.isPlaying = false
      } else {
        activeAudio.play()
          .then(() => {
            this.isPlaying = true
          })
          .catch(err => {
            console.error("Audio resume error:", err)
          })
      }
    },

    // Play next song in queue
    next() {
      if (this.queue.length === 0) return

      if (this.isShuffling) {
        const randomIndex = Math.floor(Math.random() * this.queue.length)
        this.playTrack(this.queue[randomIndex])
        return
      }

      let nextIndex = this.currentIndex + 1
      if (nextIndex >= this.queue.length) {
        nextIndex = this.isLooping === 'all' ? 0 : -1
      }

      if (nextIndex !== -1) {
        this.playTrack(this.queue[nextIndex])
      } else {
        this.isPlaying = false
      }
    },

    // Play previous song in queue
    prev() {
      if (this.queue.length === 0 || this.currentIndex === -1) return

      let prevIndex = this.currentIndex - 1
      if (prevIndex < 0) {
        prevIndex = this.isLooping === 'all' ? this.queue.length - 1 : 0
      }

      this.playTrack(this.queue[prevIndex])
    },

    // Handle track endings based on Loop setting
    // Changed on 2026-05-23 20:30:15
    handleTrackEnded() {
      const activeAudio = this.getActiveAudio()
      if (this.isLooping === 'one') {
        activeAudio.currentTime = 0
        activeAudio.play()
      } else {
        this.next()
      }
    },

    // Scrub timeline to target seconds
    // Changed on 2026-05-23 20:30:15
    seek(seconds) {
      this.initAudio()
      if (!this.currentTrack) return
      const activeAudio = this.getActiveAudio()
      activeAudio.currentTime = seconds
      this.currentTime = seconds
    },

    // Update volume level
    // Changed on 2026-05-23 20:30:15
    setVolume(vol) {
      this.initAudio()
      const sanitizedVol = Math.max(0, Math.min(1, vol))
      this.volume = sanitizedVol
      localStorage.setItem('audio_volume', sanitizedVol.toString())

      if (this.audio) {
        this.audio.volume = this.isMuted ? 0 : sanitizedVol
      }
      if (this.bypassAudio) {
        this.bypassAudio.volume = this.isMuted ? 0 : sanitizedVol
      }
    },

    // Toggle mute/unmute
    // Changed on 2026-05-23 20:30:15
    toggleMute() {
      this.initAudio()
      this.isMuted = !this.isMuted
      const vol = this.isMuted ? 0 : this.volume
      if (this.audio) {
        this.audio.volume = vol
      }
      if (this.bypassAudio) {
        this.bypassAudio.volume = vol
      }
    },

    // Toggle play mode loops
    toggleLoop() {
      const modes = ['none', 'all', 'one']
      const nextIdx = (modes.indexOf(this.isLooping) + 1) % modes.length
      this.isLooping = modes[nextIdx]
      localStorage.setItem('audio_loop', this.isLooping)
    },

    // Toggle random plays
    toggleShuffle() {
      this.isShuffling = !this.isShuffling
      localStorage.setItem('audio_shuffle', this.isShuffling.toString())
    },

    // Toggle Favorite states
    toggleFavorite(trackId) {
      const idx = this.favorites.indexOf(trackId)
      if (idx !== -1) {
        this.favorites.splice(idx, 1)
      } else {
        this.favorites.push(trackId)
      }
      localStorage.setItem('mock_favorites', JSON.stringify(this.favorites))
    },

    // Completely halt playback, tear down sources, and close the floating player bar
    // Changed on 2026-05-23 20:36:55
    stop() {
      this.initAudio()
      
      // Pause and clear sources for both elements to release background resources
      if (this.audio) {
        this.audio.pause()
        try {
          this.audio.src = ''
        } catch (e) {}
      }
      if (this.bypassAudio) {
        this.bypassAudio.pause()
        try {
          this.bypassAudio.src = ''
        } catch (e) {}
      }
      
      this.isPlaying = false
      this.currentTrack = null
      this.currentIndex = -1
    },

    // Set Equalizer band gains dynamically
    setEqGain(band, value) {
      this.initAudio()
      this.initWebAudio()

      const sanitizedVal = Math.max(-10, Math.min(10, value)) // Limit between -10dB and +10dB
      this.eqLevels[band] = sanitizedVal
      localStorage.setItem(`eq_${band}`, sanitizedVal.toString())

      if (this.eqFilters && this.eqFilters[band]) {
        this.eqFilters[band].gain.value = sanitizedVal
      }
    }
  }
})

// Changed on 2026-05-23 20:30:15

