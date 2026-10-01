import { NextRequest, NextResponse } from 'next/server';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import { complete, resolveKey } from '@/lib/ai';
import { specFor } from '@/lib/platformSpecs';

/**
 * Add ONE extra post to a particular day of a calendar.
 *
 * The id is minted the same way generation mints them (post_<calendarId>_<dayIndex>_<platform>),
 * with a suffix when that day already has a post on the platform, so the studio, the editor and the
 * scheduler all address the row by an id the server actually stored.
 *
 * A day that is not part of the batch yet is created in days_json, so an added post always has a
 * real date and shows up in the calendar view.
 */
const SLOTS: Record<string, number> = { TWITTER: 14, LINKEDIN: 15, INSTAGRAM: 18 };
const PLATFORMS = ['TWITTER', 'LINKEDIN', 'INSTAGRAM'];

export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await initPostgresTables();
    const body = await req.json().catch(() => ({}));

    const platform = String(body.platform || '').toUpperCase();
    if (!PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: `platform must be one of ${PLATFORMS.join(', ')}` }, { status: 400 });
    }

    const cal = body.calendarId
      ? await pool.query(
          'SELECT id, days_json, niche, audience, tone FROM content_calendars WHERE id = $1 AND user_id = $2',
          [String(body.calendarId), userId]
        )
      : await pool.query(
          'SELECT id, days_json, niche, audience, tone FROM content_calendars WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1',
          [userId]
        );
    if (cal.rows.length === 0) {
      // Same answer whether the calendar belongs to someone else or does not exist: no existence leak.
      return NextResponse.json(
        { error: body.calendarId ? 'No such calendar for this account.' : 'No content calendar yet - generate one first.' },
        { status: 404 }
      );
    }
    const calendar = cal.rows[0];
    const snapshot: any[] = Array.isArray(calendar.days_json) ? calendar.days_json : [];

    // Which day? By index if given, otherwise by date - and a new date becomes a new day.
    let dayIndex: number | null = body.dayIndex !== undefined && body.dayIndex !== null ? Number(body.dayIndex) : null;
    let day: any = dayIndex !== null ? snapshot.find((d) => Number(d.dayIndex) === dayIndex) : undefined;

    let dateStr = String(body.date || '').trim();
    if (!day && dayIndex !== null) {
      const named = snapshot.find((d) => String(d.date) === dateStr);
      if (named) day = named;
    }
    if (!day && dateStr) {
      day = snapshot.find((d) => String(d.date) === dateStr);
      if (day) dayIndex = Number(day.dayIndex);
      else if (dayIndex === null) {
        dayIndex = snapshot.reduce((m, d) => Math.max(m, Number(d.dayIndex) || 0), 0) + 1;
      }
    }
    if (dayIndex === null || !Number.isFinite(dayIndex)) {
      return NextResponse.json({ error: 'Send dayIndex or date (YYYY-MM-DD).' }, { status: 400 });
    }
    if (!dateStr) dateStr = String(day?.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      return NextResponse.json({ error: 'A date is required as YYYY-MM-DD when the day has none yet.' }, { status: 400 });
    }

    // Scheduled time: explicit, else the platform's slot on that date.
    let scheduledTime = body.scheduledTime ? String(body.scheduledTime) : '';
    if (scheduledTime && !Number.isFinite(Date.parse(scheduledTime))) {
      return NextResponse.json({ error: 'scheduledTime is not a date' }, { status: 400 });
    }
    const slotHour = SLOTS[platform] ?? 14;
    if (!scheduledTime) {
      scheduledTime = new Date(`${dateStr}T${String(slotHour).padStart(2, '0')}:00:00Z`).toISOString();
    }

    // Copy: explicit, or generated for this platform.
    let content = typeof body.content === 'string' ? body.content : '';
    let generated = false;
    let generationNote: string | null = null;
    if (!content && body.generateContent !== false) {
      const resolved = resolveKey(String(body.provider || '').toLowerCase(), body.apiKey);
      if (!resolved) {
        generationNote = 'no model key available (no BYOK key sent and the server has none)';
      } else {
        const spec = specFor(platform);
        const theme = String(body.theme || day?.theme || '');
        const prompt =
          `Write ONE social media post for ${platform}.\n` +
          `Brand niche: ${calendar.niche || 'unspecified'}\n` +
          `Audience: ${calendar.audience || 'unspecified'}\n` +
          `Tone: ${calendar.tone || 'professional'}\n` +
          (theme ? `Angle for the day: ${theme}\n` : '') +
          `Rules: at most ${spec.maxChars} characters, ${spec.hashtags} hashtags at the end, ` +
          `voice: ${spec.tone}. Structure: ${spec.structure}. ` +
          `no emoji spam, no markdown, no surrounding quotes. Return only the post text.`;
        const out = await complete(resolved.provider, resolved.key, prompt, 700);
        if (out.ok) {
          content = out.text.trim().slice(0, spec.maxChars);
          generated = true;
        } else {
          generationNote = out.reason;
        }
      }
    }

    // Mint an id generation would recognise, uniquified against what is already stored.
    const baseId = `post_${calendar.id}_${dayIndex}_${platform.toLowerCase()}`;
    let id = baseId;
    let n = 1;
    while ((await pool.query('SELECT 1 FROM posts WHERE id = $1', [id])).rows.length > 0) {
      n += 1;
      id = `${baseId}_x${n}`;
      if (n > 50) return NextResponse.json({ error: 'could not mint a unique post id' }, { status: 500 });
    }

    await pool.query(
      `INSERT INTO posts (id, calendar_id, user_id, day_index, platform, content, media_url, scheduled_time, status, tagged_users)
       VALUES ($1, $2, $3, $4, $5, $6, NULL, $7, 'PENDING_APPROVAL', '[]'::jsonb)`,
      [id, calendar.id, userId, dayIndex, platform, content || null, scheduledTime]
    );

    // A day outside the batch becomes a real day, so it has a date and shows in the calendar.
    if (!day) {
      const next = [
        ...snapshot,
        { dayIndex, date: dateStr, theme: String(body.theme || ''), posts: [] },
      ];
      await pool.query('UPDATE content_calendars SET days_json = $1::jsonb WHERE id = $2 AND user_id = $3', [
        JSON.stringify(next),
        calendar.id,
        userId,
      ]);
    }

    const dueImmediately = Date.parse(scheduledTime) <= Date.now();

    return NextResponse.json({
      post: {
        id,
        platform,
        content,
        mediaPrompt: null,
        mediaUrl: null,
        scheduledTime,
        status: 'PENDING_APPROVAL',
        taggedUsers: [],
      },
      calendarId: calendar.id,
      dayIndex,
      date: dateStr,
      generated,
      generationNote,
      dueImmediately,
      note:
        (generated ? 'Generated and saved' : content ? 'Saved' : 'Saved an empty post - write it in the editor') +
        `: ${platform} on ${dateStr} at ${String(slotHour).padStart(2, '0')}:00 UTC.` +
        (dueImmediately ? ' That time has already passed, so it counts as due right now.' : '') +
        (generationNote ? ` (no copy generated: ${generationNote})` : ''),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
