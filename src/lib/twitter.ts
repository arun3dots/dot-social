import fs from 'fs';
import path from 'path';

/**
 * X (Twitter) publishing via the v2 API with OAuth 2.0 PKCE.
 *
 * - Text posts: POST /2/tweets with a Bearer token carrying the tweet.write scope.
 * - Images: the v2 media upload's single-request form - POST /2/media/upload with a multipart
 *   `media` file field + media_category/media_type - carrying the media.write scope, then the
 *   media_id is attached on the tweet. (The chunked initialize/append/finalize path is for video,
 *   which this product does not post; the legacy v1.1 upload host takes OAuth 1.0a signatures only.)
 * - Tokens: X access tokens expire in ~2h, so the publisher refreshes with the stored refresh
 *   token (offline.access) before posting when the token is near expiry.
 */

const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const UPLOAD_URL = 'https://api.x.com/2/media/upload';
const TWEET_URL = 'https://api.x.com/2/tweets';

export type XResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/** Exchange a refresh token for a fresh access token. The refresh token rotates on use. */
export async function refreshXToken(
  refreshToken: string
): Promise<XResult<{ accessToken: string; refreshToken: string; expiresIn: number }>> {
  const clientId = (process.env.TWITTER_CLIENT_ID || '').trim();
  const clientSecret = (process.env.TWITTER_CLIENT_SECRET || '').trim();
  if (!clientId || !clientSecret) return { ok: false, reason: 'X app credentials are not configured' };
  try {
    const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
      }).toString(),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, reason: `X token refresh failed: HTTP ${res.status} ${text.slice(0, 200)}` };
    let json: any = {};
    try { json = JSON.parse(text); } catch { /* not JSON */ }
    if (!json.access_token) return { ok: false, reason: 'X refresh response carried no access_token' };
    return {
      ok: true,
      value: {
        accessToken: json.access_token,
        refreshToken: json.refresh_token || refreshToken, // rotates; keep the old one when absent
        expiresIn: Number(json.expires_in) || 7200,
      },
    };
  } catch (e: any) {
    return { ok: false, reason: `X token refresh error: ${e.message}` };
  }
}

/**
 * Upload an image and return the media_id to attach to a post.
 *
 * Images use the single-request upload: one multipart/form-data POST with the file in the `media`
 * field plus media_category and media_type. It does NOT take a `command` - sending INIT here is what
 * X rejects with "Missing media field in JSON". No INIT/APPEND/FINALIZE and no status polling are
 * needed for images.
 */
export async function uploadXMedia(
  token: string,
  filePath: string,
  contentType: string
): Promise<XResult<string>> {
  try {
    const bytes = fs.readFileSync(filePath);
    const fileName = path.basename(filePath) || 'image';

    const form = new FormData();
    form.append('media', new Blob([new Uint8Array(bytes)], { type: contentType }), fileName);
    form.append('media_category', 'tweet_image');
    form.append('media_type', contentType);

    const res = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, reason: `X refused the media upload: HTTP ${res.status} ${text.slice(0, 220)}` };
    }
    let json: any = {};
    try { json = JSON.parse(text); } catch { /* fall through */ }
    const mediaId = json?.data?.id || json?.id || '';
    if (!mediaId) return { ok: false, reason: `X upload returned no media id: ${text.slice(0, 200)}` };
    return { ok: true, value: String(mediaId) };
  } catch (e: any) {
    return { ok: false, reason: `X media upload error: ${e.message}` };
  }
}

/** Create a tweet, attaching media when one was uploaded. */
export async function createXTweet(
  token: string,
  args: { text: string; mediaId?: string }
): Promise<XResult<{ id: string; url: string }>> {
  try {
    const body: Record<string, any> = { text: args.text };
    if (args.mediaId) body.media = { media_ids: [args.mediaId] };
    const res = await fetch(TWEET_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, reason: `X rejected the post: HTTP ${res.status} ${text.slice(0, 300)}` };
    let json: any = {};
    try { json = JSON.parse(text); } catch { /* fall through */ }
    const id = json?.data?.id || '';
    if (!id) return { ok: false, reason: `X accepted the post but returned no id: ${text.slice(0, 200)}` };
    return { ok: true, value: { id, url: `https://x.com/i/status/${id}` } };
  } catch (e: any) {
    return { ok: false, reason: `X post error: ${e.message}` };
  }
}

/** Resolve a /api/media/... URL to a file on disk, guarded to stay inside media/. */
export function resolveXMediaFile(mediaUrl: string): XResult<{ filePath: string; contentType: string }> {
  const prefix = '/api/media/';
  if (!mediaUrl || !mediaUrl.startsWith(prefix)) {
    return { ok: false, reason: `media path is not a served media URL: ${mediaUrl}` };
  }
  const rel = decodeURIComponent(mediaUrl.slice(prefix.length));
  const baseDir = process.env.VERCEL ? '/tmp' : process.cwd();
  const root = path.join(baseDir, 'media');
  const filePath = path.join(root, rel);
  if (!filePath.startsWith(root + path.sep)) {
    return { ok: false, reason: 'media path escapes the media directory' };
  }
  if (!fs.existsSync(filePath)) {
    return { ok: false, reason: `media file is missing on disk: ${rel}` };
  }
  const map: Record<string, string> = {
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
  };
  const contentType = map[path.extname(filePath).toLowerCase()];
  if (!contentType) {
    return { ok: false, reason: `X accepts JPG, PNG, GIF and WEBP - got ${path.extname(filePath) || 'no extension'}` };
  }
  return { ok: true, value: { filePath, contentType } };
}
