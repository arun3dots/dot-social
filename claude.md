# Project Constitution: Social Media Automation Engine

## 1. Architectural Invariants (A.N.T. 3-Layer System)

- **Layer 1: Architecture (`architecture/`)**
  - Technical SOPs written in Markdown.
  - Define system goals, inputs, outputs, execution logic, error codes, and edge cases.
  - *The Golden Rule:* If logic changes, update the SOP before updating code.
- **Layer 2: Navigation (Decision & Orchestration Layer)**
  - Next.js 14+ App Router API routes and server actions.
  - Deterministic state machine managing user lifecycles, approval gates, and BullMQ job scheduling.
  - LLM calls utilize structured output (Zod schemas) for guaranteed parsing.
- **Layer 3: Tools (`tools/`)**
  - Atomic, deterministic Python and TypeScript scripts.
  - Social media publishing adapters (Instagram Graph API, LinkedIn API v2, X API v2) with mock/sandbox toggles.
  - Secrets strictly stored in `.env`.
  - All intermediate payloads stored in `.tmp/`.

---

## 2. Core Behavioral Rules

1. **Human-in-the-Loop Approval:** No post is scheduled or published to external accounts without explicit user approval.
2. **Reliability Over Speed:** All publishing actions are idempotent. Failed publish tasks self-heal with exponential backoff and error logging.
3. **Graceful Fallback:** If live social credentials are not configured or token refresh fails, the platform switches seamlessly to Sandbox/Simulation mode without crashing.
4. **LLM Hierarchy:** Primary default is Google Gemini; automatic fallback or creator override to OpenAI and DeepSeek.
5. **Data-First Rule:** Every tool input and output must conform strictly to the defined JSON schemas below.

---

## 3. Data Schemas (JSON Specification)

### A. User & Role Schema
```json
{
  "id": "usr_cuid123",
  "email": "creator@example.com",
  "name": "Jane Creator",
  "image": "https://lh3.googleusercontent.com/a/...",
  "role": "SUPER_ADMIN | CREATOR",
  "createdAt": "2026-10-01T09:30:00.000Z",
  "updatedAt": "2026-10-01T09:30:00.000Z"
}
```

### B. Social Connection Schema
```json
{
  "id": "conn_cuid456",
  "userId": "usr_cuid123",
  "platform": "INSTAGRAM | LINKEDIN | TWITTER",
  "accountHandle": "@janedoe",
  "accountName": "Jane Doe Tech",
  "platformAccountId": "17841400000000000",
  "accessToken": "encrypted_oauth_token",
  "refreshToken": "encrypted_refresh_token",
  "tokenExpiresAt": "2026-12-01T00:00:00.000Z",
  "isSandbox": true,
  "status": "CONNECTED | EXPIRED | DISCONNECTED",
  "createdAt": "2026-10-01T09:30:00.000Z"
}
```

### C. LLM Configuration (BYOK & System) Schema
```json
{
  "id": "llm_cuid789",
  "userId": "usr_cuid123",
  "provider": "GEMINI | OPENAI | DEEPSEEK",
  "mode": "SYSTEM_DEFAULT | BYOK",
  "apiKeyEncrypted": "enc_sk_...",
  "modelName": "gemini-1.5-flash | gpt-4o-mini | deepseek-chat",
  "isPrimary": true,
  "customEndpoint": null,
  "isActive": true
}
```

### D. Niche & Brand Voice Profile Schema
```json
{
  "id": "prof_cuid012",
  "userId": "usr_cuid123",
  "niche": "AI SaaS & Productivity Tools",
  "targetAudience": "Solopreneurs, indie hackers, and tech startup founders",
  "brandTone": "Insightful, actionable, engaging, slightly witty",
  "goals": ["Build brand authority", "Drive product signups", "Foster community engagement"],
  "contentPillars": ["Behind-the-Scenes", "Productivity Tips", "Tool Reviews", "Industry Trends"],
  "forbiddenTopics": ["Politics", "Crypto shilling", "Negative competitor bashing"],
  "preferredPostingTimes": {
    "twitter": ["09:00", "15:00"],
    "linkedin": ["08:30", "12:00"],
    "instagram": ["11:00", "18:00"]
  },
  "timezone": "America/New_York"
}
```

