/**
 * Jarir's Music Station - Unified Supabase Cloud & Offline LocalStorage Database Bridge
 * (Automatically routes queries to Supabase when active, falling back to LocalStorage if offline)
 * Changed on 2026-05-23 20:03:00
 */

import { createClient } from '@supabase/supabase-js';

// Reusable environment resolver supporting process.env (Vite define) and import.meta.env
// Changed on 2026-05-23 20:49:15
function safeGetEnv(key, fallback = '') {
  try {
    // Explicit static matches for Vite compilation define replacements
    if (key === 'PROJECT_URL' && typeof process !== 'undefined' && process.env.PROJECT_URL) {
      return process.env.PROJECT_URL;
    }
    if (key === 'PUBLISHABLE_KEY' && typeof process !== 'undefined' && process.env.PUBLISHABLE_KEY) {
      return process.env.PUBLISHABLE_KEY;
    }
    if (key === 'JAMENDO_CLIENT_ID' && typeof process !== 'undefined' && process.env.JAMENDO_CLIENT_ID) {
      return process.env.JAMENDO_CLIENT_ID;
    }

    if (typeof process !== 'undefined' && process.env && process.env[key] !== undefined) {
      return process.env[key];
    }
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key] !== undefined) {
      return import.meta.env[key];
    }
  } catch (e) {
    // Graceful fallback
  }
  return fallback;
}

const supabaseUrl = safeGetEnv('PROJECT_URL');
const supabaseKey = safeGetEnv('PUBLISHABLE_KEY');

export const supabase = (supabaseUrl && supabaseKey) 
  ? createClient(supabaseUrl, supabaseKey) 
  : null;

/**
 * Rich Multi-Genre Jamendo Fetcher with Server-Side Offset Pagination
 *
 * Fires one request per genre in parallel using Promise.all, then merges
 * and deduplicates results by track ID. Supports `offset` so each call to
 * loadMoreJamendo() fetches a genuinely fresh batch from Jamendo's catalog.
 *
 * @param {object} options
 * @param {number} options.tracksPerGenre  Max tracks fetched per genre (max 200, API hard cap)
 * @param {number} options.offset          Jamendo API offset (for pagination: 0, 50, 100 …)
 * @param {string[]} options.genres        Genre tags to query in parallel
 * Changed on 2026-05-23 21:52:00
 */
