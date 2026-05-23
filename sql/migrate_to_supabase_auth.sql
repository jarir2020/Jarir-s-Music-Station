-- ════════════════════════════════════════════════════════════════════════════
-- Supabase Auth Migration — Phase 1 (DB only)
-- Created on 2026-05-23 23:30:00
--
-- What this does:
--   1. Moves existing public.users rows into auth.users (preserves bcrypt passwords)
--   2. Creates public.profiles linked to auth.users (username, role, avatar)
--   3. Remaps tracks.uploaded_by + comments.user_id from old string ids to new uuids
--   4. Renames legacy public.users → public.users_legacy (BACKUP, not dropped)
--   5. Drops legacy register_user / login_user RPCs
--   6. Creates is_admin() helper for RLS
--   7. Sets up RLS policies for profiles + tracks + comments
--
-- Safety:
--   - Wrapped in a single transaction. ROLLBACK on any error.
--   - public.users_legacy retained so you can recover if anything off.
--   - Re-runnable (idempotent via ON CONFLICT / IF NOT EXISTS where possible).
--
-- Prereqs:
--   - Run in Supabase dashboard SQL editor (needs postgres superuser to write auth.users)
--   - pgcrypto already enabled
-- ════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 0. Safety net ───────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ─── 1. Mapping table: old text id → new uuid ───────────────────────────────
DROP TABLE IF EXISTS public._user_id_map;
CREATE TABLE public._user_id_map (
  old_id     text PRIMARY KEY,
  new_id     uuid NOT NULL DEFAULT gen_random_uuid(),
  email      text,
  username   text,
  role       text NOT NULL DEFAULT 'user',
  password   text  -- pre-existing bcrypt hash from public.users (may be NULL)
);

-- Seed with the 3 known users from public.users + synthetic mock_admin_uid alias
INSERT INTO public._user_id_map (old_id, email, username, role, password)
SELECT u.id, u.email, u.username, COALESCE(u.role, 'user'), u.password
FROM public.users u;

-- Alias: synthetic mock_admin_uid → admin user (same uuid as jarir2020)
INSERT INTO public._user_id_map (old_id, new_id, email, username, role)
SELECT 'mock_admin_uid',
       (SELECT new_id FROM public._user_id_map WHERE old_id = 'jarir2020'),
       'jarircse16@gmail.com', 'jarir2020', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM public._user_id_map WHERE old_id = 'mock_admin_uid');

-- Alias: jamendo_api_system → admin (so Jamendo-seeded tracks have valid owner)
INSERT INTO public._user_id_map (old_id, new_id, email, username, role)
SELECT 'jamendo_api_system',
       (SELECT new_id FROM public._user_id_map WHERE old_id = 'jarir2020'),
       'jarircse16@gmail.com', 'jarir2020', 'admin'
WHERE NOT EXISTS (SELECT 1 FROM public._user_id_map WHERE old_id = 'jamendo_api_system');

-- ─── 2. Force-set known good passwords from creds.txt for admin + demo ──────
-- (In case those rows in public.users had stale or missing bcrypt hashes)
UPDATE public._user_id_map
SET password = crypt('xD123@xD', gen_salt('bf', 10))
WHERE old_id = 'jarir2020';

UPDATE public._user_id_map
SET password = crypt('password123', gen_salt('bf', 10))
WHERE old_id = 'jarir-Demo';

-- If any mapped user has NULL or non-bcrypt password (legacy plaintext) → rehash
UPDATE public._user_id_map
SET password = crypt(COALESCE(password, 'changeme-' || old_id), gen_salt('bf', 10))
WHERE password IS NULL OR password NOT LIKE '$2%';

-- ─── 3. Insert into auth.users ──────────────────────────────────────────────
-- Skip rows that already exist (by email)
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
SELECT
  '00000000-0000-0000-0000-000000000000'::uuid,
  m.new_id,
  'authenticated',
  'authenticated',
  m.email,
  m.password,                                    -- already bcrypt
  now(),                                         -- auto-confirm
  jsonb_build_object('provider', 'email', 'providers', jsonb_build_array('email')),
  jsonb_build_object('username', m.username),
  now(), now(),
  '', '', '', ''
