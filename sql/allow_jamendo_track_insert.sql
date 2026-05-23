-- Allow any authenticated user to self-heal-insert Jamendo / local seed tracks
-- into public.tracks when commenting on or liking them.
-- These rows aren't owned by anyone — `uploaded_by` stays whatever the seeder set.
-- Created on 2026-05-24 00:05:00

DROP POLICY IF EXISTS tracks_insert_jamendo ON public.tracks;
CREATE POLICY tracks_insert_jamendo ON public.tracks
  FOR INSERT TO authenticated
  WITH CHECK (
       id LIKE 'jamendo-%'
    OR id LIKE 'local-%'
  );

DROP POLICY IF EXISTS tracks_update_jamendo ON public.tracks;
CREATE POLICY tracks_update_jamendo ON public.tracks
  FOR UPDATE TO authenticated
  USING (
       id LIKE 'jamendo-%'
    OR id LIKE 'local-%'
  )
  WITH CHECK (
       id LIKE 'jamendo-%'
    OR id LIKE 'local-%'
  );

-- Verify
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.tracks'::regclass;