export async function getJamendoTracks({
  tracksPerGenre = 30,
  offset = 0,
  genres = ['pop', 'rock', 'lofi', 'electronic', 'jazz', 'acoustic', 'metal', 'funk']
} = {}) {
  const clientId = safeGetEnv('JAMENDO_CLIENT_ID');
  if (!clientId) {
    console.warn('[Jamendo] Client ID is missing — skipping fetch.');
    return [];
  }

  /**
   * Build one URL per genre. Key parameters:
   *   limit   → tracksPerGenre (up to 200 per request)
   *   offset  → for pagination (0, 30, 60 …)
   *   tags    → genre filter
   *   include → musicinfo  (gives us genre metadata on each track)
   *   order   → popularity_month_desc (trending this month)
   *   imagesize → 300px album art
   */
  const buildUrl = (genre) =>
    `https://api.jamendo.com/v3.0/tracks/` +
    `?client_id=${clientId}` +
    `&format=json` +
    `&limit=${tracksPerGenre}` +
    `&offset=${offset}` +
    `&tags=${encodeURIComponent(genre)}` +
    `&include=musicinfo` +
    `&order=popularity_month_desc` +
    `&imagesize=300`;

  // Map a raw Jamendo track object → our internal track schema
  const mapTrack = (item, genreTag) => ({
    id: `jamendo-${item.id}`,
    title: item.name,
    artist: item.artist_name,
    album: item.album_name || 'Indie Session',
    // Prefer the genre tag from musicinfo, fall back to the tag we searched for
    genre: item.musicinfo?.tags?.genres?.[0] || genreTag,
    duration: item.duration,
    audioUrl: item.audio,   // Direct streaming URL from Jamendo CDN
    coverUrl: item.album_image || item.image || '/src/assets/logo.png',
    visibility: 'public',
    likesCount: Math.floor(Math.random() * 120) + 10,
    uploadedBy: 'jamendo_api_system',
    createdAt: new Date().toISOString()
  });

  try {
    // Fire all genre requests in parallel — much faster than sequential
    const results = await Promise.allSettled(
      genres.map(async (genre) => {
        const res = await fetch(buildUrl(genre));
        if (!res.ok) throw new Error(`HTTP ${res.status} for genre "${genre}"`);
        const payload = await res.json();
        if (!payload?.results) return [];
        return payload.results.map(item => mapTrack(item, genre));
      })
    );

    // Flatten fulfilled results, silently skip failed genre fetches
    const all = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // Deduplicate by Jamendo track ID (a track can appear in multiple genres)
    const seen = new Set();
    const unique = all.filter(t => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    console.log(`[Jamendo] Fetched ${unique.length} unique tracks (offset=${offset}, genres=${genres.join(',')})`);
    return unique;

  } catch (err) {
    console.error('[Jamendo] Unexpected error in getJamendoTracks:', err);
    return [];
  }
}

// Self-healing: ensures a Jamendo track exists in the tracks table before adding relational likes or comments
async function ensureTrackExistsInDb(trackId, optionalMetadata = null) {
  if (!supabase) return;

  try {
    const { data: existing } = await supabase
      .from('tracks')
      .select('id')
      .eq('id', trackId)
      .single();

    if (existing) return;

    let trackData = {
      id: trackId,
      title: 'Jamendo Indie Track',
      artist: 'Independent Artist',
      audioUrl: '',
      visibility: 'public',
      likesCount: 0,
      uploadedBy: 'jamendo_api_system'
    };

    if (optionalMetadata) {
      Object.assign(trackData, optionalMetadata);
    } else {
      const jamendoTracks = await getJamendoTracks(30);
      const found = jamendoTracks.find(t => t.id === trackId);
      if (found) {
        Object.assign(trackData, found);
      }
    }

    const dbData = {
      id: trackData.id,
      title: trackData.title,
      artist: trackData.artist,
      album: trackData.album || 'Indie Session',
      genre: trackData.genre || 'Indie',
      duration: trackData.duration || 180,
      audio_url: trackData.audioUrl || trackData.audio_url || '',
      cover_url: trackData.coverUrl || trackData.cover_url || '/src/assets/logo.png',
      visibility: trackData.visibility || 'public',
      share_token: trackData.shareToken || trackData.share_token || null,
      likes_count: trackData.likesCount || trackData.likes_count || 0,
      uploaded_by: trackData.uploadedBy || trackData.uploaded_by || 'jamendo_api_system'
    };

    await supabase.from('tracks').insert(dbData);
    console.log(`Self-healed: Jamendo track ${trackId} seeded into database.`);
  } catch (err) {
    console.warn("Self-healing track creation failed:", err);
  }
}

// Pre-defined local tracks — seeded from the original admin audio library (src/audio → public/audio)
// Changed on 2026-05-23 21:15:00
const SEED_VERSION = 'v4'; // Bump to force-refresh stale localStorage seeds
const defaultMockTracks = [
  {
    id: 'local-001',
    title: 'Arekta Rock Gaan',
    artist: 'Arekta Rock Band',
    album: 'Original Singles',
    genre: 'Rock',
    duration: 58,
    audioUrl: '/audio/Arekta-Rock-Gaan.mp3',
    coverUrl: '/src/assets/logo.png',
    visibility: 'public',
    likesCount: 24,
    likedBy: [],
    uploadedBy: 'mock_admin_uid',
    createdAt: '2023-11-03T05:31:00.000Z'
  },
  {
    id: 'local-002',
    title: 'Nikkrishto REVISITED',
    artist: 'Aurthohin',
    album: 'One Man Band Covers',
    genre: 'Metal',
    duration: 34,
    audioUrl: '/audio/Aurthohin-Nikkrishto-Revisited.mp3',
    coverUrl: '/src/assets/logo.png',
    visibility: 'public',
    likesCount: 41,
    likedBy: [],
    uploadedBy: 'mock_admin_uid',
    createdAt: '2023-11-03T05:31:00.000Z'
  },
  {
    id: 'local-003',
    title: 'Best of 2023',
    artist: "Jarir's Station",
    album: 'Best of 2023 Compilation',
    genre: 'Pop',
    duration: 210,
    audioUrl: '/audio/BEST_OF_2023.mp3',
    coverUrl: '/src/assets/logo.png',
    visibility: 'public',
    likesCount: 18,
    likedBy: [],
    uploadedBy: 'mock_admin_uid',
    createdAt: '2023-11-03T05:31:00.000Z'
  },
  {
    id: 'local-004',
    title: 'Juwari',
    artist: 'Hridoy Khan ft. Doyeeta Dasgupta',
    album: 'Bangla Hits',
    genre: 'Bangla',
    duration: 69,
    audioUrl: '/audio/Hridoy-Khan-Juwari.mp3',
    coverUrl: '/src/assets/logo.png',
    visibility: 'public',
    likesCount: 55,
    likedBy: [],
    uploadedBy: 'mock_admin_uid',
    createdAt: '2023-11-03T05:31:00.000Z'
  },
  {
    id: 'local-005',
    title: 'Mon Bhalo Hok',
    artist: 'Elita Karim & Aupee Karim',
    album: 'Victim OST',
    genre: 'Bangla',
    duration: 60,
    audioUrl: '/audio/Elita-Karim-Mon-Bhalo-Hok.mp3',
    coverUrl: '/src/assets/logo.png',
    visibility: 'public',
    likesCount: 37,
    likedBy: [],
    uploadedBy: 'mock_admin_uid',
    createdAt: '2023-11-03T05:31:00.000Z'
  },
  {
    id: 'local-006',
    title: 'Amra Korbo Joy',
    artist: 'Ayon, Imran & Ivan',
    album: 'Film Park BD',
    genre: 'Bangla',
    duration: 65,
    audioUrl: '/audio/Amra-Korbo-Joy-Ayon-Imran-Ivan.mp3',
    coverUrl: '/src/assets/logo.png',
    visibility: 'public',
    likesCount: 29,
    likedBy: [],
    uploadedBy: 'mock_admin_uid',
    createdAt: '2023-11-03T05:31:00.000Z'
  }
];

const defaultMockAbout = {
  title: "About Jarir's Music Station",
  description: "Originally launched in November 2023, Jarir's Music Station has expanded from a minimal playback client into a world-class collaborative sharing platform for high-quality audio files.",
  mission: "To provide high-fidelity, visual, and community-driven music streaming with next-generation web controls.",
  contactEmail: "support@jarir-station.com",
  teamMembers: [
    { name: "Jarir", role: "Founder & Chief Architect", bio: "Passionate developer shaping modern music systems." }
  ],
  updatedAt: new Date().toISOString()
};

// Local storage fallback handlers
const localDb = {
  getCollection: (colName) => {
    const storeKey = `mock_${colName}`;
    const dataStr = localStorage.getItem(storeKey) || '[]';
    return JSON.parse(dataStr);
  },
  getDocument: (colName, docId) => {
    if (colName === 'settings' && docId === 'aboutUs') {
      return JSON.parse(localStorage.getItem('mock_aboutUs'));
    }
    const items = localDb.getCollection(colName);
    return items.find(item => item.id === docId) || null;
  },
  saveDocument: (colName, docId, data, merge = true) => {
    if (colName === 'settings' && docId === 'aboutUs') {
      const original = JSON.parse(localStorage.getItem('mock_aboutUs') || '{}');
      const updated = merge ? { ...original, ...data } : data;
      localStorage.setItem('mock_aboutUs', JSON.stringify(updated));
      return 'aboutUs';
    }

    const storeKey = `mock_${colName}`;
    const items = localDb.getCollection(colName);
    
    if (docId) {
      const idx = items.findIndex(item => item.id === docId);
      if (idx !== -1) {
        items[idx] = merge ? { ...items[idx], ...data } : { id: docId, ...data };
      } else {
        items.push({ id: docId, ...data });
      }
      localStorage.setItem(storeKey, JSON.stringify(items));
      return docId;
    } else {
      const newId = `${Date.now()}`;
      items.push({ id: newId, ...data });
      localStorage.setItem(storeKey, JSON.stringify(items));
      return newId;
    }
  },
  deleteDocument: (colName, docId) => {
    const storeKey = `mock_${colName}`;
    const items = localDb.getCollection(colName);
    const filtered = items.filter(item => item.id !== docId);
    localStorage.setItem(storeKey, JSON.stringify(filtered));
    return true;
  }
};

// ─── Supabase online seeder ───────────────────────────────────────────────────
// Upserts all local tracks into the Supabase 'tracks' table so they appear
// in the live online catalog alongside Jamendo tracks.
// Changed on 2026-05-23 21:15:00
async function seedLocalTracksToSupabase() {
  if (!supabase) return; // No Supabase connection — skip
  try {
    const rows = defaultMockTracks.map(t => ({
      id: t.id,
      title: t.title,
      artist: t.artist,
      album: t.album,
      genre: t.genre,
      duration: t.duration,
      audio_url: t.audioUrl,
      cover_url: t.coverUrl,
      visibility: t.visibility,
      likes_count: t.likesCount,
      uploaded_by: t.uploadedBy,
      created_at: t.createdAt,
      share_token: null
    }));
    // upsert = insert or update on conflict (safe to run every startup)
    const { error } = await supabase.from('tracks').upsert(rows, { onConflict: 'id' });
    if (error) {
      console.warn('[Seeder] Supabase local track upsert failed:', error.message);
    } else {
      console.log(`[Seeder] ${rows.length} local tracks seeded to Supabase successfully.`);
    }
  } catch (err) {
    console.warn('[Seeder] seedLocalTracksToSupabase error:', err);
  }
}

// Initialize LocalStorage with mocks
// Uses a versioned key so stale seeds are always replaced when SEED_VERSION bumps
// Changed on 2026-05-23 21:15:00
const initMockDB = () => {
  // Versioned track seed — overwrites whenever SEED_VERSION changes
  const storedVersion = localStorage.getItem('mock_tracks_version');
  if (storedVersion !== SEED_VERSION) {
    localStorage.setItem('mock_tracks', JSON.stringify(defaultMockTracks));
    localStorage.setItem('mock_tracks_version', SEED_VERSION);
    console.log(`[MockDB] Track seed refreshed to ${SEED_VERSION}`);
  }

  if (!localStorage.getItem('mock_aboutUs')) {
    localStorage.setItem('mock_aboutUs', JSON.stringify(defaultMockAbout));
  }
  if (!localStorage.getItem('mock_playlists')) {
    localStorage.setItem('mock_playlists', JSON.stringify([]));
  }

  // Dynamic seeder: ensure both the admin and demo user are always present in mock_users local storage
  // Changed on 2026-05-23 20:49:15
  let users = [];
  try {
    users = JSON.parse(localStorage.getItem('mock_users') || '[]');
  } catch (e) {
    users = [];
  }
  const defaultUsers = [
    { id: 'jarir2020', username: 'jarir2020', email: 'jarircse16@gmail.com', password: 'xD123@xD', displayName: 'jarir2020', role: 'admin' },
    { id: 'jarir-Demo', username: 'jarir-Demo', email: 'jarir1114@gmail.com', password: 'password123', displayName: 'jarir-Demo', role: 'user' }
  ];
  for (const defU of defaultUsers) {
    if (!users.some(u => u.email === defU.email)) {
      users.push(defU);
    }
  }
  localStorage.setItem('mock_users', JSON.stringify(users));

  // Seed local tracks to Supabase in the background (non-blocking)
  seedLocalTracksToSupabase();
};
initMockDB();

// Database column mappers
function mapFieldToDb(field) {
  const mapping = {
    shareToken: 'share_token',
    likesCount: 'likes_count',
    audioUrl: 'audio_url',
    coverUrl: 'cover_url',
    uploadedBy: 'uploaded_by',
    createdAt: 'created_at'
  };
  return mapping[field] || field;
}

function mapTrackFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    album: row.album,
    genre: row.genre,
    duration: row.duration,
    audioUrl: row.audio_url,
    coverUrl: row.cover_url,
    visibility: row.visibility,
    shareToken: row.share_token,
    likesCount: row.likes_count || 0,
    uploadedBy: row.uploaded_by || 'mock_admin_uid',
    createdAt: row.created_at
  };
}

