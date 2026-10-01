import { NextRequest, NextResponse } from 'next/server';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';

const ALLOWED_STATUS = ['PENDING_APPROVAL', 'APPROVED', 'SCHEDULED', 'PUBLISHED', 'FAILED'];

/**
 * Persist review decisions. This is what the studio's Approve / batch-approve buttons and the
 * per-post editor write to.
 *
 * It exists because the UI previously kept approvals in React state only: the buttons toasted
 * "approved & queued for scheduled automated publishing" while the database still said
 * PENDING_APPROVAL, so the scheduler could never pick those posts up and a reload undid the review.
 *
 * PATCH  { postId, status?, content?, scheduledTime?, mediaUrl?, taggedUsers? }  -> one post
 * POST   { calendarId, status }                         -> every post in a calendar (batch approve)
 */
export async function PATCH(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const postId = String(body.postId || '');
    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 });

    await initPostgresTables();

    // Ownership check: the post must belong to the caller.
    const owned = await pool.query('SELECT id, status FROM posts WHERE id = $1 AND user_id = $2', [postId, userId]);
    if (owned.rows.length === 0) {
      return NextResponse.json({ error: 'Post not found for this user' }, { status: 404 });
    }

    const sets: string[] = [];
    const vals: any[] = [];
    if (body.status !== undefined) {
      const status = String(body.status).toUpperCase();
      if (!ALLOWED_STATUS.includes(status)) {
        return NextResponse.json({ error: `status must be one of ${ALLOWED_STATUS.join(', ')}` }, { status: 400 });
      }
      vals.push(status);
      sets.push(`status = $${vals.length}`);
    }
    if (body.content !== undefined) {
      vals.push(String(body.content));
      sets.push(`content = $${vals.length}`);
    }
    if (body.scheduledTime !== undefined) {
      vals.push(String(body.scheduledTime));
      sets.push(`scheduled_time = $${vals.length}`);
    }
    if (body.mediaUrl !== undefined) {
      vals.push(body.mediaUrl === null ? null : String(body.mediaUrl));
      sets.push(`media_url = $${vals.length}`);
    }
    if (body.taggedUsers !== undefined) {
      // Only real person URNs are kept: a tag that cannot be rendered is not worth storing.
      const incoming = Array.isArray(body.taggedUsers) ? body.taggedUsers : [];
      const clean = incoming
        .map((t: any) => ({
          name: String(t?.name || '').trim().slice(0, 80),
          urn: String(t?.urn || '').trim().slice(0, 120),
        }))
        .filter((t: any) => t.urn.startsWith('urn:li:person:'));
      vals.push(JSON.stringify(clean));
      sets.push(`tagged_users = $${vals.length}::jsonb`);
    }
    if (sets.length === 0) {
      return NextResponse.json({ error: 'nothing to update' }, { status: 400 });
    }

    vals.push(postId, userId);
    const updated = await pool.query(
      `UPDATE posts SET ${sets.join(', ')} WHERE id = $${vals.length - 1} AND user_id = $${vals.length}
       RETURNING id, status, content, scheduled_time, media_url, tagged_users`,
      vals
    );

    return NextResponse.json({ success: true, post: updated.rows[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const calendarId = String(body.calendarId || '');
    const status = String(body.status || 'APPROVED').toUpperCase();
    if (!calendarId) return NextResponse.json({ error: 'calendarId is required' }, { status: 400 });
    if (!ALLOWED_STATUS.includes(status)) {
      return NextResponse.json({ error: `status must be one of ${ALLOWED_STATUS.join(', ')}` }, { status: 400 });
    }

    await initPostgresTables();

    const owned = await pool.query('SELECT id FROM content_calendars WHERE id = $1 AND user_id = $2', [calendarId, userId]);
    if (owned.rows.length === 0) {
      return NextResponse.json({ error: 'Calendar not found for this user' }, { status: 404 });
    }

    // Only posts that are still awaiting review are promoted, so an already-published post is
    // never dragged back to APPROVED.
    const updated = await pool.query(
      `UPDATE posts SET status = $1
        WHERE calendar_id = $2 AND user_id = $3 AND status IN ('PENDING_APPROVAL', 'FAILED')
       RETURNING id`,
      [status, calendarId, userId]
    );

    await pool.query('UPDATE content_calendars SET batch_status = $1 WHERE id = $2', [status, calendarId]);

    const counts = await pool.query(
      `SELECT status, COUNT(*)::int AS count FROM posts WHERE calendar_id = $1 GROUP BY status`,
      [calendarId]
    );

    return NextResponse.json({
      success: true,
      calendarId,
      status,
      updatedPosts: updated.rowCount,
      counts: counts.rows,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE ?postId=... - remove a post that has not been published.
 *
 * A PUBLISHED row is refused on purpose: deleting it would not remove anything from LinkedIn, and
 * the row is the only record we have of what went out.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await initPostgresTables();
    const postId = new URL(req.url).searchParams.get('postId') || '';
    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 });

    const owned = await pool.query('SELECT id, status FROM posts WHERE id = $1 AND user_id = $2', [postId, userId]);
    if (owned.rows.length === 0) {
      return NextResponse.json({ error: 'Post not found for this user' }, { status: 404 });
    }
    if (owned.rows[0].status === 'PUBLISHED') {
      return NextResponse.json(
        {
          error:
            'This post is marked PUBLISHED. Deleting the row would not remove it from the platform, so it is kept as the record that it went out.',
        },
        { status: 409 }
      );
    }

    await pool.query('DELETE FROM posts WHERE id = $1 AND user_id = $2', [postId, userId]);
    return NextResponse.json({ deleted: true, postId });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
