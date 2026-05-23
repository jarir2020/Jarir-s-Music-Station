# Auth Strategy Plan — Supabase Auth vs Custom Auth

Project: **Jarir's Music Station**
Date: 2026-05-23
Status: **Decision pending**
Current state: Custom auth via `public.users` table + `register_user` / `login_user` SECURITY DEFINER RPCs + pgcrypto bcrypt hashing. RLS on `users` table. Session stored in `localStorage.user_session` (plain JSON).

---

## 1. Executive Summary

Two viable directions:

| | Supabase Auth (Path A) | Custom Auth Hardening (Path B) |
|---|---|---|
| Effort | Medium — one-time migration, then minimal | High up front, ongoing for each new feature |
| Security | Industry-standard out of box | Only as strong as what you build |
| Features | Email verify, password reset, OAuth, MFA, JWT all free | Build each yourself |
| Lock-in | Tied to Supabase | Portable to any Postgres |
| RLS integration | `auth.uid()` native | Workarounds required |
| Offline / localStorage fallback | Harder | Already works |

**Recommendation: Path A (Supabase Auth)** unless portability is a hard requirement. The cost of building secure custom auth (rate-limit, reset flow, session tokens, OAuth, audit) far exceeds the migration cost.

---

## 2. Current State (Baseline)

- `public.users` columns: `id text`, `username text`, `email text`, `password text` (bcrypt), `role text`.
- RLS enabled. No direct `INSERT`/`UPDATE` for `anon`. `SELECT` restricted to non-password columns.
- RPCs:
  - `register_user(email, password, username)` — SECURITY DEFINER, hashes, inserts.
  - `login_user(email, password)` — SECURITY DEFINER, verifies bcrypt (+ legacy plaintext upgrade).
- Frontend ([src/firebase.js](../src/firebase.js)):
  - `signInWithEmailAndPassword`, `createUserWithEmailAndPassword`, `signOut`, `onAuthStateChanged`, `auth.currentUser` — all custom impls calling the RPCs above.
  - Session: `localStorage.user_session = {uid, email, displayName, role}`.
  - Offline fallback: `mock_users` in localStorage.
- Other tables (`tracks`, `comments`, `playlists`) — RLS state unknown; `uploaded_by` / `user_id` stored as custom `user-<epoch>` strings.

---

## 3. Path A — Supabase Auth Migration

### 3.1 Target architecture

```
auth.users (managed by Supabase)
   ├─ id uuid          (PK, exposed as auth.uid())
   ├─ email
   ├─ encrypted_password   (bcrypt, GoTrue-managed)
   ├─ email_confirmed_at
   └─ ... (refresh tokens, MFA factors, etc.)

public.profiles (replaces public.users)
   ├─ id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
   ├─ username text UNIQUE
   ├─ role text DEFAULT 'user'
   ├─ avatar_url text
   └─ created_at timestamptz DEFAULT now()
```

### 3.2 Steps

**Phase 1 — DB schema**

1. Enable Email provider in Supabase Dashboard → Authentication → Providers.
2. Disable email confirmation for dev (re-enable for prod).
3. Create `public.profiles`:
   ```sql
   CREATE TABLE public.profiles (
     id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
     username text UNIQUE NOT NULL,
     role text NOT NULL DEFAULT 'user',
     avatar_url text,
     created_at timestamptz DEFAULT now()
   );
   ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

   CREATE POLICY profiles_self_read ON public.profiles
     FOR SELECT TO authenticated USING (true);
   CREATE POLICY profiles_self_write ON public.profiles
     FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
   ```
4. Trigger to auto-create profile on signup:
   ```sql
   CREATE OR REPLACE FUNCTION public.handle_new_user()
   RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
   BEGIN
     INSERT INTO public.profiles (id, username, role)
     VALUES (
       NEW.id,
       COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email,'@',1)),
       'user'
     );
     RETURN NEW;
   END;$$;

   CREATE TRIGGER on_auth_user_created
     AFTER INSERT ON auth.users
     FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
   ```

**Phase 2 — Frontend rewrite** ([src/firebase.js](../src/firebase.js))

| Function | Replace with |
|---|---|
| `createUserWithEmailAndPassword(email, password, username)` | `supabase.auth.signUp({ email, password, options: { data: { username } } })` |
| `signInWithEmailAndPassword(email, password)` | `supabase.auth.signInWithPassword({ email, password })` |
| `signOut()` | `supabase.auth.signOut()` |
| `onAuthStateChanged(_, cb)` | `supabase.auth.onAuthStateChange((_event, session) => cb(session?.user))` |
| `auth.currentUser` | `(await supabase.auth.getUser()).data.user` (or cached from `onAuthStateChange`) |
| `localStorage.user_session` | Delete — Supabase SDK manages session in `sb-*` keys with auto-refresh |
| Role check (`role: 'admin'`) | Fetch `profiles.role` after auth, cache on user object |

