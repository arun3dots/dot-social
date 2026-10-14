import fs from 'fs';
import path from 'path';

/**
 * LinkedIn publishing (REST API, versioned).
 *
 * A post with an image is three calls, in order:
 *   1. POST /rest/images?action=initializeUpload  -> uploadUrl + urn:li:image:...
 *   2. PUT  <uploadUrl> with the image bytes      -> the asset exists
 *   3. POST /rest/posts with content.media.id     -> the post exists
 *
 * The previous implementation posted to the deprecated /v2/ugcPosts endpoint with
 * shareMediaCategory 'NONE', so an image was silently dropped and the post went out as text.
 * Nothing here falls back to a text-only post when an image was requested: if the upload
 * fails, the caller is told exactly what failed.
 */

// LinkedIn cuts a monthly version and supports each for at least a year. Overridable so a
// future sunset can be handled without a code change.
const API_VERSION = (process.env.LINKEDIN_API_VERSION || '202608').trim();

const restHeaders = (token: string, extra: Record<string, string> = {}) => ({
  Authorization: `Bearer ${token}`,
  'LinkedIn-Version': API_VERSION,
  'X-Restli-Protocol-Version': '2.0.0',
  ...extra,
});

export type LinkedInResult<T> = { ok: true; value: T } | { ok: false; reason: string };

/** The member's numeric id, needed for the urn:li:person: author and image owner. */
export async function linkedInMemberId(token: string): Promise<LinkedInResult<string>> {
  try {
    const res = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return { ok: false, reason: `LinkedIn auth check failed: HTTP ${res.status} ${detail}` };
    }
    const me: any = await res.json();
    if (!me?.sub) return { ok: false, reason: 'LinkedIn userinfo returned no member id' };
    return { ok: true, value: String(me.sub) };
  } catch (e: any) {
    return { ok: false, reason: `LinkedIn auth check error: ${e.message}` };
  }
}

/**
 * Resolve a media URL served by /api/media/[...path] to a file on disk.
 * Only paths under media/ are ever read, and the resolved path must stay inside it.
 */
export function resolveMediaFile(mediaUrl: string): LinkedInResult<{ filePath: string; contentType: string }> {
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
  const ext = path.extname(filePath).toLowerCase();
  const contentType =
    ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : '';
  if (!contentType) {
    return { ok: false, reason: `LinkedIn accepts JPG, GIF and PNG only - got ${ext || 'no extension'}` };
  }
  return { ok: true, value: { filePath, contentType } };
}

/** Step 1 + 2: register the upload with LinkedIn, then send the bytes. */
export async function uploadLinkedInImage(
  token: string,
  args: { ownerUrn: string; filePath: string; contentType: string }
): Promise<LinkedInResult<string>> {
  try {
    // Step 1 - declare the upload, get the URL and the image URN.
    const init = await fetch('https://api.linkedin.com/rest/images?action=initializeUpload', {
      method: 'POST',
      headers: restHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ initializeUploadRequest: { owner: args.ownerUrn } }),
    });
    const initText = await init.text();
    if (!init.ok) {
      return {
        ok: false,
        reason: `LinkedIn refused the image upload registration: HTTP ${init.status} ${initText.slice(0, 220)}`,
      };
    }
    let uploadUrl = '';
    let imageUrn = '';
    try {
      const parsed = JSON.parse(initText);
      uploadUrl = parsed?.value?.uploadUrl || '';
      imageUrn = parsed?.value?.image || '';
    } catch {
      return { ok: false, reason: `LinkedIn returned an unreadable upload registration: ${initText.slice(0, 200)}` };
    }
    if (!uploadUrl || !imageUrn) {
      return { ok: false, reason: `LinkedIn upload registration had no uploadUrl/image: ${initText.slice(0, 200)}` };
    }

    // Step 2 - send the bytes to that URL (single use, and it must be a PUT).
    const bytes = fs.readFileSync(args.filePath);
    const put = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/octet-stream',
      },
      body: new Uint8Array(bytes),
    });
    if (!put.ok) {
      const detail = (await put.text()).slice(0, 200);
      return { ok: false, reason: `LinkedIn rejected the image bytes: HTTP ${put.status} ${detail}` };
    }

    return { ok: true, value: imageUrn };
  } catch (e: any) {
    return { ok: false, reason: `LinkedIn image upload error: ${e.message}` };
  }
}

/** Step 3: create the post, with the image attached when one was given. */
export async function createLinkedInPost(
  token: string,
  args: {
    authorUrn: string;
    commentary: string;
    imageUrn?: string;
    altText?: string;
    /** 'DRAFT' exists so a post can be composed without publishing it. */
    lifecycleState?: 'PUBLISHED' | 'DRAFT';
  }
): Promise<LinkedInResult<{ id: string; url?: string }>> {
  try {
    const body: Record<string, any> = {
      author: args.authorUrn,
      commentary: args.commentary,
      visibility: 'PUBLIC',
      distribution: {
        feedDistribution: 'MAIN_FEED',
        targetEntities: [],
        thirdPartyDistributionChannels: [],
      },
      lifecycleState: args.lifecycleState || 'PUBLISHED',
      isReshareDisabledByAuthor: false,
    };
    if (args.imageUrn) {
      body.content = {
        media: {
          id: args.imageUrn,
          ...(args.altText ? { altText: args.altText.slice(0, 300) } : {}),
        },
      };
    }

    const res = await fetch('https://api.linkedin.com/rest/posts', {
      method: 'POST',
      headers: restHeaders(token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) {
      return { ok: false, reason: `LinkedIn rejected the post: HTTP ${res.status} ${text.slice(0, 300)}` };
    }
    const id = res.headers.get('x-restli-id') || '';
    return {
      ok: true,
      value: { id, url: id ? `https://www.linkedin.com/feed/update/${id}` : undefined },
    };
  } catch (e: any) {
    return { ok: false, reason: `LinkedIn post error: ${e.message}` };
  }
}

/**
 * Format a tagged person for the commentary.
 *
 * LinkedIn accepts mentions as `@[Display Name](urn:li:person:<id>)` and only renders them
 * for people the author is connected to - there is no public API to look a member up, so the
 * URN has to come from the user.
 */
export function mentionToken(name: string, urn: string): string {
  const label = (name || 'LinkedIn member').replace(/[\[\]()]/g, '').trim();
  const cleanUrn = urn.trim().startsWith('urn:li:person:') ? urn.trim() : `urn:li:person:${urn.trim()}`;
  return `@[${label}](${cleanUrn})`;
}

/** Pull the member id out of a profile URL or a raw id/URN. Returns '' when there is none. */
export function urnFromProfileInput(input: string): string {
  const raw = (input || '').trim();
  if (!raw) return '';
  const urnMatch = raw.match(/urn:li:person:[A-Za-z0-9_-]+/);
  if (urnMatch) return urnMatch[0];
  const idFromQuery = raw.match(/[?&](?:id|memberId)=([A-Za-z0-9_-]{4,})/);
  if (idFromQuery) return `urn:li:person:${idFromQuery[1]}`;
  // A bare id, e.g. AbC123xyz (LinkedIn member ids are alphanumeric).
  if (/^[A-Za-z0-9_-]{4,40}$/.test(raw)) return `urn:li:person:${raw}`;
  // A vanity profile URL (/in/name) carries no id - be explicit rather than guessing.
  return '';
}
