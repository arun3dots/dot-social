import fs from 'fs';
import path from 'path';

/**
 * X (Twitter) publishing via the v2 API with OAuth 2.0 PKCE.
 *
 * - Text posts: POST /2/tweets with a Bearer token carrying the tweet.write scope.
 * - Images: v2 chunked media upload (INIT -> APPEND -> FINALIZE) carrying the media.write scope,
 *   then the media_id is attached on the tweet. The legacy v1.1 upload host accepts OAuth 1.0a
 *   signatures only, so we use the v2 endpoint exclusively.
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

/** Upload an image (chunked, single segment) and return the media_id to attach to a post. */
export async function uploadXMedia(
  token: string,
  filePath: string,
  contentType: string
): Promise<XResult<string>> {
  try {
    const bytes = fs.readFileSync(filePath);
    const totalBytes = bytes.length;

    // INIT
    const initForm = new FormData();
    initForm.append('command', 'INIT');
    initForm.append('total_bytes', String(totalBytes));
    initForm.append('media_type', contentType);
    initForm.append('media_category', 'tweet_image');
    const initRes = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: initForm,
    });
    const initText = await initRes.text();
    if (!initRes.ok) {
      return { ok: false, reason: `X refused the media upload init: HTTP ${initRes.status} ${initText.slice(0, 220)}` };
    }
    let mediaId = '';
    try {
      mediaId = JSON.parse(initText)?.data?.id || '';
    } catch { /* fall through */ }
    if (!mediaId) return { ok: false, reason: `X upload init returned no media id: ${initText.slice(0, 200)}` };

    // APPEND (one segment - images are well under the 5 MB limit)
    const appendForm = new FormData();
    appendForm.append('command', 'APPEND');
    appendForm.append('media_id', mediaId);
    appendForm.append('segment_index', '0');
    appendForm.append('media', new Blob([new Uint8Array(bytes)], { type: contentType }));
    const appendRes = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: appendForm,
    });
    if (!appendRes.ok) {
      const detail = (await appendRes.text()).slice(0, 200);
      return { ok: false, reason: `X rejected the media append: HTTP ${appendRes.status} ${detail}` };
    }

    // FINALIZE
    const finForm = new FormData();
    finForm.append('command', 'FINALIZE');
    finForm.append('media_id', mediaId);
    const finRes = await fetch(UPLOAD_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: finForm,
    });
    const finText = await finRes.text();
    if (!finRes.ok) return { ok: false, reason: `X media finalize failed: HTTP ${finRes.status} ${finText.slice(0, 220)}` };

    return { ok: true, value: mediaId };
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
  const root = path.join(process.cwd(), 'media');
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