**Phase 3 — Migrate existing rows**

Existing `public.users` rows must move to `auth.users`. GoTrue does not accept arbitrary bcrypt hashes via public API. Options:

- **Option 3a (recommended): Force reset.** Email each existing user a Supabase password-reset link. They set new password. Bcrypt from old table discarded.
- **Option 3b: Admin import.** Use `supabase.auth.admin.createUser({email, password_hash})` via service-role key in a one-time Node script. GoTrue *does* accept pre-hashed bcrypt if formatted correctly. Caveats: service-role key only, run server-side.
- **Option 3c: Dual-auth period.** New users → Supabase Auth. Old users → keep RPC login until they reset. Two code paths. Sunset old after N months.

Map old `user-<epoch>` ids to new `auth.users.id` (uuid). Update FK columns (`uploaded_by`, `user_id`) — likely requires:
```sql
ALTER TABLE tracks ALTER COLUMN uploaded_by TYPE uuid USING uploaded_by::uuid;
```
…or keep as `text` and store uuid string. Type change risky if data not uuid-compatible.

**Phase 4 — RLS on other tables**

```sql
-- tracks
ALTER TABLE public.tracks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tracks_public_read ON public.tracks
  FOR SELECT TO anon, authenticated USING (visibility = 'public');
CREATE POLICY tracks_owner_all ON public.tracks
  FOR ALL TO authenticated
  USING (uploaded_by = auth.uid()::text)
  WITH CHECK (uploaded_by = auth.uid()::text);

-- comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY comments_read_all ON public.comments
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY comments_owner_write ON public.comments
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid()::text);
CREATE POLICY comments_owner_delete ON public.comments
  FOR DELETE TO authenticated USING (user_id = auth.uid()::text);
```

Admin override: `auth.jwt() ->> 'role' = 'admin'` (after JWT custom claim hook).

**Phase 5 — Cleanup**

- Drop `register_user`, `login_user` RPCs.
- Drop `password` column from `public.users` (or rename table to `profiles_legacy`).
- Delete localStorage offline auth fallback — Supabase Auth requires network.

### 3.3 Effort estimate

| Phase | Effort |
|---|---|
| 1. DB schema + trigger | 1–2 h |
| 2. Frontend rewrite | 2–4 h |
| 3. Migration of existing rows | 2–6 h (depends on option) |
| 4. RLS on other tables | 1–2 h |
| 5. Cleanup | 1 h |
| **Total** | **~1–2 days** |

### 3.4 Risks

