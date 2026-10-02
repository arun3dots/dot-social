# Social-Media Automation — Product Audit (2026-10-02)

Scope: `D:\POC\Social-media` — Next.js 14 (App Router) + TypeScript + NextAuth + Postgres (`pg`), with a
33 KB Python generator (`tools/generate_calendar.py`) driven via `spawn`. ~9,000 LOC TS/TSX across 59
source files + 24 API routes. Every item below is tied to the file/line it comes from; nothing is
speculative.

---

## A. What must be fixed (correctness / security / functional gaps)

### A1. X (Twitter) and Instagram publishing are not implemented — the #1 gap
`src/lib/publisher.ts:76-79` returns a hardcoded `FAILED` for both:

```ts
case 'TWITTER':  return { status: 'FAILED', reason: 'live X publishing is not implemented yet', ... };
case 'INSTAGRAM': return { status: 'FAILED', reason: 'live Instagram publishing is not implemented yet', ... };
```

Only LinkedIn is live (`src/lib/linkedin.ts` — 3-call image flow, correct). X credentials are now
configured and connectable (OAuth fixed this session), so X publishing is the next build:
- X v2 media upload (3-step: `POST /2/media/upload` INIT/APPEND/FINALIZE) + `POST /2/tweets`.
- Instagram needs a Meta business page + `instagram_content_publish` review (weeks — app review).

### A2. The scheduler tick is not installed — scheduled posts never auto-publish
`tools/scheduler_tick.cmd` + `tools/scheduler_worker.js` exist and are correct, but no Windows Task
Scheduler entry runs them. The comment in `scheduler_tick.cmd:3` documents the intended command but it
was never registered. Consequence: approved posts whose time arrives only go out if a human dispatches
them. Fix: register the task (and make it windowless, per the watchdog lesson) **after** arming
`PUBLISHING_ENABLED`.

### A3. Schedule slots are hardcoded UTC — posts fire at the wrong local time
`src/app/api/calendar/posts/create/route.ts:34`:

```ts
const SLOTS: Record<string, number> = { TWITTER: 14, LINKEDIN: 15, INSTAGRAM: 18 };
```
…stored as `...T14:00:00Z` etc. For an IST user that is **7:30 / 8:30 / 11:30 PM**, not 9 AM. Fix:
store timestamps in UTC (correct) but make the *slot* timezone-aware and user-editable per post — and
display the local time everywhere (the "… at 14:00 UTC" string in `create/route.ts:456` is what the user
sees, which reads as 2 PM when they meant morning).

### A4. Rotate the Postgres password (5 characters)
The live `DATABASE_URL` password is 5 chars — brute-forceable and it lives in `.env`. Rotate it and
confirm the new value works before updating `.env`.

### A5. Dead code and dead dependencies
- `@prisma/client` is in `package.json` but `src/lib/prisma.ts` was deleted and no source imports prisma
  → remove the dependency (removes a supply-chain surface).
- `tools/publish_twitter.py`, `publish_instagram.py`, `publish_linkedin.py` are self-marked
  "DEPRECATED… nothing invokes this any more" → delete, or they will drift and confuse future readers.
- `.env.example` lists `SANDBOX_MODE` and `PORT` which are never read in `src/` → remove or wire them.

### A6. The Python generator is spawned as bare `python` — fragile
`generate/route.ts:88`, `posts/create/route.ts:287`, `posts/regenerate/route.ts:166` all
`spawn('python', [...])`. This silently depends on a `python` on PATH with PIL + the OpenAI SDK + the
pinned image model. On this box `python3` (3.14.7) vs the Hermes venv python have *different* packages
(openpyxl vs markdown), so "which python" already matters. Fix: resolve an explicit interpreter (env
var with a sane default), declare a `requirements.txt`, and surface a clear error when the interpreter
or a package is missing instead of a cryptic spawn failure.

### A7. LinkedIn OAuth is localhost-only (no public path)
The registered redirect is `http://localhost:3000/api/social/oauth/linkedin/callback`. A public HTTPS
deployment needs the real redirect registered + `NEXTAUTH_URL` set. Also note: LinkedIn **Development
tier** may only authorize the app's own admins/test users — untested with a non-owner account, so
"anyone can connect" is not yet proven.

### A8. Scheduler retries SKIPPED posts forever, with no cap
`scheduler/run/route.ts:44-54` selects `APPROVED|SCHEDULED` every tick; a post that stays SKIPPED
(e.g. `PUBLISHING_ENABLED` off) is re-attempted every tick indefinitely. Harmless but noisy. Fix: a
retry cap / backoff, or skip posts whose `publish_attempts` exceed a threshold.

### A9. BYOK key held in client state and posted on every request
`src/app/page.tsx:226,323` send `apiKey` from React state to the server on each generation. Expected
for BYOK, and server keys are correctly *never* written to the DB — but the key sits in browser memory
and on the wire. Acceptable for now; worth documenting and clearing the field after use.

