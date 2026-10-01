import { NextRequest, NextResponse } from 'next/server';
import pool, { initPostgresTables, appendDbAuditLog } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import { publishPost } from '@/lib/publisher';

export const dynamic = 'force-dynamic';

/**
 * The scheduler tick. Finds posts whose scheduled time has arrived and publishes them.
 *
 * Auth fails closed: either a valid SCHEDULER_SECRET header (for headless cron) or an
 * ADMIN/SUPER_ADMIN session. Nothing runs anonymously.
 */
async function authorize(req: NextRequest): Promise<{ ok: boolean; how: string }> {
  const secret = (process.env.SCHEDULER_SECRET || '').trim();
  const given = (req.headers.get('x-scheduler-secret') || '').trim();
  if (secret && given && given === secret) return { ok: true, how: 'secret' };

  const uid = await currentUserId();
  if (uid) {
    const r = await pool.query('SELECT role FROM users WHERE id = $1', [uid]);
    const role = r.rows[0]?.role;
    if (role === 'ADMIN' || role === 'SUPER_ADMIN') return { ok: true, how: 'session-admin' };
    return { ok: false, how: 'session-not-admin' };
  }
  return { ok: false, how: 'no-credentials' };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await authorize(req);
    if (!auth.ok) {
      return NextResponse.json(
        { error: 'Not authorized. Send x-scheduler-secret (SCHEDULER_SECRET) or use an admin session.', reason: auth.how },
        { status: 401 }
      );
    }

    await initPostgresTables();

    const dryRun = new URL(req.url).searchParams.get('dryRun') === '1';
    const now = Date.now();

    const cand = await pool.query(
      `SELECT id, user_id, platform, content, media_url, scheduled_time, status
       FROM posts WHERE status IN ('APPROVED', 'SCHEDULED')
       ORDER BY scheduled_time ASC LIMIT 200`
    );

    // Compare in JS: scheduled_time is stored as text and may carry offsets.
    const due = cand.rows.filter((r: any) => {
      const t = Date.parse(String(r.scheduled_time || ''));
      return Number.isFinite(t) && t <= now;
    });

    if (dryRun) {
      return NextResponse.json({
        dryRun: true,
        candidates: cand.rows.length,
        dueNow: due.length,
        due: due.map((r: any) => ({ id: r.id, platform: r.platform, scheduledTime: r.scheduled_time, status: r.status })),
      });
    }

    const results: any[] = [];
    for (const p of due as any[]) {
      const out = await publishPost({
        userId: p.user_id,
        platform: p.platform,
        content: p.content,
        mediaUrl: p.media_url,
      });

      // SKIPPED keeps its APPROVED/SCHEDULED status so a later tick retries once the
      // account is really connected. FAILED is recorded as FAILED. Only a platform
      // acceptance yields PUBLISHED.
      const statusAfter = out.status === 'PUBLISHED' ? 'PUBLISHED' : out.status === 'SKIPPED' ? p.status : 'FAILED';

      await pool.query(
        `UPDATE posts
            SET status = $1::varchar,
                publish_error = $2,
                publish_attempts = COALESCE(publish_attempts, 0) + 1,
                published_at = CASE WHEN $1::text = 'PUBLISHED' THEN NOW() ELSE published_at END,
                external_id = $3,
                external_url = $4
          WHERE id = $5`,
        [statusAfter, out.status === 'PUBLISHED' ? null : out.reason, out.externalId || null, out.externalUrl || null, p.id]
      );

      try {
        await appendDbAuditLog({
          userId: p.user_id,
          platform: p.platform,
          postId: p.id,
          status: out.status,
          isSandbox: out.mode === 'sandbox',
          payload: { reason: out.reason, scheduledTime: p.scheduled_time },
          externalId: out.externalId,
          externalUrl: out.externalUrl,
        });
      } catch (e) {
        console.error('audit log failed', e);
      }

      results.push({ postId: p.id, platform: p.platform, outcome: out.status, statusAfter, reason: out.reason });
    }

    return NextResponse.json({
      ranAt: new Date().toISOString(),
      authorizedBy: auth.how,
      candidates: cand.rows.length,
      due: due.length,
      published: results.filter((r) => r.outcome === 'PUBLISHED').length,
      failed: results.filter((r) => r.outcome === 'FAILED').length,
      skipped: results.filter((r) => r.outcome === 'SKIPPED').length,
      results,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
