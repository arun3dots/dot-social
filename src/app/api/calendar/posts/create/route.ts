import { NextRequest, NextResponse } from 'next/server';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import { complete, resolveKey, postPrompt, parsePostJson } from '@/lib/ai';
import { specFor } from '@/lib/platformSpecs';

/**
 * Add post(s) to a particular day of a calendar - one per selected platform.
 *
 * Each platform gets its own generation call and its own copy: a 280-character X hook is not the same
 * writing as a LinkedIn argument, so the model is told which other platforms are getting the idea and
 * must write the version that only works on this one. It also returns an image prompt per platform,
 * stored as media_prompt so the editor's "Regenerate image" has something real to work from.
 *
 * Ids are minted the way generation mints them (post_<calendarId>_<dayIndex>_<platform>), with an _xN
 * suffix when that day already has a post on the platform. A day outside the batch becomes a real day
 * in days_json, so an added post always has a date.
 */
const SLOTS: Record<string, number> = { TWITTER: 14, LINKEDIN: 15, INSTAGRAM: 18 };
const PLATFORMS = ['TWITTER', 'LINKEDIN', 'INSTAGRAM'];

export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await initPostgresTables();
    const body = await req.json().catch(() => ({}));

    // One platform or several, in the order given, de-duplicated.
    const requested: any[] = Array.isArray(body.platforms) ? body.platforms : body.platform ? [body.platform] : [];
    const platforms: string[] = [];
    for (const raw of requested) {
      const p = String(raw || '').toUpperCase();
      if (!PLATFORMS.includes(p)) {
        return NextResponse.json({ error: `platform must be one of ${PLATFORMS.join(', ')} (got "${raw}")` }, { status: 400 });
      }
      if (!platforms.includes(p)) platforms.push(p);
    }
    if (platforms.length === 0) {
      return NextResponse.json({ error: 'Pick at least one platform.' }, { status: 400 });
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

    // An explicit time applies to every post; otherwise each platform keeps its own slot.
    const explicitTime = body.scheduledTime ? String(body.scheduledTime) : '';
    if (explicitTime && !Number.isFinite(Date.parse(explicitTime))) {
      return NextResponse.json({ error: 'scheduledTime is not a date' }, { status: 400 });
    }

    // Copy written by the user is used verbatim on every selected platform; nothing is invented over it.
    const explicitContent = typeof body.content === 'string' && body.content.trim() ? String(body.content) : '';
    const wantsGeneration = body.generateContent !== false;
    const resolved = wantsGeneration && !explicitContent ? resolveKey(String(body.provider || '').toLowerCase(), body.apiKey) : null;
    const theme = String(body.theme || day?.theme || '');

    const createdPosts: any[] = [];
    const results: any[] = [];

    for (const platform of platforms) {
      const spec = specFor(platform);
      const slotHour = SLOTS[platform] ?? 14;
      const scheduledTime = explicitTime || new Date(`${dateStr}T${String(slotHour).padStart(2, '0')}:00:00Z`).toISOString();

      let content = explicitContent;
      let imagePrompt: string | null = null;
      let generated = false;
      let note = '';

      if (!content && wantsGeneration) {
        if (!resolved) {
          note = 'no model key available (no BYOK key sent and the server has none) - created blank';
        } else {
          const prompt = postPrompt({
            platform,
            niche: calendar.niche,
            audience: calendar.audience,
            tone: calendar.tone,
            theme,
            siblings: platforms,
          });
          const out = await complete(resolved.provider, resolved.key, prompt, 1200);
          if (out.ok) {
            const parsed = parsePostJson(out.text);
            content = (parsed.content || '').trim().slice(0, spec.maxChars);
            imagePrompt = parsed.imagePrompt;
            generated = !!content;
            if (!generated) note = 'the model returned no copy - created blank';
          } else {
            note = `${out.reason} - created blank`;
          }
        }
      } else if (explicitContent) {
        note = platforms.length > 1 ? 'your copy, used as-is on every selected platform' : 'your copy';
      } else {
        note = 'created blank - write it in the editor';
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
        `INSERT INTO posts (id, calendar_id, user_id, day_index, platform, content, media_prompt, media_url, scheduled_time, status, tagged_users)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, 'PENDING_APPROVAL', '[]'::jsonb)`,
        [id, calendar.id, userId, dayIndex, platform, content || null, imagePrompt, scheduledTime]
      );

      const post = {
        id,
        platform,
        content,
        mediaPrompt: imagePrompt,
        mediaUrl: null,
        scheduledTime,
        status: 'PENDING_APPROVAL',
        taggedUsers: [],
      };
      createdPosts.push(post);
      results.push({
        platform,
        id,
        generated,
        chars: content.length,
        imagePrompt: !!imagePrompt,
        slot: `${String(slotHour).padStart(2, '0')}:00 UTC`,
        note: note || `generated ${content.length} characters`,
      });
    }

    // A day outside the batch becomes a real day, so it has a date and shows in the calendar.
    if (!day) {
      const next = [...snapshot, { dayIndex, date: dateStr, theme, posts: [] }];
      await pool.query('UPDATE content_calendars SET days_json = $1::jsonb WHERE id = $2 AND user_id = $3', [
        JSON.stringify(next),
        calendar.id,
        userId,
      ]);
    }

    const dueImmediately = createdPosts.some((p) => Date.parse(p.scheduledTime) <= Date.now());
    const label = createdPosts.length === 1 ? '1 post' : `${createdPosts.length} posts`;

    return NextResponse.json({
      posts: createdPosts,
      post: createdPosts[0], // single-platform callers keep working
      results,
      calendarId: calendar.id,
      dayIndex,
      date: dateStr,
      generated: results.some((r) => r.generated),
      dueImmediately,
      note:
        `Created ${label} on ${dateStr}: ` +
        results.map((r) => `${r.platform} ${r.chars} chars at ${r.slot} (${r.note})`).join('; ') +
        '.' +
        (dueImmediately ? ' That time has already passed, so the scheduler treats it as due.' : '') +
        (results.some((r) => !r.generated && r.chars === 0) ? ' Blank posts are yours to write in the editor.' : ''),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