function mapCommentFromDb(row) {
  if (!row) return null;
  return {
    id: row.id,
    trackId: row.track_id,
    userId: row.user_id,
    userName: row.user_name,
    content: row.content,
    songTimestamp: row.song_timestamp,
    createdAt: row.created_at
  };
}

/**
 * Merges local seeded tracks into an existing track list, deduplicating by ID.
 * Local tracks are always included — they do not depend on Supabase or Jamendo.
 * Changed on 2026-05-23 21:50:00
 */
function mergeWithLocalTracks(existingTracks) {
  const existingIds = new Set(existingTracks.map(t => t.id));
  const localOnly = defaultMockTracks.filter(t => !existingIds.has(t.id));
  return [...existingTracks, ...localOnly];
}

/**
 * Fetch collection data from Supabase, falling back to LocalStorage.
 * Local seeded tracks (defaultMockTracks) are ALWAYS merged into every result.
 * Changed on 2026-05-23 21:50:00
 */
export async function getCollectionData(colName, constraints = []) {
  // ── No Supabase: pure offline path ───────────────────────────────────────
  if (!supabase) {
    if (colName === 'tracks') {
      const localTracks = localDb.getCollection(colName);
      const jamendoTracks = await getJamendoTracks(); // uses defaults: 8 genres × 30 tracks
      // Merge order: localStorage uploads → local seeded tracks → Jamendo
      const merged = mergeWithLocalTracks([...localTracks, ...jamendoTracks]);
      return merged;
    }
    return localDb.getCollection(colName);
  }

  // ── Supabase path ─────────────────────────────────────────────────────────
  try {
    let tableName = colName;
    let trackIdFilter = null;
    if (colName.startsWith('tracks/') && colName.endsWith('/comments')) {
      tableName = 'comments';
      trackIdFilter = colName.split('/')[1];
    }

    let query = supabase.from(tableName).select('*');

    if (trackIdFilter) {
      query = query.eq('track_id', trackIdFilter);
    }

    for (const c of constraints) {
      if (c && c.type === 'where') {
        const { field, op, value } = c;
        const dbField = mapFieldToDb(field);
        if (op === '==') {
          query = query.eq(dbField, value);
        } else if (op === '>=') {
          query = query.gte(dbField, value);
        } else if (op === '<=') {
          query = query.lte(dbField, value);
        }
      }
    }

    const { data, error } = await query;

    // ── Supabase error: fall back to localStorage + local tracks + Jamendo ──
    if (error) {
      console.warn("Supabase fetch failed, falling back to LocalStorage:", error.message);
      if (colName === 'tracks') {
        const local = localDb.getCollection(colName);
        const jamendo = await getJamendoTracks();
        return mergeWithLocalTracks([...local, ...jamendo]);
      }
      return localDb.getCollection(colName);
    }

    // ── Supabase success: dbTracks + local seeded tracks + Jamendo ───────────
    if (tableName === 'tracks') {
      const dbTracks = (data || []).map(mapTrackFromDb);
      const jamendoTracks = await getJamendoTracks();

      // De-duplicate Jamendo against Supabase results
      const dbTrackIds = new Set(dbTracks.map(t => t.id));
      const filteredJamendo = jamendoTracks.filter(t => !dbTrackIds.has(t.id));

      // Always inject local seeded tracks (they may not be in Supabase yet)
      // mergeWithLocalTracks deduplicates by ID so no doubles if seeder already ran
      return mergeWithLocalTracks([...dbTracks, ...filteredJamendo]);
    } else if (tableName === 'comments') {
      return (data || []).map(mapCommentFromDb);
    }
    return data || [];

  } catch (err) {
    console.warn("Supabase error in getCollectionData, falling back:", err);
    if (colName === 'tracks') {
      const local = localDb.getCollection(colName);
      const jamendo = await getJamendoTracks();
      return mergeWithLocalTracks([...local, ...jamendo]);
    }
    return localDb.getCollection(colName);
  }
}

