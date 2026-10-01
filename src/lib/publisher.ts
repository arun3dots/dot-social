import pool from '@/lib/postgres';

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
}): Promise<PublishOutcome> {
  const platform = String(opts.platform || '').toUpperCase();

  const conn = await pool.query(
    `SELECT id, account_handle, connected, is_sandbox, access_token
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

  switch (platform) {
    case 'LINKEDIN':
      return publishLinkedIn(c.access_token, opts);
    case 'TWITTER':
      return { status: 'FAILED', reason: 'live X publishing is not implemented yet', mode: 'live' };
    case 'INSTAGRAM':
      return { status: 'FAILED', reason: 'live Instagram publishing is not implemented yet', mode: 'live' };
    default:
      return { status: 'FAILED', reason: `unsupported platform ${platform}`, mode: 'sandbox' };
  }
}

/**
 * LinkedIn UGC post. Text-only for now: image upload needs the assets API and an
 * approved app, so a post with an image is still sent as text (never as a stock photo).
 */
async function publishLinkedIn(
  token: string,
  opts: { content: string; mediaUrl?: string | null }
): Promise<PublishOutcome> {
  try {
    const who = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!who.ok) {
      return { status: 'FAILED', reason: `LinkedIn auth check failed: HTTP ${who.status}`, mode: 'live' };
    }
    const me: any = await who.json();

    const res = await fetch('https://api.linkedin.com/v2/ugcPosts', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0',
      },
      body: JSON.stringify({
        author: `urn:li:person:${me.sub}`,
        lifecycleState: 'PUBLISHED',
        specificContent: {
          'com.linkedin.ugc.ShareContent': {
            shareCommentary: { text: opts.content },
            shareMediaCategory: 'NONE',
          },
        },
        visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
      }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      return { status: 'FAILED', reason: `LinkedIn rejected the post: HTTP ${res.status} ${detail}`, mode: 'live' };
    }
    const id = res.headers.get('x-restli-id') || '';
    return {
      status: 'PUBLISHED',
      reason: opts.mediaUrl ? 'accepted by LinkedIn (text only - image upload not implemented)' : 'accepted by LinkedIn',
      mode: 'live',
      externalId: id || undefined,
      externalUrl: id ? `https://www.linkedin.com/feed/update/${id}` : undefined,
    };
  } catch (e: any) {
    return { status: 'FAILED', reason: `LinkedIn request error: ${e.message}`, mode: 'live' };
  }
}
