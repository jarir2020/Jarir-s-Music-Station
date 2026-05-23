-- Hash passwords with pgcrypto (bcrypt). Backward-compatible: existing
-- plaintext rows are auto-migrated on first successful login.
-- Run after fix_users_rls_register.sql.
-- Created on 2026-05-23 22:35:00

-- 1. Enable extension (idempotent)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. Drop old versions (return type / body change)
DROP FUNCTION IF EXISTS public.register_user(text, text, text);
DROP FUNCTION IF EXISTS public.login_user(text, text);

-- 3. Register — store bcrypt hash, never plaintext
CREATE OR REPLACE FUNCTION public.register_user(
  user_email    text,
  user_password text,
  user_username text
) RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  hashed text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE email = user_email) THEN
    RAISE EXCEPTION 'Email address already registered';
  END IF;

  hashed := crypt(user_password, gen_salt('bf', 10));  -- bcrypt cost 10

  RETURN QUERY
  INSERT INTO public.users (id, username, email, password, role)
  VALUES (
    'user-' || extract(epoch from now())::bigint::text,
    user_username,
    user_email,
    hashed,
    'user'
  )
  RETURNING *;
END;
$$;

GRANT EXECUTE ON FUNCTION public.register_user(text, text, text) TO anon, authenticated;

-- 4. Login — verify against bcrypt OR plaintext (auto-upgrade legacy rows)
CREATE OR REPLACE FUNCTION public.login_user(
  user_email    text,
  user_password text
) RETURNS SETOF public.users
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  found_user public.users%ROWTYPE;
BEGIN
  SELECT * INTO found_user FROM public.users WHERE email = user_email LIMIT 1;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Case A: bcrypt hash (starts with $2)
  IF found_user.password LIKE '$2%' THEN
    IF crypt(user_password, found_user.password) = found_user.password THEN
      RETURN NEXT found_user;
    END IF;
    RETURN;
  END IF;

  -- Case B: legacy plaintext — verify, then upgrade in place
  IF found_user.password = user_password THEN
    UPDATE public.users
       SET password = crypt(user_password, gen_salt('bf', 10))
     WHERE id = found_user.id
     RETURNING * INTO found_user;
    RETURN NEXT found_user;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.login_user(text, text) TO anon, authenticated;

-- 5. Lock direct table access (force RPC path)
-- Already enabled via RLS; ensure no broad policies remain.
-- Optional hardening: revoke SELECT on password column from anon/authenticated
REVOKE SELECT ON public.users FROM anon, authenticated;
GRANT SELECT (id, username, email, role) ON public.users TO anon, authenticated;

-- 6. Sanity
-- SELECT * FROM public.register_user('hash-test@example.com', 'pw123', 'hashtest');
-- SELECT * FROM public.login_user('hash-test@example.com', 'pw123');     -- ok
-- SELECT * FROM public.login_user('hash-test@example.com', 'wrong');     -- empty
