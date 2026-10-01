import { NextRequest, NextResponse } from 'next/server';
import pool, { appendDbAuditLog, initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import { publishPost } from '@/lib/publisher';

/**
 * Dispatch a single post now. Accepts either a persisted post ({ postId }) or the
 * legacy inline body ({ post }). Both go through the same publisher as the scheduler,
 * so the UI can never claim a post went out when it did not.
 *
 * A manual dispatch does NOT consume the schedule: unless keepScheduled is explicitly false, the
 * post stays queued and is posted again when its scheduled time arrives.
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
        `SELECT id, user_id, platform, content, media_url, scheduled_time, status, tagged_users
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
        tagged_users: body.post.taggedUsers ?? null,
      };
    } else {
      return NextResponse.json({ error: 'postId or post is required' }, { status: 400 });
    }

    // Posting once, on purpose: keepScheduled:false takes the post out of the schedule.
    const keepScheduled = body.keepScheduled === undefined ? true : body.keepScheduled === true;

    const out = await publishPost({
      userId,
      platform: row.platform,
      content: row.content,
      mediaUrl: row.media_url,
      taggedUsers: Array.isArray(row.tagged_users) ? row.tagged_users : null,
      explicit: true, // a human pressed Dispatch Now for this specific post
    });

    // An object the platform really created is worth recording even when it is not publicly visible
    // (a DRAFT), so "accepted" and "publicly posted" are kept apart.
    const accepted = !!(out.externalId || out.externalUrl);
    const publiclyPosted = out.status === 'PUBLISHED';
    let statusAfter: string = row.status;

    if (body.postId) {
      // Has this post's scheduled moment already passed? Requeueing a post whose moment has gone
      // would make the next tick repost it in a loop, so that case is never requeued.
      const t = Date.parse(String(row.scheduled_time || ''));
      const stillScheduled = Number.isFinite(t) && t > Date.now();

      if (accepted) {
        // The platform created something (live or draft). Record it either way; whether the post
        // stays promised to its schedule is what keepScheduled decides.
        if (keepScheduled && stillScheduled) {
          statusAfter = 'APPROVED'; // still queued: the scheduler will post it at its time
        } else if (!keepScheduled) {
          statusAfter = publiclyPosted ? 'PUBLISHED' : row.status; // never drop a post over a draft
        } else {
          statusAfter = row.status; // already due: leave it alone rather than loop
        }

        const setScheduledResult = !keepScheduled && publiclyPosted;

        await pool.query(
          `UPDATE posts
              SET status = $1::varchar,
                  publish_error = $2,
                  publish_attempts = COALESCE(publish_attempts, 0) + 1,
                  published_at = CASE WHEN $4::boolean THEN NOW() ELSE published_at END,
                  external_id  = CASE WHEN $4::boolean THEN $5 ELSE external_id END,
                  external_url = CASE WHEN $4::boolean THEN $6 ELSE external_url END,
                  manual_published_at = NOW(),
                  manual_external_url = $6
            WHERE id = $3`,
          [
            statusAfter,
            publiclyPosted ? null : out.reason,
            row.id,
            setScheduledResult,
            out.externalId || null,
            out.externalUrl || null,
          ]
        );
      } else {
        // Nothing was created. A post that is still promised to the schedule keeps its status so the
        // scheduler can try again; a one-off dispatch of a post that is already published fails.
        statusAfter =
          out.status === 'SKIPPED'
            ? row.status
            : keepScheduled && row.status !== 'PUBLISHED'
            ? 'APPROVED'
            : 'FAILED';
        await pool.query(
          `UPDATE posts
              SET status = $1::varchar, publish_error = $2,
                  publish_attempts = COALESCE(publish_attempts, 0) + 1
            WHERE id = $3`,
          [statusAfter, out.reason, row.id]
        );
      }
    }

    try {
      await appendDbAuditLog({
        userId,
        platform: row.platform,
        postId: row.id,
        status: out.status,
        isSandbox: out.mode === 'sandbox',
        payload: { reason: out.reason, manual: true, keepScheduled },
        externalId: out.externalId,
        externalUrl: out.externalUrl,
      });
    } catch (e) {
      console.error('audit log failed', e);
    }

    // Only promise a repeat when the post is genuinely still queued and its moment has not passed.
    const t2 = Date.parse(String(row.scheduled_time || ''));
    const willPostAgainAt =
      statusAfter !== 'PUBLISHED' && statusAfter !== 'FAILED' && Number.isFinite(t2) && t2 > Date.now()
        ? row.scheduled_time
        : null;

    return NextResponse.json({
      processedCount: 1,
      results: [
        {
          postId: row.id,
          platform: row.platform,
          status: out.status,
          outcome: out.status,
          reason: out.reason,
          externalUrl: out.externalUrl || null, // null when nothing was published
          statusAfter,
        },
      ],
      published: publiclyPosted,
      manual: {
        keepScheduled,
        publiclyPosted,
        accepted,
        manualExternalUrl: accepted ? out.externalUrl || null : null,
        manualPublishedAt: accepted ? new Date().toISOString() : null,
        statusAfter,
        willPostAgainAt,
      },
      note: publiclyPosted
        ? keepScheduled
          ? `Posted to ${row.platform} now. It stays queued and will post AGAIN at its scheduled time (${row.scheduled_time}).`
          : `Posted to ${row.platform} now and taken out of the schedule.`
        : accepted
        ? `The platform created the post but did not publish it publicly (${out.reason}). It keeps its status and the scheduler will try again at ${row.scheduled_time}.`
        : `Nothing was posted to ${row.platform}: ${out.reason}`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