---

## B. UX enhancements (highest value first)

### B1. Generation needs progress, not one spinner
`handleGenerateCalendar` (`page.tsx:217`) toggles a single `isGenerating` flag for a multi-minute
operation (LLM copy for N days × 3 platforms + one image each; image calls alone can exceed 180 s).
Fix: stream/progress stages — "writing day 2/3 · X post", "generating LinkedIn image" — via polling or
SSE, and show partial results as they land.

### B2. Errors vanish in 4 seconds and are generic
`page.tsx:475-480` shows a toast with a 4 s timeout; generation failures throw a generic
`Failed to generate calendar` (`page.tsx:231`) that hides the server's real reason. Fix: keep failures
visible (dismiss manually), surface the server `error` field, and persist last error to the logs view.

### B3. No empty state on first run
`page.tsx:528` renders the review board only when `calendar` exists. A brand-new user sees an empty
canvas with no "generate your first batch" guidance. Fix: an explicit onboarding/empty state.

### B4. The connect/disconnect toggle is a single flip — easy to disconnect by accident
`SocialAccountsCard.tsx:113` renders one button (`Disconnect` ↔ `Connect Account`) with no confirmation.
This session's LinkedIn disconnect happened exactly this way. Fix: confirm before disconnect; add a
pre-auth hint for LinkedIn ("if you sign in with Google, sign in at linkedin.com first") since the
OAuth interstitial omits the Google button (`/uas/login`).

### B5. Show the human meaning of the schedule
Approved posts show a status but not "will post 8:30 PM IST". Surface local time + "armed/not armed"
next to each post, so a user isn't surprised when the scheduler (A2) doesn't fire.

### B6. Confirm destructive actions
Delete post, approve-all, and disconnect should confirm. (Deleting a *published* post is already
refused with 409 — good.) No undo exists for pending-post deletes.

### B7. Image quality → cost
`settings/route.ts` persists `image_quality` (low/medium/high) but the UI doesn't show the cost
implication (low ≈ $0.01/image vs higher tiers). Add the estimate so "high" is an informed choice.

### B8. Image edge-stretch is a band-aid; text-in-image unreliable
No-crop is correctly implemented (`fit_to_exact` + `_edge_extend`), but for 16:9/4:5 frames the model
can't fill natively (gpt-image-1 emits 1:1/3:2/2:3), so the outermost columns get stretched. The honest
limit is already known; consider: per-platform composition at generation time, or telling the user the
stretch happened. Generated text is still unreliable (a flowchart rendered "IND" for "NO") — keep the
"no text" rule and consider a render-before-publish sanity check.

### B9. Analytics / performance feedback loop is promised but absent
`subscriptions.ts` advertises "Custom Webhooks & Analytics Stream" (AGENCY_SCALE) — nothing reads post
metrics back. For v1, a "posted to → link" record exists (`external_url`); a real performance view is a
future build.

### B10. Accessibility & polish (minor)
Keyboard navigation on the tabbed editor modal, focus management, `aria-label`s on icon buttons, and a
mobile pass over the `max-w-6xl` editor and the 7xl layout.

---

## C. What is already solid (do not regress)

- **Honest publishing contract** — `publisher.ts` never reports success it didn't achieve; PUBLISHED only
  on platform acceptance; SKIPPED vs FAILED are distinct and recorded verbatim (`publisher.ts:18-25`).
- **Ownership-scoped media** — `/api/media/[...path]` checks calendar ownership + traversal (`media/route.ts:20-42`).
- **Auth from the signed JWT only** — no client-writable role cookie (`middleware.ts:41-46`); identity is
  now re-resolved by email, self-healing stale ids (`session.ts`).
- **PKCE for X** and confidential-client token exchange (`oauth.ts`), fixed this session.
- **No-crop guarantee** — a source pixel is never discarded (`fit_to_exact` + `_edge_extend`).
- **Platform spec parity test** — `test_spec_parity.js` fails if `platformSpecs.ts` and the Python
  generator drift.
- **Fail-closed scheduler** — secret or admin session, nothing anonymous (`scheduler/run/route.ts:14-27`).
- **Status semantics** — manual dispatch keeps the schedule (posts now *and* later) unless told otherwise;
  a manual post is recorded separately from the scheduled one (`publish/route.ts`).

---

## D. Suggested order of work

1. **A3** timezone + local-time display (cheap, immediately visible).
2. **A1** X publishing (X is connected; unblocks a second live platform).
3. **A2** scheduler task + `PUBLISHING_ENABLED` arm (turns the product "on").
4. **A4** DB password rotation (security).
5. **A5** dead-code removal (hygiene, supply chain).
6. **B1/B2/B4** progress, error visibility, disconnect confirm (the daily-pain items).
7. **A6** interpreter pinning (deployment robustness).
8. Then B3, B5, B6, B7, B8, B9.
