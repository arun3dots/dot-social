# Task Plan: B.L.A.S.T. Implementation

## Phase 0: Initialization (Mandatory)
- [x] Create project memory files (`task_plan.md`, `findings.md`, `progress.md`, `claude.md`)
- [x] Set up base directory structure (`architecture/`, `tools/`, `.tmp/`)
- [ ] Present Discovery Questions to user
- [ ] Await user answers to Discovery Questions (Execution Halted)

## Phase 1: B - Blueprint (Vision & Logic)
- [x] Review user responses to the 5 Discovery Questions & architectural choices
- [x] Define JSON Data Schemas (Input/Output shapes) in `claude.md` / `gemini.md`
- [x] Research GitHub repositories (`postiz-app`, `open-dispatch`) and database patterns
- [x] Define Blueprint Specification:
  - **Personas**:
    1. **Super Admin**: System LLM configuration (Gemini primary, OpenAI / DeepSeek backup), platform health, user registry, global posting logs.
    2. **Content Creator / Business Owner**: Google Sign-in, Social Connect (Instagram, LinkedIn, X), LLM mode toggle (Use Platform Default or BYOK), Niche/Target onboarding, Content Calendar generator, 3-Day batch approval workspace, Scheduled publishing timeline.
  - **Core Modules**:
    1. **Authentication & Session**: NextAuth with Google Provider + One-Click Demo Mode toggle for testing.
    2. **Social Account Manager**: Live OAuth 2.0 PKCE endpoints for X, LinkedIn, Instagram Graph API + Interactive Sandbox toggle with test handles.
    3. **AI Intelligence Engine**: Gemini 1.5/2.0 Flash primary generator with fallback to OpenAI / DeepSeek. Structured JSON output parser for 3-day calendar (captions, hashtags, image prompts, scheduled timestamps).
    4. **Post Approval & Visual Workspace**: Kanban/Card view for 3-day posts across Instagram, LinkedIn, and X with inline editing, image preview, regeneration, and one-click Approval.
    5. **Automated Scheduler Engine**: Background worker (BullMQ / Scheduler runner) checking due posts and publishing via platform adapters.
- [x] **Blueprint Approved by User** (Minimalist clean aesthetic requested)

## Phase 2: L - Link (Connectivity)
- [x] Initialize `.env` and `.env.example` with environment variable schema
- [x] Build minimal verification scripts in `tools/`:
  - `tools/verify_env.py`: Scans configuration and readiness
  - `tools/verify_llm.py`: Tests Gemini connectivity & mock JSON engine
  - `tools/verify_social_link.py`: Tests X, LinkedIn, Instagram links & sandbox
- [x] Execute and verify connectivity reports in `.tmp/` (100% healthy)

## Phase 3: A - Architect (The 3-Layer Build)
- [x] Layer 1: Author Technical SOPs in `architecture/`:
  - `architecture/sop_auth_and_roles.md`
  - `architecture/sop_social_connections.md`
  - `architecture/sop_llm_generation.md`
  - `architecture/sop_approval_and_scheduling.md`
  - `architecture/sop_publishing_adapters.md`
- [x] Layer 3: Build deterministic execution scripts in `tools/`:
  - `tools/generate_calendar.py`
  - `tools/publish_twitter.py`
  - `tools/publish_linkedin.py`
  - `tools/publish_instagram.py`
  - `tools/scheduler_worker.py`
- [x] Layer 2: Implement Navigation Layer & Fullstack Application (Next.js 14+):
  - Setup Next.js with Prisma ORM compatible schema
  - Implement API endpoints bridging UI to Layer 3 tools (`/api/calendar/generate`, `/api/calendar/publish`, `/api/audit-logs`, `/api/status`)
  - Creator Workspace (Onboarding -> Calendar Generator -> 3-Day Approval Board -> Scheduling Queue)
  - Super Admin Dashboard (User Management, Global LLM Config, Queue Monitor)