/**
 * Fetch the next page of Jamendo tracks using API offset pagination.
 * Called by audioStore.loadMoreJamendo() when user reaches the last page.
 * Changed on 2026-05-23 21:52:00
 *
 * @param {number} offset  Jamendo offset (multiples of JAMENDO_PAGE_SIZE, e.g. 0, 240, 480)
 */
export async function getJamendoTracksPage(offset = 0) {
  return getJamendoTracks({ offset });
}

/**
 * Fetch a single document from Supabase, falling back to LocalStorage
 */
export async function getDocumentData(colName, docId) {
  if (!supabase) {
    return localDb.getDocument(colName, docId);
  }

  try {
    if (colName === 'settings' && docId === 'aboutUs') {
      // Changed on 2026-05-23 20:25:00
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('key', 'aboutUs')
        .maybeSingle();
      if (error || !data) {
        console.warn("Supabase fetch aboutUs failed, falling back to LocalStorage:", error ? error.message : "no data");
        return localDb.getDocument(colName, docId);
      }
      return data.value;
    }

    let tableName = colName;
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', docId)
      .single();

    if (error || !data) {
      console.warn(`Supabase fetch document ${docId} failed, falling back to LocalStorage:`, error ? error.message : "no data");
      return localDb.getDocument(colName, docId);
    }

    if (tableName === 'tracks') {
      return mapTrackFromDb(data);
    }
    return data;
  } catch (err) {
    console.warn("Supabase error in getDocumentData, falling back:", err);
    return localDb.getDocument(colName, docId);
  }
}

