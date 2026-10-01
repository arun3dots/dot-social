# Findings & Research Log

## 1. Project Context
- Workspace: `d:\POC\Social-media`
- Framework / Protocol: B.L.A.S.T. Protocol with A.N.T. 3-Layer Architecture.

## 2. Research & Discoveries
- **Core Personas**:
  - Super Admin: Platform administration, user oversight, default LLM management, system logs, provider key config.
  - Customers/Users: Business owners & content creators.
- **Authentication**: Google OAuth (NextAuth / Auth.js with Google Provider + Demo/Mock mode for local testing).
- **Social Integrations & Architecture Inspiration**:
  - Researched open-source schedulers: `gitroomhq/postiz-app` (popular multi-platform dispatching adapter pattern) & `open-dispatch`.
  - Platform Adapters:
    - **X/Twitter API v2**: `POST /2/tweets` with OAuth 2.0 PKCE / OAuth 1.0a user tokens.
    - **LinkedIn API v2**: `POST /v2/ugcPosts` or `/v2/posts` with `w_member_social`.
    - **Instagram Graph API**: Two-step publishing (`POST /{ig-user-id}/media` followed by `POST /{ig-user-id}/media_publish`). Requires public image URL.
  - **Hybrid Sandbox Mode**: In sandbox/mock mode, publishing requests write to `.tmp/published_posts.json` and generate simulated live preview links (e.g. `https://x.com/mock/status/...`), allowing complete E2E workflow verification without waiting for Meta/X app review.
- **LLM Engine**:
  - Primary default: **Google Gemini API** (`@google/genai` or `@google/generative-ai` / `gemini-1.5-flash` or `gemini-2.0-flash`).
  - Secondary/BYOK options: **OpenAI** (`gpt-4o-mini`, `gpt-4o`) and **DeepSeek** (`deepseek-chat`).
  - Structured output: Prompting with schema constraints to guarantee JSON output for the 3-day calendar.
- **Job Scheduling**:
  - High-precision BullMQ / Node cron scheduler polling scheduled posts whose `scheduledTime <= now()` and `status == 'SCHEDULED'`.

## 3. Constraints & Technical Gotchas
- Instagram Graph API strictly requires an image container URL accessible on the public web (or valid public CDN URL). For Sandbox testing, we generate high-quality placeholder banner graphics or AI prompt mockups.
- Twitter v2 Free tier rate limits: Batch publishing must avoid burst spam.
- In-memory/SQLite Prisma setup provides immediate out-of-the-box local testing without requiring external Docker services immediately, while remaining 100% compatible with PostgreSQL in production.
