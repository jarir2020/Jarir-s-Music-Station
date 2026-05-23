<template>
  <div class="music-list-container">
  <div><header><h1>Jarir's Music Station</h1></header></div>
    <div v-for="(music, index) in paginatedMusicList" :key="index" class="music-item">
      <p :style="{ color: 'white', textDecoration: 'none', fontFamily: 'Arial' }">{{ music.originalFileName }}</p>
      <audio :src="music.src" controls></audio><br>
      <a :href="music.src" :download="music.originalFileName" :style="{ color: 'white', textDecoration: 'none', fontFamily: 'Arial' }">Download</a>
    </div>
    <div class="pagination">
      <button @click="previousPage" :disabled="currentPage === 1">Previous</button>
      <button @click="nextPage" :disabled="currentPage * 5 >= musicList.length">Next</button>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      musicList: [],
      currentPage: 1,
    };
  },
  computed: {
    paginatedMusicList() {
      const start = (this.currentPage - 1) * 5;
      const end = start + 5;
      return this.musicList.slice(start, end);
    },
  },
  created() {
    const requireContext = require.context('@/assets', false, /\.mp3$/);
    const tracks = requireContext.keys().map((key) => {
      const src = requireContext(key);
      const originalFileName = key.replace('./', '');
      return { src, originalFileName };
    });

    // Sort the tracks naturally by their original file name
    this.musicList = this.sortTracksNaturally(tracks);

    // Set the background image
    document.body.style.background = `url(${require('@/assets/background.jpg')}) no-repeat center center fixed`;
    document.body.style.backgroundSize = 'cover';

    // Set the page title
    document.title = "Jarir's Music Station";
  },
  methods: {
    nextPage() {
      if (this.currentPage * 5 < this.musicList.length) {
        this.currentPage++;
      }
    },
    previousPage() {
      if (this.currentPage > 1) {
        this.currentPage--;
      }
    },
    sortTracksNaturally(tracks) {
      return tracks.sort((a, b) => {
        return a.originalFileName.localeCompare(b.originalFileName, undefined, {
          numeric: true,
          sensitivity: 'base',
        });
      });
    },
  },
};
</script>

<style>
.music-list-container {
  text-align: center;
  padding: 20px;
}

.music-item {
  margin: 20px;
}

.pagination {
  margin-top: 20px;
}

.pagination button {
  margin: 0 10px;
  padding: 5px 10px;
  border: 1px solid #ccc;
  background-color: #f0f0f0;
  cursor: pointer;
}

.pagination button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}
h1{
  color: red;
}
</style>