/**
 * Save or update a document in Supabase, falling back to LocalStorage
 */
export async function saveDocumentData(colName, docId, data, merge = true) {
  // Always update local cache so offline works instantly
  localDb.saveDocument(colName, docId, data, merge);

  if (!supabase) {
    return docId || `${Date.now()}`;
  }

  try {
    if (colName === 'settings' && docId === 'aboutUs') {
      let valueToSave = data;
      if (merge) {
        const current = await getDocumentData('settings', 'aboutUs') || {};
        valueToSave = { ...current, ...data };
      }
      const { error } = await supabase
        .from('settings')
        .upsert({ key: 'aboutUs', value: valueToSave, updated_at: new Date().toISOString() });
      if (error) {
        console.warn("Supabase save aboutUs failed, fell back to LocalStorage:", error.message);
      }
      return 'aboutUs';
    }

    let tableName = colName;
    let trackId = null;
    if (colName.startsWith('tracks/') && colName.endsWith('/comments')) {
      tableName = 'comments';
      trackId = colName.split('/')[1];
    }

    // Self-healing: Ensure Jamendo track exists in PostgreSQL before writing likes or comments
    if (tableName === 'comments' && trackId && trackId.startsWith('jamendo-')) {
      await ensureTrackExistsInDb(trackId);
    }
    if (tableName === 'tracks' && docId && docId.startsWith('jamendo-')) {
      await ensureTrackExistsInDb(docId, data);
    }

    const dbData = {};
    if (tableName === 'tracks') {
      if (data.id !== undefined) dbData.id = data.id;
      if (data.title !== undefined) dbData.title = data.title;
      if (data.artist !== undefined) dbData.artist = data.artist;
      if (data.album !== undefined) dbData.album = data.album;
      if (data.genre !== undefined) dbData.genre = data.genre;
      if (data.duration !== undefined) dbData.duration = data.duration;
      if (data.audioUrl !== undefined) dbData.audio_url = data.audioUrl;
      if (data.coverUrl !== undefined) dbData.cover_url = data.coverUrl;
      if (data.visibility !== undefined) dbData.visibility = data.visibility;
      if (data.shareToken !== undefined) dbData.share_token = data.shareToken;
      if (data.likesCount !== undefined) dbData.likes_count = data.likesCount;
      if (data.uploadedBy !== undefined) dbData.uploaded_by = data.uploadedBy;
      if (data.createdAt !== undefined) dbData.created_at = data.createdAt;
    } else if (tableName === 'comments') {
      if (trackId) dbData.track_id = trackId;
      if (data.userId !== undefined) dbData.user_id = data.userId;
      if (data.userName !== undefined) dbData.user_name = data.userName;
      if (data.content !== undefined) dbData.content = data.content;
      if (data.songTimestamp !== undefined) dbData.song_timestamp = data.songTimestamp;
      if (data.createdAt !== undefined) dbData.created_at = data.createdAt;
    } else {
      Object.assign(dbData, data);
    }

    if (docId) {
      const { error } = await supabase
        .from(tableName)
        .update(dbData)
        .eq('id', docId);
      if (error) {
        console.warn(`Supabase update ${docId} failed:`, error.message);
      }
      return docId;
    } else {
      if (tableName === 'tracks' && !dbData.id) {
        dbData.id = `${Date.now()}`;
      }
      const { data: insertedData, error } = await supabase
        .from(tableName)
        .insert(dbData)
        .select();
      if (error) {
        console.warn(`Supabase insert failed:`, error.message);
        return `${Date.now()}`;
      }
      return insertedData && insertedData[0] ? insertedData[0].id : `${Date.now()}`;
    }
  } catch (err) {
    console.warn("Supabase error in saveDocumentData:", err);
    return docId || `${Date.now()}`;
  }
}