## Phase 4: S - Stylize (Refinement & UI)
- [x] Refine delivery payload formatting for Twitter (280 char / thread), LinkedIn (UGC story), Instagram (Caption + visual container)
- [x] Implement minimal, dark, LLM-inspired developer UI with monospace accents and high contrast
- [x] Live end-to-end browser verification of Creator & Super Admin user flows

## Phase 5: T - Trigger (Deployment)
- [x] Build validated with zero errors (`npm run build`)
- [x] Application running on `http://localhost:3000`
- [x] Finalize Maintenance Log in `claude.md` / `gemini.md`

## Phase 6: Extended Architecture & Enterprise Upgrades
- [x] 1. **UI Layer Upgrade (TailwindCSS + Shadcn UI)**:
  - Installed and configured `tailwindcss`, `postcss`, `autoprefixer`, `tailwind-merge`, `clsx`, `class-variance-authority`.
  - Implemented shadcn-compatible CSS variables and dark developer design tokens in `src/app/globals.css`.
- [x] 2. **Database Engine (Prisma + PostgreSQL)**:
  - Configured `prisma/schema.prisma` with PostgreSQL provider and full enterprise data models: `User`, `Role`, `Subscription`, `PlanTier`, `SocialConnection`, `LLMConfig`, `BrandProfile`, `ContentCalendar`, `Post`, `AuditLog`.
  - Implemented resilient PostgreSQL database store in `src/lib/prisma.ts`.
  - Created `/api/creators` endpoint for auditing tenant accounts.
- [x] 3. **Segregated Authentication Routes**:
  - Creator login: `/login` (Google Sign-In + Demo Creator session -> `/`).
  - Super Admin login: `/admin/login` (Admin key verification + Demo Admin session -> `/?tab=admin`).
  - Implemented API endpoints `/api/auth/creator/login` and `/api/auth/admin/login`.
## Phase 7: Live API Integration & PostgreSQL Synchronization
- [x] Connected directly to local PostgreSQL 18.2 engine on port 5432 (`social_engine` database)
- [x] Automated table initialization: `users`, `subscriptions`, `social_connections`, `content_calendars`, `audit_logs`
- [x] Integrated live Multi-LLM API clients (Google Gemini 1.5 Flash, OpenAI GPT-4o, DeepSeek-Chat) in `tools/generate_calendar.py`
- [x] Integrated live Social Media API publishers (Twitter API v2, LinkedIn API v2, Instagram Graph API) in `tools/publish_*.py`
- [x] Built OAuth 2.0 PKCE initiation & callback routes (`/api/social/oauth/[platform]` & `/api/social/oauth/[platform]/callback`)
- [x] Verified full database persistence: User queries, subscription tier upgrades, and dispatch audit logs written to PostgreSQL

## Phase 8: Strict Auth Guard & Screen Separation (RBAC)
- [x] 1. **Next.js Route Middleware (`src/middleware.ts`)**:
  - Intercepts every request before rendering.
  - Public whitelist: `/login`, `/admin/login`, `/api/auth/*`.
  - Creator Guard (`/`, `/api/calendar/*`): Reject unauthenticated users -> redirect to `/login`.
  - Super Admin Guard (`/admin`, `/admin/*`, `/api/creators`): Reject unauthenticated or non-admin users -> redirect to `/admin/login?error=unauthorized_admin_only` / 403 Forbidden.
- [x] 2. **Dedicated Screens & Clean URL Separation**:
  - `/login`: Dedicated Creator sign-in portal.
  - `/admin/login`: Dedicated Super Admin sign-in portal with restricted security clearance.
  - `/`: Exclusive Creator Studio screen (Calendar generator, 3-day approval, social accounts, no admin leakage).
  - `/admin`: Exclusive Super Admin Control Plane screen (Multi-tenant overview, global LLM routing, creator table).
- [x] 3. **Logout & Session Management**:
  - `/api/auth/logout`: Clears session cookie and redirects to `/login` or `/admin/login`.
