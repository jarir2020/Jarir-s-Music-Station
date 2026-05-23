-- Fix A: SECURITY DEFINER RPCs for register/login on public.users
-- Resolves: "new row violates row-level security policy for table users"
-- Run in Supabase SQL editor once. Safe to re-run (CREATE OR REPLACE).
-- Created on 2026-05-23 22:10:00

-- Drop old versions (return type changed → CREATE OR REPLACE alone fails)
-- Changed on 2026-05-23 22:18:00
DROP FUNCTION IF EXISTS public.register_user(text, text, text);
DROP FUNCTION IF EXISTS public.login_user(text, text);

-- ─── Register ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.register_user(
  user_email    text,
  user_password text,
  user_username text
) RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE email = user_email) THEN
    RAISE EXCEPTION 'Email address already registered';
  END IF;

  RETURN QUERY
  INSERT INTO public.users (id, username, email, password, role)
  VALUES (
    'user-' || extract(epoch from now())::bigint::text,
    user_username,
    user_email,
    user_password,
    'user'
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO anon, authenticated;

-- ─── Login ───────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.login_user(
  user_email    text,
  user_password text
) RETURNS SETOF public.users
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT *
  FROM public.users
  WHERE email = user_email
    AND password = user_password
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.login_user(text, text) TO anon, authenticated;

-- ─── Verify ──────────────────────────────────────────────────────────────────
-- SELECT * FROM public.register_user('test@example.com', 'pw123', 'tester');
-- SELECT * FROM public.login_user('test@example.com', 'pw123');
