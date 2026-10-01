import { NextResponse } from 'next/server';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';

export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await initPostgresTables();
    const res = await pool.query(
      `SELECT id, title, batch_status, niche, audience, tone, days_json, created_at
       FROM content_calendars
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (res.rows.length === 0) {
      return NextResponse.json({ calendar: null });
    }

    const r = res.rows[0];
    const stats = await pool.query(
      `SELECT platform, status, COUNT(*)::int AS count
       FROM posts WHERE calendar_id = $1
       GROUP BY platform, status`,
      [r.id]
    );

    return NextResponse.json({
      calendar: {
        calendarId: r.id,
        batchStatus: r.batch_status,
        niche: r.niche,
        audience: r.audience,
        tone: r.tone,
        days: r.days_json,
        savedAt: r.created_at,
        title: r.title,
      },
      postStats: stats.rows,
      persisted: true,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