- [x] 4. **Rigorous Automated Security Verification**:
  - Unauthenticated access to `/` -> Verified HTTP 307 redirect to `/login?error=auth_required`.
  - Unauthenticated access to `/admin` -> Verified HTTP 307 redirect to `/admin/login?error=session_required`.
  - Creator access to `/admin` -> Verified HTTP 307 redirect to `/admin/login?error=unauthorized_admin_only`.
  - Creator access to `/api/creators` -> Verified HTTP 403 Forbidden.
  - Authenticated Super Admin access to `/admin` & `/api/creators` -> Verified HTTP 200 OK.
  - Authenticated Creator access to `/` -> Verified HTTP 200 OK.

## Phase 9: Comprehensive Auth Validation (Actual vs Wrong Credentials)
- [x] 1. **Super Admin Wrong Credentials Testing**:
  - Completely invalid email & password -> Verified HTTP 401 Unauthorized (`Invalid Super Admin credentials. Access denied.`).
  - Correct admin email (`admin@antigravity.local`) + wrong secret key (`invalid_secret_key`) -> Verified HTTP 401 Unauthorized.
  - Wrong email (`wrong@domain.com`) + correct secret key (`admin123`) -> Verified HTTP 401 Unauthorized.
- [x] 2. **Super Admin Actual Credentials Testing**:
  - Correct admin email (`admin@antigravity.local`) + correct secret key (`admin123`) -> Verified HTTP 200 OK with `SUPER_ADMIN` role and session cookie.
  - Session verified: Authenticated admin successfully accesses `/admin` (HTTP 200) and `/api/creators` (HTTP 200).
- [x] 3. **Creator Wrong / Invalid Credentials Testing**:
  - Empty email address -> Verified HTTP 400 Bad Request with actionable validation message.
  - Malformed email string without `@` or domain -> Verified HTTP 400 Bad Request.
- [x] 4. **Creator Actual Credentials Testing**:
  - Valid creator email (`alex.creator@startupgrowth.com`) -> Verified HTTP 200 OK with `CREATOR` role and session cookie.
  - Session verified: Authenticated creator accesses `/` (HTTP 200).
  - RBAC privilege boundary verified: Creator attempting to access `/admin` is intercepted and redirected to `/admin/login?error=unauthorized_admin_only` (HTTP 307).
  - RBAC API boundary verified: Creator calling `/api/creators` returns HTTP 403 Forbidden.
- [x] 5. **Automated Test Matrix**:
  - Executed `test_auth_matrix.js` containing 17 assertions covering all cases: **17 PASSED, 0 FAILED**.

## Phase 10: NextAuth Enterprise Implementation
- [x] 1. **NextAuth Installation & Configuration**:
  - Installed `next-auth` library and configured `src/lib/auth.ts` with custom JWT session strategy.
  - Implemented `admin-credentials` and `creator-credentials` providers with strict validation rules.
  - Added optional `GoogleProvider` configuration for live OAuth.
  - Created App Router route handler at `src/app/api/auth/[...nextauth]/route.ts`.
- [x] 2. **Client Components Integration**:
  - Implemented `src/components/providers/AuthProvider.tsx` wrapping root layout (`src/app/layout.tsx`).
  - Updated `/admin/login` to use NextAuth `signIn('admin-credentials', ...)`.
  - Updated `/login` to use NextAuth `signIn('creator-credentials', ...)` and `signIn('google')`.
  - Integrated `signOut` from `next-auth/react` into Creator and Super Admin header logout flows.
- [x] 3. **Middleware & Zero-Trust RBAC**:
  - Updated `src/middleware.ts` to decode and verify NextAuth JWT tokens via `getToken({ req, secret })`.
  - Enforced route protection: `/admin` restricted to `SUPER_ADMIN`, `/` restricted to authenticated sessions.
- [x] 4. **Automated Verification**:
  - Executed `test_nextauth.js` testing endpoints, credentials verification, session issuance, and RBAC: **13 PASSED, 0 FAILED**.
  - Executed `test_auth_matrix.js`: **17 PASSED, 0 FAILED**. Total: **30/30 PASSED**.