### E. Content Calendar & 3-Day Batch Schema
```json
{
  "calendarId": "cal_cuid345",
  "userId": "usr_cuid123",
  "title": "Launch Week Content Calendar",
  "startDate": "2026-10-02",
  "endDate": "2026-10-04",
  "batchStatus": "GENERATED | PENDING_APPROVAL | APPROVED | SCHEDULED | COMPLETED",
  "days": [
    {
      "dayIndex": 1,
      "date": "2026-10-02",
      "theme": "Problem Discovery in Solopreneur AI Workflows",
      "posts": [
        {
          "id": "post_cuid001",
          "platform": "TWITTER",
          "content": "Most solopreneurs spend 4 hours a day on admin tasks.\nHere are 3 AI automations that cut that to 30 mins: 🧵👇",
          "mediaPrompt": null,
          "mediaUrl": null,
          "scheduledTime": "2026-10-02T13:30:00.000Z",
          "status": "PENDING_APPROVAL"
        },
        {
          "id": "post_cuid002",
          "platform": "LINKEDIN",
          "content": "Why AI automation isn't about replacing humans—it's about removing cognitive drag.\n\n3 actionable systems we implemented this quarter...",
          "mediaPrompt": "Professional minimalist infographic showing productivity growth curve with clean modern typography",
          "mediaUrl": "https://storage.googleapis.com/assets/banner1.png",
          "scheduledTime": "2026-10-02T14:00:00.000Z",
          "status": "PENDING_APPROVAL"
        },
        {
          "id": "post_cuid003",
          "platform": "INSTAGRAM",
          "content": "Stop doing manual social scheduling in 2026! 🚀 Swipe to see how automated batching works. #IndieHacker #SaaS #BuildInPublic",
          "mediaPrompt": "Sleek vibrant neon cyber-aesthetic card displaying 3 workflow steps with gradient dark background",
          "mediaUrl": "https://storage.googleapis.com/assets/insta1.png",
          "scheduledTime": "2026-10-02T16:30:00.000Z",
          "status": "PENDING_APPROVAL"
        }
      ]
    }
  ]
}
```

### F. Publishing Queue & Dispatch Payload
```json
{
  "jobId": "job_cuid999",
  "postId": "post_cuid001",
  "userId": "usr_cuid123",
  "platform": "TWITTER | LINKEDIN | INSTAGRAM",
  "payload": {
    "text": "Post caption or tweet body",
    "mediaUrl": "https://...",
    "hashtags": ["#buildinpublic"]
  },
  "isSandbox": true,
  "attempt": 1,
  "maxRetries": 3,
  "scheduledFor": "2026-10-02T13:30:00.000Z",
  "executedAt": null,
  "result": {
    "status": "SUCCESS | FAILED",
    "externalPostId": "1840000000000000000",
    "externalUrl": "https://x.com/janedoe/status/1840000000000000000",
    "error": null
  }
}
```

### G. Subscription & Package Schema
```json
{
  "id": "sub_cuid888",
  "userId": "usr_cuid123",
  "tier": "FREE_TRIAL | PRO_CREATOR | AGENCY_SCALE",
  "status": "ACTIVE | PAST_DUE | CANCELED",
  "maxSocialAccounts": 3,
  "maxMonthlyPosts": 100,
  "byokAllowed": true,
  "autoSchedulingEnabled": true,
  "currentPeriodStart": "2026-10-01T00:00:00.000Z",
  "currentPeriodEnd": "2026-11-01T00:00:00.000Z"
}
```

### H. Segregated Auth Route Specifications
- **Creator Entrypoint**: `/login` (Google Sign-In + Email auth + Demo Creator session -> Creator Studio `/`)
- **Super Admin Entrypoint**: `/admin/login` (Admin key/credentials + Demo Admin session -> Admin Control Plane `/admin`)
- **Protected Creator Studio**: `/` (Guarded by RBAC middleware; redirects unauthenticated users to `/login?error=auth_required`)
- **Protected Super Admin Control Plane**: `/admin` (Guarded by RBAC middleware; redirects unauthenticated users to `/admin/login?error=session_required` and creators to `/admin/login?error=unauthorized_admin_only`)

---

## 4. Maintenance & Operations Log
- **2026-10-01 (Init)**: Initialized Constitution, schemas, and invariants.
- **2026-10-01 (Deployment & E2E Validation)**:
  - Phase 1 (Blueprint): Finalized and approved 3-layer A.N.T. architecture and JSON schemas.
  - Phase 2 (Link): Verified `.env`, Gemini connection, and Instagram/LinkedIn/X sandbox adapters.
  - Phase 3 (Architect): Authored Layer 1 SOPs (`architecture/sop_*.md`), Layer 3 engines (`tools/*.py`), and Layer 2 Next.js App Router navigation.
  - Phase 4 (Stylize): Applied minimalist dark LLM styling with monospace badges, status dots, and clean cards.
  - Phase 5 (Trigger): Production build validated; server live at `http://localhost:3000`. E2E browser verification confirmed 100% success across calendar generation, 3-day approval pipeline, and instant dispatch.
  - Phase 6 (Enterprise Stack): TailwindCSS + Shadcn UI primitives, Prisma schema with PostgreSQL models.
  - Phase 7 (PostgreSQL & Live APIs): Connected to PostgreSQL database `social_engine`, populated schema tables, live multi-LLM routing, and OAuth callbacks.
  - Phase 8 (Screen Separation & RBAC Middleware): Separated `/` and `/admin`, enforced zero-trust middleware guards on all routes and APIs.
  - Phase 9 (Actual vs Wrong Credentials Validation): Full matrix testing of Super Admin (fake vs actual credentials) and Creator (empty/malformed vs actual credentials) with 100% automated assertion pass rate (17/17).
  - Phase 10 (NextAuth Architecture): Integrated NextAuth v4 with custom credentials providers for Super Admin and Creator, `[...nextauth]` route handler, JWT token propagation, `getToken` middleware verification, and complete 30/30 automated test assertions passed.