- All existing sessions invalidate. Users must re-login.
- Offline-fallback path in `firebase.js` becomes a no-op without network.
- Type changes on FK columns may fail if old ids non-uuid.
- Email delivery requires SMTP setup (or Supabase's built-in dev sender; throttled).

### 3.5 Benefits (free)

- Password reset, email verify, magic links, OAuth (Google/GitHub/etc.), MFA, anonymous sign-in.
- JWT with auto-refresh.
- `auth.uid()` native in RLS.
- Audit log in Supabase dashboard.
- Rate-limiting on signup/login built in.

---

## 4. Path B — Custom Auth Hardening

Keep current architecture. Add missing pieces.

### 4.1 Required additions

**1. Session tokens (replace plain localStorage)**

```sql
CREATE TABLE public.sessions (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamptz DEFAULT now(),
  ip text,
  user_agent text
);

CREATE INDEX ON public.sessions(user_id);
CREATE INDEX ON public.sessions(expires_at);

-- login_user returns token instead of full user row
-- validate_session(token) → user row if valid, else null
-- logout(token) deletes the row
```

Frontend stores only `token`. Every protected call uses RPC that validates token.

**2. Lock all writes behind SECURITY DEFINER RPCs**

No direct `supabase.from('tracks').insert(...)`. Instead:

```sql
CREATE FUNCTION public.add_track(session_token uuid, track jsonb) ...
CREATE FUNCTION public.update_track(session_token uuid, track_id text, changes jsonb) ...
CREATE FUNCTION public.delete_track(session_token uuid, track_id text) ...
CREATE FUNCTION public.add_comment(session_token uuid, track_id text, content text, ...) ...
```

Each verifies token → resolves user_id → checks ownership → mutates.

Direct table access via RLS: deny all writes for `anon` + `authenticated`.

**3. Rate limit login**

```sql
CREATE TABLE public.login_attempts (
  email text NOT NULL,
  ts timestamptz DEFAULT now(),
  success bool
);
CREATE INDEX ON public.login_attempts(email, ts);

-- Inside login_user: reject if > 5 failed attempts in last 60s
```

**4. Password reset flow**

```sql
CREATE TABLE public.password_resets (
  token uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '1 hour'),
  used bool DEFAULT false
);

CREATE FUNCTION public.request_password_reset(user_email text) ...
CREATE FUNCTION public.reset_password(reset_token uuid, new_password text) ...
```

Email delivery: needs external SMTP (Resend, SendGrid, Mailgun) — Supabase does **not** send custom mails on your behalf.

**5. Email verification (optional)**

Same pattern. `email_verifications` table + RPCs.

**6. OAuth (Google, GitHub) — if needed**

Hard without Supabase Auth. Manual implementation: redirect to OAuth provider, callback handler, exchange code for token, fetch profile, upsert user. Hosting a callback URL needed.

Alternative: drop OAuth requirement, or partially adopt Supabase Auth for OAuth only (hybrid — messy).

**7. Audit log**

```sql
CREATE TABLE public.auth_events (
  id bigserial PRIMARY KEY,
  user_id text,
  event text,  -- login_ok, login_fail, register, password_reset, ...
  ts timestamptz DEFAULT now(),
  ip text,
  user_agent text
);
```

**8. Frontend changes**

- `localStorage.user_session` → store only `{ token, expires_at }`.
- Every RPC call passes `session_token`.
- Periodic refresh: re-validate token, log out if expired.
- XSS-resistant token storage: `httpOnly` cookie ideal, but Supabase client cannot set those (requires backend). Best available: keep in localStorage + strict CSP.

### 4.2 Effort estimate

| Item | Effort |
|---|---|
| Session tokens + validate_session RPC | 3–5 h |
| Convert every write to SECURITY DEFINER RPC | 6–10 h (depends on count) |
| Rate-limit | 1–2 h |
| Password reset (+ SMTP integration) | 4–8 h |
| Email verification | 2–4 h |
| OAuth | 1–2 weeks per provider |
| Audit log | 1–2 h |
| Frontend wiring | 4–8 h |
| **Total (excluding OAuth)** | **~3–5 days** |
| **With OAuth** | **+ 1–2 weeks each** |

### 4.3 Risks

- Every new auth feature = new code = new bug surface.
- Easy to introduce timing attacks, replay attacks, IDOR if not careful.
- No external audit. Bugs ship to prod.
- Maintenance burden permanent.

### 4.4 Benefits

- Full control. No vendor opinions.
- Portable: works on any Postgres host (not Supabase-specific).
- Offline-friendly: existing localStorage fallback path keeps working.
- No third-party SMTP dependency for transactional email if you stay invite-only.

---

## 5. Side-by-Side Comparison

| Concern | Supabase Auth | Custom Auth |
|---|---|---|
| Sign up / sign in | Built-in | Need RPCs + frontend |
| Password hashing | Built-in (bcrypt) | Done (pgcrypto) ✅ |
| Password reset | Built-in (email link) | Build + SMTP |
| Email verify | Built-in | Build + SMTP |
| Magic link | Built-in | Build + SMTP |
| OAuth (Google/GitHub) | Built-in, one-click | Manual implementation per provider |
| MFA / TOTP | Built-in | Major undertaking |
| Session tokens | JWT + refresh tokens, auto-managed | Build session table + RPCs |
| Rate limit | Built-in | Build |
| Audit log | Dashboard view | Build |
| RLS integration (`auth.uid()`) | Native | Workaround via SECURITY DEFINER RPCs |
| Offline mode | Not supported | Already supported in code |
| Code in repo | Less (uses SDK) | More (custom logic) |
| Lock-in | Supabase-specific | Portable Postgres |
| Time to ship Phase 1 | ~1–2 days | ~3–5 days minimum |
| Long-term maintenance | Low | High |

---

## 6. Decision Matrix

Pick **Path A (Supabase Auth)** if:
- You plan to add OAuth, email verify, password reset, MFA at any point.
- You are not planning to move off Supabase soon.
- You want to minimize ongoing security maintenance.
- You're OK losing the offline localStorage auth fallback.

Pick **Path B (Custom Auth Hardening)** if:
- Portability across Postgres hosts is a hard requirement.
- You will never need OAuth / MFA / managed reset flows.
- You want offline auth fallback to keep working.
- You have time and inclination to maintain auth code.

---

## 7. Recommended Path Forward

1. **Now:** Stay on current pgcrypto-hashed custom auth — it works.
2. **Short term (1–2 weeks):** Decide Path A or B.
3. **If Path A:**
   - Implement Phase 1 + 2 on a feature branch.
   - Use Option 3c (dual-auth) to migrate users without disruption.
   - Complete Phase 4 + 5 after all users moved.
4. **If Path B:**
   - Implement session tokens first (highest security gap).
   - Then RPC-only writes.
   - Defer OAuth/reset until actually needed.

---

## 8. Open Questions

- Do you need OAuth (Google/Facebook/GitHub login)? — If yes, Path A is much cheaper.
- How many existing users? — Affects migration complexity.
- Is offline mode (localStorage `mock_users`) a real product feature or dev convenience? — If real, Path B preserves it; Path A loses it.
- Is "admin" role used anywhere besides UI gating? — Affects JWT custom-claim setup in Path A.

Answer these → final decision becomes obvious.
