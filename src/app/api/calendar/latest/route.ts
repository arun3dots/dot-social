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

    // The posts table is the source of truth for anything that changes after generation
    // (status, edits, scheduled time, publish results). days_json is only the generation-time
    // snapshot and goes stale the moment someone approves or edits a post - serving it directly
    // made an approval look lost after a reload. So overlay every post from its row.
    const rows = await pool.query(
      `SELECT id, day_index, platform, content, media_prompt, media_url, reference_urls, scheduled_time, status,
              external_url, published_at, tagged_users, manual_published_at, manual_external_url, s3_key, s3_url
         FROM posts WHERE calendar_id = $1
        ORDER BY day_index ASC, platform ASC`,
      [r.id]
    );

    const byDay = new Map<number, any[]>();
    for (const row of rows.rows) {
      const day = Number(row.day_index ?? 1);
      if (!byDay.has(day)) byDay.set(day, []);
      byDay.get(day)!.push({
        id: row.id,
        platform: row.platform,
        content: row.content,
        mediaPrompt: row.media_prompt,
        referenceUrls: Array.isArray(row.reference_urls) ? row.reference_urls : [],
        mediaUrl: row.media_url,
        scheduledTime: row.scheduled_time,
        status: row.status,
        externalUrl: row.external_url || undefined,
        publishedAt: row.published_at || undefined,
        taggedUsers: Array.isArray(row.tagged_users) ? row.tagged_users : [],
        manualExternalUrl: row.manual_external_url || undefined,
        manualPublishedAt: row.manual_published_at || undefined,
        s3Key: row.s3_key || null,
        s3Url: row.s3_url || null,
      });
    }

    const snapshot: any[] = Array.isArray(r.days_json) ? r.days_json : [];
    const days: any[] = snapshot.map((d: any) => ({
      ...d,
      posts: byDay.get(Number(d.dayIndex)) || d.posts || [],
    }));
    // forEach rather than iterating the Map iterator: the project's TS target rejects the latter.
    byDay.forEach((posts, day) => {
      if (!days.some((d) => Number(d.dayIndex) === day)) {
        days.push({ dayIndex: day, date: '', theme: '', posts });
      }
    });
    days.sort((a, b) => Number(a.dayIndex) - Number(b.dayIndex));

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
        days,
        savedAt: r.created_at,
        title: r.title,
      },
      postStats: stats.rows,
      persisted: true,
      source: 'posts-table overlay on the generation snapshot',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
