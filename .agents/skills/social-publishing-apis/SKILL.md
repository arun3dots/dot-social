---
name: social-publishing-apis
description: "Publish to X API v2, LinkedIn REST and Instagram Graph in this repo: OAuth token lifecycle, per-platform media upload flows, the PUBLISHED/FAILED/SKIPPED contract, and the sandbox and safety gates."
risk: critical
source: project
date_added: "2026-10-09"
---

# Social Publishing APIs

How this repo talks to X, LinkedIn and Instagram. Every rule below is derived from
`src/lib/twitter.ts`, `src/lib/linkedin.ts`, `src/lib/oauth.ts`, `src/lib/publisher.ts`
and `src/lib/platformSpecs.ts`. Follow them instead of re-deriving the APIs.

## Use this skill when

- Adding or changing a publishing path for X, LinkedIn or Instagram
- Wiring OAuth connect / callback / token refresh
- Debugging a post that failed, silently dropped its image, or posted as text
- Building a preview, editor or character/hashtag limit for a platform
- Adding a new platform adapter

## Do not use this skill when

- The change never reaches a social provider (pure UI, calendar generation, DB work)
- You need the content-generation prompt rules - that is the Python tool's job

## Instructions

### 1. Never report success you did not achieve

This is the load-bearing rule of the whole publishing layer. `publishPost()` returns one of:

- `PUBLISHED` - a platform API accepted it and returned an id
- `FAILED` - we tried and the provider refused; the provider's reason is recorded verbatim
- `SKIPPED` - we could not even try (no account, sandbox connection, safety gate off)

Do not add a fallback that turns a failed image upload into a text-only post. That exact
behaviour is why an image used to be silently dropped (see the header comment in
`src/lib/linkedin.ts`). A requested image that fails to upload FAILS the dispatch.

### 2. Result type, not exceptions

Every provider function in `twitter.ts` / `linkedin.ts` returns:

```ts
type XResult<T> = { ok: true; value: T } | { ok: false; reason: string };
```

Never throw across this boundary, and never invent a placeholder token or id. Reasons
include the HTTP status and a truncated body (`.slice(0, 200)`-`.slice(0, 300)`).

### 3. Order of gates in `publishPost()`

1. No `social_connections` row -> `SKIPPED` `no <PLATFORM> account connected`
2. `connected = false` -> `SKIPPED` disconnected
3. `is_sandbox` or no `access_token` -> `SKIPPED` sandbox, nothing was posted
4. `PUBLISHING_ENABLED !== 'true'` and not an explicit human dispatch -> `SKIPPED` left queued
5. Platform switch

`opts.explicit` (`true` only for "Dispatch Now") bypasses gate 4. The scheduler must never
bypass it.

### 4. X / Twitter (v2, OAuth 2.0 PKCE)

- Hosts: `https://api.x.com/2/tweets`, `https://api.x.com/2/media/upload`
- Auth: `Authorization: Bearer <access_token>`; app credentials as HTTP Basic on the token endpoint
- Scope: `tweet.read tweet.write users.read offline.access media.write`
- Access tokens live ~2h. Refresh when `token_expires_at - now < 5 minutes`; if there is no
  stored refresh token, FAIL with `reconnect X` - do not retry blindly
- The refresh token **rotates** on use. Persist the new one; when the response omits it, keep the old
- Media: **single-request** upload. One multipart POST to `/2/media/upload` with the file in the
  `media` field plus `media_category=tweet_image` and `media_type`. Do NOT send `command: INIT`
  or use INIT/APPEND/FINALIZE - that path is for video, and `INIT` here is rejected with
  `Missing media field in JSON`. No status polling for images
- Accepted image types: png, jpg/jpeg, gif, webp

### 5. LinkedIn (versioned REST)

- Every request sends `LinkedIn-Version: <LINKEDIN_API_VERSION>` (default `202608`) and
  `X-Restli-Protocol-Version: 2.0.0`. Bump the env var, never hardcode a version
