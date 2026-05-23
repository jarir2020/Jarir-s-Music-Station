-- Run in Supabase SQL editor. Reports row counts + samples of each table.
-- Use output to decide migration strategy.
-- Created on 2026-05-23 22:55:00

-- 1. All tables in public schema
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;

-- 2. Row counts per table (skips tables that don't exist)
-- Changed on 2026-05-23 23:05:00
DO $$
DECLARE
  t text;
  cnt bigint;
  tables text[] := ARRAY['users','tracks','comments','playlists','settings','likes'];
BEGIN
  RAISE NOTICE '--- Row counts ---';
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.' || t) IS NOT NULL THEN
      EXECUTE format('SELECT COUNT(*) FROM public.%I', t) INTO cnt;
      RAISE NOTICE '% : %', t, cnt;
    ELSE
      RAISE NOTICE '% : (table does not exist)', t;
    END IF;
  END LOOP;
END $$;

-- 3. Sample users (id, email, role — no password)
SELECT id, username, email, role
FROM public.users
ORDER BY id
LIMIT 20;

-- 4. Sample tracks
SELECT id, title, artist, uploaded_by, visibility, created_at
FROM public.tracks
ORDER BY created_at DESC NULLS LAST
LIMIT 20;

-- 5. Distinct uploaded_by values (so we know which user-ids own tracks)
SELECT uploaded_by, COUNT(*) AS track_count
FROM public.tracks
GROUP BY uploaded_by
ORDER BY track_count DESC;

-- 6. Sample comments
SELECT id, track_id, user_id, user_name, LEFT(content, 80) AS preview, created_at
FROM public.comments
ORDER BY created_at DESC NULLS LAST
LIMIT 20;

-- 7. Settings (about us etc.)
SELECT key, jsonb_pretty(value) AS value, updated_at
FROM public.settings;

-- 8. Column schema for tracks (so we know exact types before migration)
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'tracks'
ORDER BY ordinal_position;

-- 9. Column schema for comments
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'comments'
ORDER BY ordinal_position;

-- 10. Foreign keys referencing users
SELECT
  tc.table_name      AS dependent_table,
  kcu.column_name    AS dependent_column,
  ccu.table_name     AS references_table,
  ccu.column_name    AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'users';
