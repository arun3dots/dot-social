import { NextRequest, NextResponse } from 'next/server';
import pool, { appendDbAuditLog, initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import { publishPost } from '@/lib/publisher';

/**
 * Dispatch a single post now. Accepts either a persisted post ({ postId }) or the
 * legacy inline body ({ post }). Both go through the same publisher as the scheduler,
 * so the UI can never claim a post went out when it did not.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = await currentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await initPostgresTables();

    let row: any = null;
    if (body.postId) {
      const r = await pool.query(
        `SELECT id, user_id, platform, content, media_url, scheduled_time, status
         FROM posts WHERE id = $1 AND user_id = $2`,
        [body.postId, userId]
      );
      if (r.rows.length === 0) {
        return NextResponse.json({ error: 'Post not found for this user' }, { status: 404 });
      }
      row = r.rows[0];
    } else if (body.post) {
      row = {
        id: body.post.id,
        user_id: userId,
        platform: body.post.platform,
        content: body.post.content,
        media_url: body.post.mediaUrl ?? null,
        scheduled_time: body.post.scheduledTime ?? null,
        status: body.post.status ?? 'PENDING_APPROVAL',
      };
    } else {
      return NextResponse.json({ error: 'postId or post is required' }, { status: 400 });
    }

    const out = await publishPost({
      userId,
      platform: row.platform,
      content: row.content,
      mediaUrl: row.media_url,
    });

    if (body.postId) {
      const statusAfter = out.status === 'PUBLISHED' ? 'PUBLISHED' : out.status === 'SKIPPED' ? row.status : 'FAILED';
      await pool.query(
        `UPDATE posts
            SET status = $1::varchar, publish_error = $2,
                publish_attempts = COALESCE(publish_attempts, 0) + 1,
                published_at = CASE WHEN $1::text = 'PUBLISHED' THEN NOW() ELSE published_at END,
                external_id = $3, external_url = $4
          WHERE id = $5`,
        [statusAfter, out.status === 'PUBLISHED' ? null : out.reason, out.externalId || null, out.externalUrl || null, row.id]
      );
    }

    try {
      await appendDbAuditLog({
        userId,
        platform: row.platform,
        postId: row.id,
        status: out.status,
        isSandbox: out.mode === 'sandbox',
        payload: { reason: out.reason },
        externalId: out.externalId,
        externalUrl: out.externalUrl,
      });
    } catch (e) {
      console.error('audit log failed', e);
    }

    return NextResponse.json({
      processedCount: 1,
      results: [{ postId: row.id, platform: row.platform, status: out.status, reason: out.reason, externalUrl: out.externalUrl }],
      published: out.status === 'PUBLISHED',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
