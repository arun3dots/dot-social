# Product flow spec — Social-media automation app

Written 2026-10-01 from the owner's briefing. **This is the brief that was missing** — the previous build
proceeded on invented requirements (see `hermes_verification_report.md` §3.5). Everything below is the
intended behaviour; §9 lists the decisions still open.

---

## 1. The user journey, in order

### Stage A — First signup (onboarding interview)
Triggered once, on a user's first successful signup (Google or credentials).

| Step | Ask | Notes |
|---|---|---|
| A1 | **Screen name** | The name/handle used in generated content and shown in the studio. |
| A2 | **Persona** | Who they are and how they sound. AI proposes a persona derived from A1+A3; the user edits and confirms. |
| A3 | **Niche(s)** | **Multi-select.** Accept more than one. The app must **recommend** the best-fit niches for them (from their persona/screen name) — suggestion, not restriction. |
| A4 | **Content pillars** | The app **suggests** a pillar set matched to their niches; the user can accept, remove, and **add their own**. |
| A5 | **Goal** | What the content is for (see §2). Multiple allowed incl. "all of the above". |
| A6 | **Calendar proposal** | Based on A1–A5, produce a **content calendar** and show it for feedback. |
| A7 | **Iterate** | The user comments; the calendar is reworked until they approve it. |
| A8 | **Cadence / horizon** | Ask which generation horizon they want: **daily**, **every 3 days**, or **weekly**. **Hard cap: 7 days per generation.** Never produce a month of content in one pass. |

### Stage B — Generation
- Content + images are generated **separately, per platform**, each customised (see §4).
- Generation respects the A8 horizon: 1, 3, or 7 days — **never more than 7**.

### Stage C — Review & approval
- Every generated post is **reviewable and editable** before anything is scheduled.
- Approval is **per post** and/or **per batch**.
- Nothing is scheduled or published until it is explicitly verified/approved by the user.

### Stage D — Schedule & publish
- On approval, each post is **scheduled to its own date and time** (per its cadence).
- At the scheduled time it is **published to the respective platform**.
- Status is tracked per post: `DRAFT → PENDING_APPROVAL → APPROVED → SCHEDULED → PUBLISHED / FAILED`.

---

## 2. Option sets to offer

**Goals (A5)** — offer all of these, multi-select, plus "all of the above":
1. Followers / audience growth
2. Engagement (likes, comments, shares)
3. Authority / thought leadership
4. Leads / demand generation
5. Sales / conversions
6. Website traffic
7. Community building
8. Loyalty / retention
9. Brand awareness / recall
10. Hiring / employer brand

**Content pillars (A4)** — suggest from this library, matched to niche, and allow custom additions:
Educational / how-to · Authority / POV · Industry news & commentary · Personal story / behind-the-scenes ·
Social proof / testimonials & results · Product & offer · Myth-busting · Tips & tools · Case study ·
Entertainment / meme-adjacent · Community / UGC & Q&A.

**Cadence (A8):** `daily` (1 day/batch) · `every 3 days` · `weekly` (7 days/batch) — enforced maximum 7.

---

## 3. Hard rules

1. **Max 7 days of content per generation.** The server must reject any request above 7 days.
2. **Nothing publishes without explicit per-post approval.**
3. **Content and image are generated separately**, then composed per platform.
4. **BYOK outranks the system default** — if the user supplied a key/provider, the default must never be used.
5. Onboarding is completed **before** the studio is usable.

---

## 4. Per-platform customisation matrix (grounded, 2026 specs)

| | LinkedIn | Instagram | X / Twitter |
|---|---|---|---|
| **Feed image** | 1080×1350 (4:5) or 1200×1200 (1:1) | 1080×1350 (4:5); 1080×1080 (1:1) | 1600×900 (16:9); 1080×1080 (1:1) |
| **Secondary** | Link preview 1200×627 | Reels/Stories 1080×1920 (9:16) | Card 1200×628 |
| **Caption length** | up to ~3,000 chars | up to ~2,200 chars | **280 chars** (25k on Premium) |
| **Tone** | Professional, insight-led, 1 clear argument, no hashtag spam | Visual-first, hook line + short body, 3–8 hashtags, emoji sparingly | Punchy hook, one idea, ≤280, at most 1–2 hashtags |
| **Hashtags** | 3–5 | 5–8 (or niche set) | 0–2 |
| **Structure** | Hook → context → 3 bullets → takeaway → question | Hook → value → CTA → hashtags | Hook → point → CTA |

Notes: Instagram's grid crops thumbnails to 3:4, so keep key content away from the top/bottom edges.
For 2026 the safest universal feed size is **1080×1350 (4:5)**.

---

## 5. Model routing

