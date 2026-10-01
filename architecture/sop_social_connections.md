# SOP: Social Media Connections

## 1. Goal
Connect and maintain authenticated API links for Instagram Graph API, LinkedIn API v2, and X (Twitter) API v2, supporting both live OAuth tokens and simulated Sandbox mode.

## 2. Supported Platforms
1. **Instagram**:
   - Live: Meta Graph API OAuth with `instagram_basic`, `instagram_content_publish`, `pages_show_list`.
   - Sandbox: Generates mock Instagram handle `@creator_ig` with container preview simulation.
2. **LinkedIn**:
   - Live: LinkedIn OAuth 2.0 with `w_member_social`, `openid`, `profile`.
   - Sandbox: Generates mock LinkedIn profile `Jane Creator (LinkedIn)` with UGC post preview.
3. **X (Twitter)**:
   - Live: Twitter OAuth 2.0 PKCE with `tweet.read`, `tweet.write`, `users.read`.
   - Sandbox: Generates mock X handle `@creator_x` with 280-char counter and thread simulator.

## 3. Storage Invariants
- Tokens are encrypted at rest in the database.
- Each connection has `isSandbox` boolean flag, allowing creators to toggle sandbox testing without losing live tokens.
