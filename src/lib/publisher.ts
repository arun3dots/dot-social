import pool from '@/lib/postgres';
import {
  createLinkedInPost,
  linkedInMemberId,
  mentionToken,
  resolveMediaFile,
  uploadLinkedInImage,
} from '@/lib/linkedin';
import { createXTweet, refreshXToken, resolveXMediaFile, uploadXMedia } from '@/lib/twitter';

export type PublishOutcome = {
  status: 'PUBLISHED' | 'FAILED' | 'SKIPPED';
  reason: string;
  mode: 'live' | 'sandbox';
  externalId?: string;
  externalUrl?: string;
};

/**
 * Publish a single post.
 *
 * Contract: this function NEVER reports success it did not achieve. A post becomes
 * PUBLISHED only when a platform API accepted it. Everything else is FAILED (we tried
 * and the platform refused) or SKIPPED (we could not even try - no account, sandbox
 * credentials, or no live integration). The caller records the reason verbatim.
 */
export async function publishPost(opts: {
  userId: string;
  platform: string;
  content: string;
  mediaUrl?: string | null;
  /** People to mention in the post, as urn:li:person:<id>. LinkedIn only renders these for
   *  accounts the author is connected to. */
  taggedUsers?: { name: string; urn: string }[] | null;
  /** true only for a human-initiated single dispatch ("Dispatch Now"). */
  explicit?: boolean;
}): Promise<PublishOutcome> {
  const platform = String(opts.platform || '').toUpperCase();

  const conn = await pool.query(
    `SELECT id, account_handle, connected, is_sandbox, access_token, refresh_token, token_expires_at
     FROM social_connections WHERE user_id = $1 AND platform = $2 LIMIT 1`,
    [opts.userId, platform]
  );

  if (conn.rows.length === 0) {
    return { status: 'SKIPPED', reason: `no ${platform} account connected`, mode: 'sandbox' };
  }
  const c = conn.rows[0];
  if (!c.connected) {
    return { status: 'SKIPPED', reason: `${platform} connection is disconnected`, mode: 'sandbox' };
  }
  if (c.is_sandbox || !c.access_token) {
    return {
      status: 'SKIPPED',
      reason: `${platform} connection is sandbox (no live credentials) - nothing was posted`,
      mode: 'sandbox',
    };
  }

  // Safety gate: the scheduler must not post to a real account until the owner arms it.
  // An explicit per-post human dispatch ("Dispatch Now") is allowed through regardless.
  const armed = (process.env.PUBLISHING_ENABLED || '').trim() === 'true';
  if (!armed && !opts.explicit) {
    return {
      status: 'SKIPPED',
      reason:
        'live publishing is OFF (PUBLISHING_ENABLED is not "true") - the post was left queued. ' +
        'Use Dispatch Now to post this one explicitly, or arm the scheduler.',
      mode: 'live',
    };
  }

  switch (platform) {
    case 'LINKEDIN':
      return publishLinkedIn(c.access_token, opts);
    case 'TWITTER':
      return publishTwitter(c, opts);
    case 'INSTAGRAM':
      return { status: 'FAILED', reason: 'live Instagram publishing is not implemented yet', mode: 'live' };
    default:
      return { status: 'FAILED', reason: `unsupported platform ${platform}`, mode: 'sandbox' };
  }
}

/**
 * LinkedIn post via the versioned REST API.
 *
 * A post that has an image gets that image uploaded and attached (initializeUpload -> PUT the
 * bytes -> /rest/posts with content.media.id). If the image is requested and the upload fails,
 * the dispatch FAILS with the provider's reason - it never quietly degrades to a text-only post,
 * which is how the image was silently dropped before.
 */