**Priority order (both content and image):**
1. **BYOK** — the user's own provider + key. **Always wins.**
2. System default.

**Content (text) — candidates:** DeepSeek (cheap, strong), OpenAI GPT, Gemini, Anthropic.
DeepSeek is a sound default for text; quality differences at this task are small and cost is much lower.

**Images — DeepSeek is not an option.** DeepSeek publishes **no image-generation endpoint** (their API
offers chat/completions and image *understanding*, not image *creation*). So image generation must use a
different provider. Current leaders:

| Model | Strength | Cost/image |
|---|---|---|
| **OpenAI GPT Image 2** | Best prompt adherence + reliable text-in-image; **supports arbitrary resolutions** (W×H divisible by 16, ratio 1:3–3:1) → can target exact platform sizes | ~$0.006 low → $0.05 high |
| **Gemini 3.1 Flash Image** (or 2.5 Flash Image) | Cheapest capable option, generous free tier | ~$0.02–0.04 |
| **Flux 2** (Black Forest Labs) | Best photorealism | ~$0.014–0.07 |

⚠️ **Do not build on Imagen** — Imagen models are deprecated and shut down **17 Aug 2026**; Google directs
new builds to Gemini Flash Image.

**Recommended default:** GPT Image 2 when the user has an OpenAI key (arbitrary sizes = exact platform
dimensions); Gemini Flash Image as the cheap path. Both overridable by BYOK.

---

## 6. Data model implications

- `users`: + `screen_name`, `persona`, `onboarding_completed`
- `user_niches` (user_id, niche, is_recommended)
- `user_pillars` (user_id, pillar, is_custom)
- `user_goals` (user_id, goal)
- `user_settings`: + `cadence` (daily|3day|weekly), `max_horizon_days` (≤7), `byok_provider`, `byok_key_ref`
- `content_calendars`: user_id, horizon_days, status, created_at — **must be persisted** (today it isn't)
- `posts`: platform, content, image_prompt, image_url, scheduled_at, status, approval fields
- **All rows keyed to the session user** — no hardcoded `usr_creator_01` anywhere.

---

## 7. Gap vs the current build

| Requirement | Today |
|---|---|
| Onboarding interview (A1–A8) | **Absent** — hardcoded `INITIAL_USER` / `INITIAL_CONNECTIONS` |
| Niche/pillar/goal recommendation | **Absent** |
| Cadence selection + 7-day cap | **Absent** (no cap enforced) |
| Persistence of generated content | **Broken** — `content_calendars` = 0 rows; lost on reload |
| Per-platform content variants | Partially — same copy recycled with tone differences only |
| Per-platform image generation | **Absent** — three hardcoded Unsplash URLs, no image API |
| Image model routing / BYOK priority | **Absent** (BYOK exists in UI only; FREE tier even sets `byokAllowed: false`) |
| Approval → schedule → publish | Approval UI exists; **no scheduler**, publish is a sandbox simulation |
| Real OAuth connections | **Stubbed** — the callback mints a fake token and labels it live |

---

## 8. Suggested build order

1. **`git init`** (nothing is versioned today).
2. **Persistence foundation** — write calendars + posts to Postgres, keyed to the session user; kill the hardcoded user id. *Without this, nothing else can be trusted.*
3. **Onboarding (A1–A7)** — screens + API + recommendation calls. Small, self-contained, high visible value.
4. **Cadence + 7-day cap (A8)** — enforce server-side, not just in the UI.
5. **Per-platform content generation** — one call per platform with that platform's tone/length rules.
6. **Image generation** — per-platform size + prompt, stored to disk/S3; BYOK → provider routing.
7. **Scheduler** — durable queue/cron that finds due posts and publishes; status transitions.
8. **Real OAuth token exchange** — replace the stub, store encrypted tokens, then LinkedIn/Instagram app credentials + review.

---

## 9. Decisions I need from you

1. **Onboarding style** — a guided multi-step form, or an AI *conversational* interview? (I'd start with the form + AI suggestions; conversational is a bigger build.)
2. **Persona** — AI-generated from niche/screen name and then editable, or written by the user?
3. **Image provider default** — GPT Image 2 (needs an OpenAI key, best size control) or Gemini Flash Image (cheapest)? And should image generation be a **paid-tier** feature?
4. **BYOK vs plan limits** — the spec says BYOK always wins, but `FREE_TRIAL` currently sets `byokAllowed: false` and `autoSchedulingEnabled: false`. Which is right — BYOK on all tiers, or paid-only?
5. **Publish path for LinkedIn/Instagram** — real publishing needs platform app credentials *and* app review (Meta requires `instagram_content_publish` + a Business account on a FB Page; LinkedIn needs the *Share on LinkedIn* product). Do you want to pursue review, or is **generate → approve → download/export** enough for v1?