- Author is `urn:li:person:<sub>` where `sub` comes from `GET /v2/userinfo`
- Scope: `openid profile email w_member_social`. `email` is what makes the stored handle
  readable - without it `userinfo` returns only an opaque `sub`
- An image is **three calls, in order**. Do not use the deprecated `/v2/ugcPosts` endpoint:
  1. `POST /rest/images?action=initializeUpload` -> `uploadUrl` + `urn:li:image:...`
  2. `PUT <uploadUrl>` with `Content-Type: application/octet-stream` (single use, must be PUT)
  3. `POST /rest/posts` with `content.media.id` = the image URN
- The created post id comes from the **`x-restli-id` response header**, not the body
- `commentary` is sliced to 3000 chars
- Mentions are `@[Display Name](urn:li:person:<id>)` and only render for people the author is
  connected to. There is no public lookup API, so the URN must come from the user
- `lifecycleState` is `PUBLISHED` or `DRAFT`. With `LINKEDIN_POST_AS_DRAFT=true` a draft is
  reported `SKIPPED`, not `PUBLISHED` - a draft is not a published post
- Accepted image types: png, jpg/jpeg (no webp)

### 6. Instagram

Adapter is **not implemented** - live publishing returns `FAILED`
`live Instagram publishing is not implemented yet`. OAuth config does exist
(Graph `v21.0`, scope `instagram_basic,instagram_content_publish,pages_show_list`).
Do not claim Instagram works until the publish path is written.

### 7. Serving media to the providers

`mediaUrl` is an app URL (`/api/media/...`), not a public URL. Resolve it to disk with
`resolveMediaFile()` / `resolveXMediaFile()`, which:

- require the `/api/media/` prefix
- resolve under `<cwd>/media`
- reject anything where `!filePath.startsWith(root + path.sep)` (path traversal)
- reject an extension outside that platform's allowlist

Reuse these guards. Never read an arbitrary path from a request body.

### 8. One image size per platform

Never size one image for all platforms. `src/lib/platformSpecs.ts` and `PLATFORM_SPECS` in
`tools/generate_calendar.py` must stay in step:

| Platform | Feed size | Ratio |
|---|---|---|
| X | 1600x900 | 16:9 |
| LinkedIn | 1200x1200 | 1:1 |
| Instagram | 1080x1350 | 4:5 |

### 9. OAuth connect flow

`oauthConfig(platform)` is the single source of truth (authorize URL, token URL, scope,
whether PKCE is used, identity endpoint + parser). State is a random hex value mirrored in an
HttpOnly cookie; PKCE is S256 with the verifier in a cookie, never in the URL. Missing client
id/secret means `isConfigured()` is false and the route redirects back with an explicit
`oauth_error` naming the env vars - keep that behaviour rather than faking a connection.

### 10. Relevant environment

| Var | Effect |
|---|---|
| `PUBLISHING_ENABLED` | `true` arms the scheduler. Unset/false = scheduler skips; Dispatch Now still works |
| `LINKEDIN_POST_AS_DRAFT` | `true` composes without publishing to the feed |
| `LINKEDIN_API_VERSION` | LinkedIn REST version, default `202608` |
| `TWITTER_CLIENT_ID` / `_SECRET` | X app credentials |
| `LINKEDIN_CLIENT_ID` / `_SECRET` | LinkedIn app credentials |
| `INSTAGRAM_APP_ID` / `_SECRET` | Meta app credentials |

## Resources

- `src/lib/publisher.ts` - gates and the platform switch
- `src/lib/twitter.ts`, `src/lib/linkedin.ts` - provider adapters
- `src/lib/oauth.ts` - OAuth config, PKCE, identity parsing
- `src/lib/platformSpecs.ts` - per-platform limits and image sizes

## Limitations

- Providers change their APIs; confirm against live docs before shipping a new endpoint.
- Nothing here is verified against a live account - sandbox mode reports `SKIPPED`.
- Applying this skill does not substitute for a real end-to-end publish test.