async function publishLinkedIn(
  token: string,
  opts: {
    content: string;
    mediaUrl?: string | null;
    taggedUsers?: { name: string; urn: string }[] | null;
  }
): Promise<PublishOutcome> {
  const me = await linkedInMemberId(token);
  if (!me.ok) return { status: 'FAILED', reason: me.reason, mode: 'live' };
  const authorUrn = `urn:li:person:${me.value}`;

  // Mentions go at the end of the commentary, in LinkedIn's own format.
  const mentions = (opts.taggedUsers || [])
    .filter((t) => t && t.urn)
    .map((t) => mentionToken(t.name, t.urn));
  const commentary = [opts.content, mentions.join(' ')].filter(Boolean).join('\n\n').slice(0, 3000);

  let imageUrn: string | undefined;
  if (opts.mediaUrl) {
    const file = resolveMediaFile(opts.mediaUrl);
    if (!file.ok) return { status: 'FAILED', reason: `image not attachable: ${file.reason}`, mode: 'live' };

    const uploaded = await uploadLinkedInImage(token, {
      ownerUrn: authorUrn,
      filePath: file.value.filePath,
      contentType: file.value.contentType,
    });
    if (!uploaded.ok) return { status: 'FAILED', reason: uploaded.reason, mode: 'live' };
    imageUrn = uploaded.value;
  }

  // Test-only switch: proves the whole pipeline (including the image) without putting anything
  // on the live feed. A draft is NOT a published post, so it is reported as skipped, not success.
  const asDraft = (process.env.LINKEDIN_POST_AS_DRAFT || '').trim() === 'true';

  const created = await createLinkedInPost(token, {
    authorUrn,
    commentary,
    imageUrn,
    altText: opts.content,
    lifecycleState: asDraft ? 'DRAFT' : 'PUBLISHED',
  });
  if (!created.ok) return { status: 'FAILED', reason: created.reason, mode: 'live' };

  if (asDraft) {
    return {
      status: 'SKIPPED',
      reason:
        `created as a LinkedIn DRAFT (not published - LINKEDIN_POST_AS_DRAFT=true), id ${created.value.id || 'unknown'}` +
        (imageUrn ? `, image ${imageUrn} attached` : ', no image'),
      mode: 'live',
      externalId: created.value.id || undefined,
    };
  }

  return {
    status: 'PUBLISHED',
    reason: imageUrn ? `accepted by LinkedIn with image ${imageUrn}` : 'accepted by LinkedIn (text post)',
    mode: 'live',
    externalId: created.value.id || undefined,
    externalUrl: created.value.url,
  };
}

/**
 * X post via the v2 API (OAuth 2.0). A post with an image uploads it first (INIT -> APPEND ->
 * FINALIZE) and attaches the media_id; an image that fails to upload FAILS the dispatch rather than
 * quietly dropping to a text-only post. The access token is refreshed with the stored refresh token
 * when it is near expiry.
 */
async function publishTwitter(
  c: { id: string; access_token: string; refresh_token?: string | null; token_expires_at?: string | null },
  opts: { content: string; mediaUrl?: string | null }
): Promise<PublishOutcome> {
  let token = c.access_token;

  // Refresh when the token is already expired or inside 5 minutes of expiring. X tokens live ~2h.
  const expiresAt = c.token_expires_at ? Date.parse(c.token_expires_at) : NaN;
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() < 5 * 60 * 1000) {
    if (!c.refresh_token) {
      return {
        status: 'FAILED',
        reason: 'X access token expired and no refresh token is stored - reconnect X',
        mode: 'live',
      };
    }
    const refreshed = await refreshXToken(c.refresh_token);
    if (!refreshed.ok) return { status: 'FAILED', reason: refreshed.reason, mode: 'live' };
    token = refreshed.value.accessToken;
    await pool.query(
      `UPDATE social_connections SET access_token = $1, refresh_token = $2, token_expires_at = $3 WHERE id = $4`,
      [
        refreshed.value.accessToken,
        refreshed.value.refreshToken,
        new Date(Date.now() + refreshed.value.expiresIn * 1000).toISOString(),
        c.id,
      ]
    );
  }

  let mediaId: string | undefined;
  if (opts.mediaUrl) {
    const file = resolveXMediaFile(opts.mediaUrl);
    if (!file.ok) return { status: 'FAILED', reason: `image not attachable: ${file.reason}`, mode: 'live' };
    const uploaded = await uploadXMedia(token, file.value.filePath, file.value.contentType);
    if (!uploaded.ok) return { status: 'FAILED', reason: uploaded.reason, mode: 'live' };
    mediaId = uploaded.value;
  }

  const created = await createXTweet(token, { text: opts.content, mediaId });
  if (!created.ok) return { status: 'FAILED', reason: created.reason, mode: 'live' };

  return {
    status: 'PUBLISHED',
    reason: mediaId ? `accepted by X with media ${mediaId}` : 'accepted by X (text post)',
    mode: 'live',
    externalId: created.value.id,
    externalUrl: created.value.url,
  };
}
