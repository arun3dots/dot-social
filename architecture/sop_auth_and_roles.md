# SOP: Authentication & Role Management

## 1. Goal
Provide secure authentication for Super Admins and Creators using Google OAuth 2.0, with a zero-friction Demo Mode for local testing and evaluation.

## 2. Personas & Permissions
- **SUPER_ADMIN**:
  - Email matches `SUPER_ADMIN_EMAIL` in `.env` (or assigned in DB).
  - Can configure global platform LLM keys (Gemini, OpenAI, DeepSeek).
  - Can view all registered creators and their post queues.
  - Can inspect system error logs and publishing diagnostics.
- **CREATOR**:
  - Business owner or content creator.
  - Can connect their own social accounts (Instagram, LinkedIn, X).
  - Can configure their own LLM (Use Default vs BYOK).
  - Can input their niche profile and generate 3-day post calendar batches.
  - Can edit, approve, and schedule posts.

## 3. Inputs & Outputs
- **Input**: Google OAuth authorization code / profile OR Demo role switch (`superadmin` / `creator`).
- **Output**: Authenticated session JWT with user ID, email, role, and display avatar.

## 4. Edge Cases & Rules
- If Google OAuth credentials are not provided in `.env`, the system provides instant single-click Demo Mode buttons ("Login as Super Admin", "Login as Content Creator") with full persistence.
- Session tokens are strictly validated on every mutation route.
