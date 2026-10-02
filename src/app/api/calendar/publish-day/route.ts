import { NextRequest, NextResponse } from 'next/server';
import pool, { appendDbAuditLog, initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import { publishPost } from '@/lib/publisher';

/**
 * Dispatch every post on one day (one per platform) in a single click.
 *
 * Mirrors /api/calendar/publish's status rules exactly: keepScheduled defaults to true so a manual
 * "publish all now" does NOT consume the schedule (each post still fires at its own time), and every
 * platform reports its own honest outcome - LinkedIn posts live, X/Instagram report their real state.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const userId = await currentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await initPostgresTables();

    const dayIndex = body.dayIndex !== undefined && body.dayIndex !== null ? Number(body.dayIndex) : null;
    if (!body.calendarId || dayIndex === null || !Number.isFinite(dayIndex)) {
      return NextResponse.json({ error: 'calendarId and dayIndex are required' }, { status: 400 });
    }

    const r = await pool.query(
      `SELECT id, user_id, platform, content, media_url, scheduled_time, status, tagged_users
       FROM posts WHERE calendar_id = $1 AND user_id = $2 AND day_index = $3
       ORDER BY scheduled_time ASC`,
      [String(body.calendarId), userId, dayIndex]
    );

    if (r.rows.length === 0) {
      return NextResponse.json({ error: 'No posts found for that day.' }, { status: 404 });
    }

    const keepScheduled = body.keepScheduled === undefined ? true : body.keepScheduled === true;
    const results: any[] = [];
    let published = 0;
    let failed = 0;
    let skipped = 0;

    for (const row of r.rows) {
      const out = await publishPost({
        userId,
        platform: row.platform,
        content: row.content,
        mediaUrl: row.media_url,
        taggedUsers: Array.isArray(row.tagged_users) ? row.tagged_users : null,
        explicit: true, // a human pressed "publish all" for this day
      });

      const accepted = !!(out.externalId || out.externalUrl);
      const publiclyPosted = out.status === 'PUBLISHED';
      let statusAfter: string = row.status;

      const t = Date.parse(String(row.scheduled_time || ''));
      const stillScheduled = Number.isFinite(t) && t > Date.now();

      if (accepted) {
        if (keepScheduled && stillScheduled) {
          statusAfter = 'APPROVED'; // still queued for its own scheduled time
        } else if (!keepScheduled) {
          statusAfter = publiclyPosted ? 'PUBLISHED' : row.status;
        } else {
          statusAfter = row.status;
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
          [statusAfter, publiclyPosted ? null : out.reason, row.id, setScheduledResult, out.externalId || null, out.externalUrl || null]
        );
      } else {
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

      if (out.status === 'PUBLISHED') published++;
      else if (out.status === 'FAILED') failed++;
      else skipped++;

      try {
        await appendDbAuditLog({
          userId,
          platform: row.platform,
          postId: row.id,
          status: out.status,
          isSandbox: out.mode === 'sandbox',
          payload: { reason: out.reason, manual: true, bulkDay: true, keepScheduled },
          externalId: out.externalId,
          externalUrl: out.externalUrl,
        });
      } catch (e) {
        console.error('audit log failed', e);
      }

      results.push({
        postId: row.id,
        platform: row.platform,
        status: out.status,
        reason: out.reason,
        externalUrl: out.externalUrl || null,
        statusAfter,
      });
    }

    const summary =
      published > 0
        ? `Posted to ${published} platform(s) now${failed ? `, ${failed} failed` : ''}${skipped ? `, ${skipped} skipped` : ''}.`
        : failed > 0
        ? `Nothing posted: ${failed} platform(s) failed, ${skipped} skipped.`
        : `Nothing posted: all ${skipped} platform(s) skipped.`;

    return NextResponse.json({
      processedCount: r.rows.length,
      published,
      failed,
      skipped,
      results,
      note: summary,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