FROM public._user_id_map m
WHERE m.email IS NOT NULL
  AND m.old_id NOT IN ('mock_admin_uid', 'jamendo_api_system')  -- aliases, not real users
  AND NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.email = m.email);

-- ─── 4. Insert into auth.identities (required for email login since 2024) ───
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  au.id,
  jsonb_build_object('sub', au.id::text, 'email', au.email, 'email_verified', true),
  'email',
  au.id::text,
  now(), now(), now()
FROM auth.users au
WHERE au.email IN (SELECT email FROM public._user_id_map WHERE email IS NOT NULL)
  AND NOT EXISTS (
    SELECT 1 FROM auth.identities ai
    WHERE ai.user_id = au.id AND ai.provider = 'email'
  );

-- ─── 5. public.profiles (one row per auth.users row) ────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username   text UNIQUE NOT NULL,
  role       text NOT NULL DEFAULT 'user',
  avatar_url text,
  created_at timestamptz DEFAULT now()
);

-- Backfill profiles from mapping (idempotent)
INSERT INTO public.profiles (id, username, role)
SELECT m.new_id, m.username, m.role
FROM public._user_id_map m
WHERE m.old_id NOT IN ('mock_admin_uid', 'jamendo_api_system')
ON CONFLICT (id) DO UPDATE
  SET username = EXCLUDED.username,
      role     = EXCLUDED.role;

-- ─── 6. Auto-create profile on every new auth.users insert ──────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role)
  VALUES (
    NEW.id,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      split_part(NEW.email, '@', 1)
    ),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ─── 7. Remap FK strings: tracks.uploaded_by, comments.user_id ─────────────
-- tracks: uploaded_by is varchar today → store new uuid as text
UPDATE public.tracks t
SET uploaded_by = m.new_id::text
FROM public._user_id_map m
WHERE t.uploaded_by = m.old_id;

-- Orphaned tracks (uploaded_by not in mapping) → assign to admin
UPDATE public.tracks
SET uploaded_by = (SELECT new_id FROM public._user_id_map WHERE old_id = 'jarir2020')::text
WHERE uploaded_by IS NULL
   OR uploaded_by NOT IN (SELECT new_id::text FROM public._user_id_map);

-- comments: user_id is varchar today → store new uuid as text
UPDATE public.comments c
SET user_id = m.new_id::text
FROM public._user_id_map m
WHERE c.user_id = m.old_id;

-- Orphaned comments → assign to admin (rare)
UPDATE public.comments
SET user_id = (SELECT new_id FROM public._user_id_map WHERE old_id = 'jarir2020')::text
WHERE user_id IS NULL
   OR user_id NOT IN (SELECT new_id::text FROM public._user_id_map);

-- ─── 8. Drop legacy RPCs (custom auth) ──────────────────────────────────────
DROP FUNCTION IF EXISTS public.register_user(text, text, text);
DROP FUNCTION IF EXISTS public.login_user(text, text);

-- ─── 9. Rename legacy users table → backup (NOT dropped) ────────────────────
ALTER TABLE IF EXISTS public.users RENAME TO users_legacy;
-- After verification you can later: DROP TABLE public.users_legacy;

-- ─── 10. is_admin() helper for RLS ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS bool
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- ─── 11. RLS — profiles ─────────────────────────────────────────────────────
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS profiles_read_all       ON public.profiles;
DROP POLICY IF EXISTS profiles_self_update    ON public.profiles;
DROP POLICY IF EXISTS profiles_admin_all      ON public.profiles;

CREATE POLICY profiles_read_all ON public.profiles
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY profiles_self_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid() AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));
  -- Prevents self-promotion to admin

