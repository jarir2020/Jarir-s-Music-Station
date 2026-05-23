-- Fix broken /src/assets/logo.png cover URLs (only valid in Vite dev)
-- Created on 2026-05-24 01:20:00

UPDATE public.tracks
SET cover_url = '/logo.png'
WHERE cover_url = '/src/assets/logo.png'
   OR cover_url LIKE '%/src/assets/logo.png';

-- Verify
SELECT id, title, cover_url FROM public.tracks
WHERE cover_url LIKE '%logo%'
ORDER BY id
LIMIT 20;
