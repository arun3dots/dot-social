# End-to-end test report — Social-media automation app
Tested 2026-10-01 by Hermes. Server: `next start` on http://localhost:3000 (rebuilt from your latest code + `.env`).

---

## 0. Four fixes I had to make before testing meant anything

| Fix | Why it was required |
|---|---|
| **Restarted the server** | `.env` was edited at 14:24 but the server had been running since 11:07 — **your Google and DeepSeek keys were never loaded**. |
| **`api/calendar/generate/route.ts`** | The route took `apiKey` **from the request body and never read `.env`**, so the server's key was dead code and every generation fell back to a hard-coded template. It now resolves BYOK → server env, and falls back to whichever provider actually has a key. |
| **`page.tsx` — `INITIAL_CONNECTIONS`** | Hardcoded all three channels as `connected: true` with invented handles (`@jane_creator_x`…). The UI *displayed* connections that never existed. Now starts honestly disconnected. |
| **`page.tsx` — `handleToggleConnect`** | Only flipped local React state and showed a toast; it never called the OAuth route. Now performs a real OAuth handoff, and reads `?connected=&mode=` on return. |

---

## 1. The seven steps you asked for

| # | Step | Verdict | Evidence |
|---|---|---|---|
| 1 | **Sign up with Google** | ❌ **BLOCKED** | `Error 400: redirect_uri_mismatch` — Google refuses before the consent screen |
| 2 | **Log in with Google** | ❌ **BLOCKED** | same root cause |
| 3 | **Choose pricing package (free, no payment)** | ✅ **WORKS** | `POST /api/subscriptions {tier:"FREE_TRIAL"}` → 200, "Successfully upgraded to Free Trial", persisted. See defect 3a below |
| 4 | **Connect LinkedIn** | ⚠️ **SANDBOX ONLY** | Flow now runs end-to-end but returns `?connected=LINKEDIN&mode=sandbox` — `LINKEDIN_CLIENT_ID/SECRET` are empty. And see defect 4a: the callback is a stub |
| 5 | **Connect Instagram** | ⚠️ **SANDBOX ONLY** | same — `INSTAGRAM_APP_ID/SECRET` empty; same stub callback |
| 6 | **Generate content calendar** | ✅ **WORKS — real AI** | Was a 0.4 s template; now **8.0 s** via DeepSeek with 3/3 *distinct*, on-topic days ("There's something magical about a bubbling sourdough starter…") |
| 7 | **Posts generating with images** | ⚠️ **PARTIAL** | Posts render with images (6 of 9) — but they are **stock Unsplash photos**, never generated. Twitter posts have no image. Card says "AI Visual Ready", which overstates it |

---

## 2. Defects found (beyond the seven steps)

**2a. Generated calendars are lost on reload — highest-impact bug.**
After generating through the UI, `content_calendars` = **0 rows**; reloading `/` shows nothing (verified: calendar present → reload → gone, images 0). The generate route never writes to the database. Everything you generate is ephemeral React state — so "Approve & Schedule", `published_history`, and any real scheduling have nothing durable to work from.

**2b. The OAuth callback fabricates its token.** `social/oauth/[platform]/callback/route.ts` never exchanges the auth code — the real exchange is a *comment*. It mints `mockToken = live_tok_<timestamp>`, stores it with **`is_sandbox = FALSE`**, and redirects as `mode=live`. With real credentials this would report a **live** connection backed by a token the platform will reject at publish time.

**2c. Multi-tenant breakage.** Both `/api/subscriptions` and the OAuth callback hardcode `user_id = 'usr_creator_01'`. Signing in as anyone still reads/writes **Jane Creator's** subscription and connections. In a SaaS this is data leakage between tenants.

**2d. Seeded fake state in the database.** `social_connections` holds 3 rows for `usr_creator_01` with `connected = true` and invented handles. Nothing in the UI reads them, but any API consumer would be told the user has live connections.

**2e. Placeholder images presented as AI visuals.** `generate_calendar.py` picks from a fixed list of Unsplash URLs; there is **no image-generation API anywhere in the project**. The `mediaPrompt` (a description of an image) is generated and then never used to render anything.

**2f. No scheduler.** No BullMQ, no cron, no worker. Publishing is a manual "Dispatch Now", which runs `tools/scheduler_worker.py` with `isSandbox = true` by default — it simulates the post.

**2g. Still no version control.** `D:\POC\Social-media` is not a git repo, so all four fixes I made are unversioned.

---

## 3. To unblock each

**Google sign-in (2-minute fix):** Google Cloud Console → APIs & Services → Credentials → your OAuth 2.0 Client ID → **Authorized redirect URIs** → add exactly:
```
http://localhost:3000/api/auth/callback/google
```
and under **Authorized JavaScript origins** add `http://localhost:3000`. Save, wait ~1 min, retry. The app side is already correct (it 302s to Google with the right `client_id`, scope `openid email profile`, PKCE S256).

**LinkedIn:** create an app at developer.linkedin.com; add products *Sign In with LinkedIn using OpenID Connect* and *Share on LinkedIn*; redirect URL `http://localhost:3000/api/social/oauth/linkedin/callback`; then set `LINKEDIN_CLIENT_ID` / `LINKEDIN_CLIENT_SECRET`. **Also required:** implement the real token exchange in the callback (2b) or the connection will be fake.

**Instagram:** create a Meta app at developers.facebook.com; add *Facebook Login* + *Instagram Graph API*; redirect `http://localhost:3000/api/social/oauth/instagram/callback`; set `INSTAGRAM_APP_ID` / `INSTAGRAM_APP_SECRET`. Publishing to IG additionally needs app review for `instagram_content_publish` and a Business/Creator account linked to a Facebook Page.

**Then, to make it a product:** persist calendars/posts (2a), implement the token exchange (2b), tie data to the session user (2c), add a scheduler (2f), `git init` (2g).

---

## 4. What is genuinely good

- **Real AI generation works** once the key is wired — quality output, correct tone per platform, distinct days.
- **Auth is solid**: NextAuth with two providers + Google, middleware-enforced RBAC, 30/30 of its own tests reproduced by me.
- **The UI is real and well-built**: CalendarReviewBoard with per-post Edit / Approve / Dispatch Now, bulk approve, subscription modal, LLM selector, logs viewer.
- **The sandbox design is intentional and labelled** — where it's honest about not having credentials, it says so, and my fix now surfaces that warning to the user instead of pretending.