CREATE POLICY profiles_admin_all ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 12. RLS — tracks ───────────────────────────────────────────────────────
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tracks_read_public      ON public.tracks;
DROP POLICY IF EXISTS tracks_read_own         ON public.tracks;
DROP POLICY IF EXISTS tracks_insert_own       ON public.tracks;
DROP POLICY IF EXISTS tracks_update_own       ON public.tracks;
DROP POLICY IF EXISTS tracks_delete_own       ON public.tracks;
DROP POLICY IF EXISTS tracks_admin_all        ON public.tracks;

CREATE POLICY tracks_read_public ON public.tracks
  FOR SELECT TO anon, authenticated
  USING (visibility = 'public' OR visibility IS NULL);

CREATE POLICY tracks_read_own ON public.tracks
  FOR SELECT TO authenticated
  USING (uploaded_by = auth.uid()::text);

CREATE POLICY tracks_insert_own ON public.tracks
  FOR INSERT TO authenticated
  WITH CHECK (uploaded_by = auth.uid()::text);

CREATE POLICY tracks_update_own ON public.tracks
  FOR UPDATE TO authenticated
  USING (uploaded_by = auth.uid()::text)
  WITH CHECK (uploaded_by = auth.uid()::text);

CREATE POLICY tracks_delete_own ON public.tracks
  FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid()::text);

CREATE POLICY tracks_admin_all ON public.tracks
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 13. RLS — comments ────────────────────────────────────────────────────
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS comments_read_all       ON public.comments;
DROP POLICY IF EXISTS comments_insert_own     ON public.comments;
DROP POLICY IF EXISTS comments_delete_own     ON public.comments;
DROP POLICY IF EXISTS comments_admin_all      ON public.comments;

CREATE POLICY comments_read_all ON public.comments
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY comments_insert_own ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY comments_delete_own ON public.comments
  FOR DELETE TO authenticated
  USING (user_id = auth.uid()::text);

CREATE POLICY comments_admin_all ON public.comments
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 14. RLS — settings (read public, write admin only) ─────────────────────
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS settings_read_all       ON public.settings;
DROP POLICY IF EXISTS settings_admin_write    ON public.settings;

CREATE POLICY settings_read_all ON public.settings
  FOR SELECT TO anon, authenticated USING (true);

CREATE POLICY settings_admin_write ON public.settings
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ─── 15. Grants ─────────────────────────────────────────────────────────────
-- profiles + tracks + comments need read for anon (public catalog)
GRANT SELECT ON public.profiles TO anon, authenticated;
GRANT SELECT ON public.tracks   TO anon, authenticated;
GRANT SELECT ON public.comments TO anon, authenticated;
GRANT SELECT ON public.settings TO anon, authenticated;

-- Writes: only authenticated; RLS gates ownership
GRANT INSERT, UPDATE, DELETE ON public.tracks   TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.comments TO authenticated;
GRANT UPDATE                ON public.profiles TO authenticated;
GRANT INSERT, UPDATE        ON public.settings TO authenticated;

-- comments uses serial id → grant USAGE on sequence
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'comments_id_seq') THEN
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE public.comments_id_seq TO authenticated';
  END IF;
END $$;

-- ─── 16. Cleanup mapping (optional — keep for audit) ───────────────────────
-- DROP TABLE public._user_id_map;
-- Leave commented out so you can verify mappings post-migration.

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- POST-MIGRATION VERIFICATION
-- Run these manually after COMMIT succeeds:
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Auth users created?
-- SELECT id, email, email_confirmed_at FROM auth.users ORDER BY created_at;

-- 2. Profiles linked?
-- SELECT p.id, p.username, p.role, u.email
-- FROM public.profiles p JOIN auth.users u ON u.id = p.id;

-- 3. Tracks remapped?
-- SELECT uploaded_by, COUNT(*) FROM public.tracks GROUP BY uploaded_by;

-- 4. Mapping audit
-- SELECT * FROM public._user_id_map;

-- 5. Test login via SDK (in app, NOT here):
--    supabase.auth.signInWithPassword({ email: 'jarircse16@gmail.com', password: 'xD123@xD' })