/**
 * Delete a document from Supabase, falling back to LocalStorage
 */
export async function deleteDocumentData(colName, docId) {
  localDb.deleteDocument(colName, docId);

  if (!supabase) {
    return true;
  }

  try {
    let tableName = colName;
    const { error } = await supabase
      .from(tableName)
      .delete()
      .eq('id', docId);
    if (error) {
      console.warn(`Supabase delete ${docId} failed:`, error.message);
    }
    return true;
  } catch (err) {
    console.warn("Supabase error in deleteDocumentData:", err);
    return true;
  }
}

/**
 * Self-healing uploader: uploads to Supabase storage when possible, falling back to instant local URL
 */
export async function uploadFileToStorage(folderPath, file, progressCallback) {
  if (!supabase) {
    if (progressCallback) {
      progressCallback(50);
      setTimeout(() => progressCallback(100), 100);
    }
    return URL.createObjectURL(file);
  }

  try {
    if (progressCallback) progressCallback(10);
    
    const bucketName = folderPath.includes('cover') ? 'covers' : 'tracks';
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}.${fileExt}`;
    const filePath = `${fileName}`;

    if (progressCallback) progressCallback(35);

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (error) {
      console.warn("Supabase Storage upload failed, falling back to local Object URL:", error.message);
      if (progressCallback) progressCallback(100);
      return URL.createObjectURL(file);
    }

    if (progressCallback) progressCallback(80);

    const { data: publicUrlData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath);

    if (progressCallback) progressCallback(100);
    return publicUrlData.publicUrl;
  } catch (err) {
    console.warn("Storage upload error occurred, falling back to local Object URL:", err);
    if (progressCallback) progressCallback(100);
    return URL.createObjectURL(file);
  }
}

// -------------------------------------------------------------
// Authentication — Supabase Auth (GoTrue) with localStorage dev fallback
// Rewritten on 2026-05-23 23:55:00
//
// Surface kept identical for callers:
//   - auth.currentUser            : {uid, email, displayName, role} | null
//   - onAuthStateChanged(_, cb)   : returns unsubscribe()
//   - signInWithEmailAndPassword(email, password)
//   - createUserWithEmailAndPassword(email, password, username)
//   - signOut()
// New:
//   - signInWithOAuth(provider)   : 'google' | 'github' | 'facebook'
//   - awaitAuthReady()            : resolves after initial session hydration
// -------------------------------------------------------------

let currentUserCache = null;
let authReadyResolve;
const authReady = new Promise(r => { authReadyResolve = r; });
const authListeners = new Set();

export const auth = {
  get currentUser() {
    return currentUserCache;
  }
};

// Promise that resolves once first getSession + profile fetch complete.
// Router uses this to gate navigation on startup.
export function awaitAuthReady() {
  return authReady;
}

function notifyAuthStateChanged() {
  for (const listener of authListeners) {
    try { listener(currentUserCache); } catch (e) { console.warn('[auth] listener error', e); }
  }
}

async function fetchProfile(userId) {
  if (!supabase) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username, role, avatar_url')
      .eq('id', userId)
      .single();
    if (error) {
      console.warn('[auth] profile fetch failed:', error.message);
      return null;
    }
    return data;
  } catch (err) {
    console.warn('[auth] profile fetch threw:', err);
    return null;
  }
}

async function buildUserFromSession(session) {
  if (!session?.user) return null;
  const u = session.user;
  const profile = await fetchProfile(u.id);
  return {
    uid: u.id,
    email: u.email,
    displayName: profile?.username
      || u.user_metadata?.username
      || u.user_metadata?.full_name
      || u.user_metadata?.name
      || (u.email ? u.email.split('@')[0] : 'User'),
    role: profile?.role || 'user',
    avatarUrl: profile?.avatar_url || u.user_metadata?.avatar_url || null,
    provider: u.app_metadata?.provider || 'email'
  };
}

async function refreshFromSession(session) {
  currentUserCache = await buildUserFromSession(session);
  notifyAuthStateChanged();
}

// Offline fallback: hydrate from localStorage mock_users (dev only)
function buildUserFromLocal(userRow) {
  return {
    uid: userRow.id,
    email: userRow.email,
    displayName: userRow.username || userRow.displayName || userRow.email?.split('@')[0],
    role: userRow.role || 'user',
    avatarUrl: null,
    provider: 'local'
  };
}

// ─── Bootstrap: hydrate session at module load ───────────────────────────────
(async function bootstrapAuth() {
  if (supabase) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      await refreshFromSession(session);
    } catch (err) {
      console.warn('[auth] getSession failed:', err);
      currentUserCache = null;
    }
    // Subscribe to live auth changes (token refresh, OAuth callback, signOut)
    supabase.auth.onAuthStateChange((_event, session) => {
      refreshFromSession(session);
    });
  } else {
    // Dev offline mode — re-use legacy user_session blob if present
    try {
      const cached = JSON.parse(localStorage.getItem('user_session') || 'null');
      currentUserCache = cached;
    } catch { currentUserCache = null; }
    notifyAuthStateChanged();
  }
  authReadyResolve();
})();

// onAuthStateChanged — signature preserved for callers
export function onAuthStateChanged(_authObj, callback) {
  authListeners.add(callback);
  // Fire current value asynchronously so callers can capture unsubscribe first
  Promise.resolve().then(() => callback(currentUserCache));
  return () => { authListeners.delete(callback); };
}

// ─── Sign in (email + password) ──────────────────────────────────────────────
export async function signInWithEmailAndPassword(email, password) {
  if (supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
    // refreshFromSession also fires via onAuthStateChange — but await here to
    // guarantee the caller sees populated currentUser when this returns.
    await refreshFromSession(data.session);
    return currentUserCache;
  }

  // Offline fallback (dev only)
  const users = localDb.getCollection('users');
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) throw new Error('Invalid email or password');
  currentUserCache = buildUserFromLocal(user);
  localStorage.setItem('user_session', JSON.stringify(currentUserCache));
  notifyAuthStateChanged();
  return currentUserCache;
}

// ─── Sign up ─────────────────────────────────────────────────────────────────
export async function createUserWithEmailAndPassword(email, password, username = '') {
  const displayUsername = username || email.split('@')[0];

  if (supabase) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username: displayUsername } }
    });
    if (error) throw new Error(error.message);

    // If email confirm is OFF, session is populated immediately.
    // If ON, session is null until the user clicks the confirm link.
    if (!data.session) {
      throw new Error('Account created. Check your email to confirm before signing in.');
    }
    await refreshFromSession(data.session);
    return currentUserCache;
  }

  // Offline fallback (dev only)
  const users = localDb.getCollection('users');
  if (users.some(u => u.email === email)) {
    throw new Error('Email address already registered');
  }
  const newUser = {
    id: `user-${Date.now()}`,
    username: displayUsername,
    email, password,
    role: 'user'
  };
  users.push(newUser);
  localStorage.setItem('mock_users', JSON.stringify(users));
  currentUserCache = buildUserFromLocal(newUser);
  localStorage.setItem('user_session', JSON.stringify(currentUserCache));
  notifyAuthStateChanged();
  return currentUserCache;
}

// ─── Sign out ────────────────────────────────────────────────────────────────
export async function signOut() {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) console.warn('[auth] signOut error:', error.message);
  }
  currentUserCache = null;
  localStorage.removeItem('user_session');
  notifyAuthStateChanged();
  return true;
}

// ─── OAuth (Google / GitHub / Facebook) ──────────────────────────────────────
// Redirects browser to provider. After return, detectSessionInUrl picks up
// the tokens automatically and onAuthStateChange fires.
export async function signInWithOAuth(provider) {
  if (!supabase) throw new Error('OAuth requires online Supabase connection');
  const valid = ['google', 'github', 'facebook'];
  if (!valid.includes(provider)) throw new Error(`Unsupported provider: ${provider}`);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: window.location.origin,
      queryParams: provider === 'google' ? { prompt: 'select_account' } : undefined
    }
  });
  if (error) throw new Error(error.message);
  return data;
}

export const db = null;
export const storage = null;
export const updateDoc = null;
export const where = (field, op, value) => ({ type: 'where', field, op, value });
export const orderBy = () => {};
