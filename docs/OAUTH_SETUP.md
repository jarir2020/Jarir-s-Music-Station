# OAuth Provider Setup (Google / GitHub / Facebook)

Frontend buttons are wired in [src/App.vue](../src/App.vue) (modal) and
[src/views/Login.vue](../src/views/Login.vue). They call `signInWithOAuth(provider)`
defined in [src/firebase.js](../src/firebase.js).

Each provider needs:
1. OAuth app credentials from the provider
2. Enable + paste creds in Supabase dashboard
3. Set redirect URLs

Supabase callback URL (used by ALL providers):
```
https://<your-project-ref>.supabase.co/auth/v1/callback
```
For this project, `<your-project-ref>` = `twaaogxkdehcjfvqnnsr`, so:
```
https://twaaogxkdehcjfvqnnsr.supabase.co/auth/v1/callback
```

Site URL (where the user lands after login) — set in Supabase dashboard once:
- Dashboard → Authentication → URL Configuration → **Site URL**: `http://localhost:8080` (dev) or your production domain
- Additional redirect URLs: add both `http://localhost:8080` and `http://localhost:3000` and the production domain

---

## 1. Google

### Google Cloud Console
1. https://console.cloud.google.com/ → create or pick a project.
2. APIs & Services → OAuth consent screen
   - User type: External
   - App name: `Jarir's Music Station`
   - Support email: yours
   - Authorized domains: `supabase.co`, your prod domain
   - Scopes: `email`, `profile`, `openid` (default)
   - Test users: add your Gmail
3. APIs & Services → Credentials → **Create Credentials → OAuth client ID**
   - Application type: Web application
   - Name: `Jarir Music Supabase`
   - Authorized JavaScript origins:
     - `http://localhost:8080`
     - `https://twaaogxkdehcjfvqnnsr.supabase.co`
     - your prod domain
   - Authorized redirect URIs:
     - `https://twaaogxkdehcjfvqnnsr.supabase.co/auth/v1/callback`
4. Copy **Client ID** and **Client Secret**.

### Supabase Dashboard
- Authentication → Providers → **Google** → toggle **Enabled**
- Paste Client ID + Client Secret → Save

---

## 2. GitHub

### GitHub
1. GitHub → Settings → Developer settings → **OAuth Apps** → New OAuth App
2. Fields:
   - Application name: `Jarir's Music Station`
   - Homepage URL: `http://localhost:8080` (or prod)
   - Authorization callback URL: `https://twaaogxkdehcjfvqnnsr.supabase.co/auth/v1/callback`
3. Register application → copy **Client ID**.
4. Click **Generate a new client secret** → copy immediately (shown once).

### Supabase Dashboard
- Authentication → Providers → **GitHub** → toggle **Enabled**
- Paste Client ID + Client Secret → Save

---

## 3. Facebook

### Facebook Developers
1. https://developers.facebook.com/apps/ → My Apps → **Create App**
2. Use case: "Authenticate and request data from users with Facebook Login"
3. Once created → Dashboard → add product **Facebook Login** → Web
4. Site URL: `http://localhost:8080`
5. Facebook Login → Settings →
   - Valid OAuth Redirect URIs:
     `https://twaaogxkdehcjfvqnnsr.supabase.co/auth/v1/callback`
6. App settings → Basic → copy **App ID** + **App Secret**
7. To use in production: switch from Development to Live mode (top toggle).
   - Requires a privacy policy URL + app review for `email` permission if you want more than test users.

### Supabase Dashboard
- Authentication → Providers → **Facebook** → toggle **Enabled**
- Paste App ID (as Client ID) + App Secret → Save

---

## 4. Test flow

After each provider configured:

1. Restart dev server (`npm run serve`).
2. Open app, open login modal.
3. Click **Continue with Google** (or GitHub / Facebook).
4. Browser redirects to provider → consent screen.
5. After consent, browser returns to `http://localhost:8080/`.
6. Supabase SDK auto-detects the hash params, creates a session, fires `onAuthStateChange`.
7. The `handle_new_user()` trigger in Supabase auto-creates a `public.profiles` row.
8. Sidebar should show your name; navigating to `/admin` should redirect unless your profile has `role='admin'`.

### Promote OAuth user to admin (one-time)

OAuth signup creates a profile with `role='user'`. To make yourself admin after first OAuth login:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE id = (SELECT id FROM auth.users WHERE email = 'your-oauth-email@gmail.com');
```

---

## 5. Common gotchas

| Symptom | Cause | Fix |
|---|---|---|
| `redirect_uri_mismatch` from Google | URI in GCP console ≠ Supabase callback exactly | Copy the exact `https://<ref>.supabase.co/auth/v1/callback` |
| Returns to app but no session | Site URL in Supabase not in allowed redirect list | Auth → URL Configuration → add your dev/prod URL |
| GitHub 404 on callback | Callback URL on GitHub app is wrong | Update OAuth app → callback URL |
| Facebook "App not active" | App still in Development mode + you're not a test user | Add yourself as test user or switch to Live |
| OAuth login works but profile missing | `handle_new_user` trigger missing | Re-run [sql/migrate_to_supabase_auth.sql](../sql/migrate_to_supabase_auth.sql) section 6 |
| `Email rate limit exceeded` | Supabase free tier email throttle | Wait, or set up custom SMTP |
