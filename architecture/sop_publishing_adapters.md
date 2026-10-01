# SOP: Platform Publishing Adapters & Self-Annealing

## 1. Goal
Execute atomic publishing to Twitter/X, LinkedIn, and Instagram via dedicated deterministic scripts in `tools/` with automated self-annealing retry logic.

## 2. Platform Endpoints & Methods
1. **Twitter / X (`tools/publish_twitter.py`)**:
   - Endpoint: `POST https://api.twitter.com/2/tweets`
   - Payload: `{"text": "..."}`
   - Error Handling: Detect 429 Rate Limit (sleep with exponential backoff) or 403 Forbidden (refresh token).
2. **LinkedIn (`tools/publish_linkedin.py`)**:
   - Endpoint: `POST https://api.linkedin.com/v2/ugcPosts`
   - Payload: `{"author": "urn:li:person:...", "lifecycleState": "PUBLISHED", "specificContent": {...}}`
3. **Instagram (`tools/publish_instagram.py`)**:
   - Step 1: `POST https://graph.facebook.com/v20.0/{ig_user_id}/media` (creates container with `image_url` and `caption`).
   - Step 2: `POST https://graph.facebook.com/v20.0/{ig_user_id}/media_publish?creation_id={container_id}`.

## 3. Sandbox Protocol
- If `isSandbox == true` or live keys are empty:
  - Generate a simulated published record with unique ID.
  - Append to `.tmp/published_posts.json`.
  - Return `{ "status": "SUCCESS", "externalUrl": "https://...", "isSandbox": true }`.
