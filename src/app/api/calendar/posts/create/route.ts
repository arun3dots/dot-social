import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import {
  complete,
  imagePromptRefinePrompt,
  parsePostJson,
  postPrompt,
  resolveKey,
  sanitiseImagePrompt,
} from '@/lib/ai';
import { specFor } from '@/lib/platformSpecs';

/**
 * Add post(s) to a particular day of a calendar - one per selected platform - optionally with an image.
 *
 * Copy: one model call per platform, told which other platforms are getting the same idea, so the
 * versions are genuinely different (a 280-character hook is not a LinkedIn argument).
 *
 * Image: the prompt can come from the user. A prompt typed by a person is treated as a BRIEF and is
 * fine-tuned into a production image prompt first (subject, setting, light, style, composition, and
 * "no text in the image"); with no brief, the image prompt the copy model wrote for that platform is
 * used. The image is then generated once and each platform gets its own exact feed size derived from
 * it - X 1600x900 (16:9), LinkedIn 1200x1200 (1:1), Instagram 1080x1350 (4:5). No platform shares
 * another's dimensions. With imagePerPlatform the model is called once per platform instead, in that
 * platform's own aspect, at the cost of one generation each.
 *
 * Ids are minted the way generation mints them (post_<calendarId>_<dayIndex>_<platform>), with an _xN
 * suffix when that day already has a post on the platform. A day outside the batch becomes a real day.
 */
const SLOTS: Record<string, number> = { TWITTER: 14, LINKEDIN: 15, INSTAGRAM: 18 };
const PLATFORMS = ['TWITTER', 'LINKEDIN', 'INSTAGRAM'];

function runGenerator(args: string[]): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn('python', args);
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => {
      out += d.toString();
    });
    child.stderr.on('data', (d) => {
      err += d.toString();
    });
    child.on('close', (code) => resolve({ code: code ?? 1, out, err }));
  });
}

/**
 * The public URL for a generated file: /api/media/generated/<calendarId>/<file>.
 *
 * Built from the calendar id and the file's own name, NOT by slicing the absolute path - the repo
 * itself lives under "Social-media/media", so the first "/media/" in the path is the wrong one.
 */
function mediaUrlFor(calendarId: string, filePath: string): string {
  const base = String(filePath).replace(/\\/g, '/').split('/').pop() || '';
  return base ? `/api/media/generated/${calendarId}/${base}` : '';
}

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

    const explicitTime = body.scheduledTime ? String(body.scheduledTime) : '';
    if (explicitTime && !Number.isFinite(Date.parse(explicitTime))) {
      return NextResponse.json({ error: 'scheduledTime is not a date' }, { status: 400 });
    }

    const explicitContent = typeof body.content === 'string' && body.content.trim() ? String(body.content) : '';
    const wantsGeneration = body.generateContent !== false;
    const key = wantsGeneration && !explicitContent ? resolveKey(String(body.provider || '').toLowerCase(), body.apiKey) : null;
    const theme = String(body.theme || day?.theme || '');

    // ---- 1. copy, one call per platform ----
    type Draft = { platform: string; content: string; imagePrompt: string | null; generated: boolean; note: string };
    const drafts: Draft[] = [];

    for (const platform of platforms) {
      const spec = specFor(platform);
      let content = explicitContent;
      let imagePrompt: string | null = null;
      let generated = false;
      let note = '';

      if (!content && wantsGeneration) {
        if (!key) {
          note = 'no model key available (no BYOK key sent and the server has none) - created blank';
        } else {
          const out = await complete(
            key.provider,
            key.key,
            postPrompt({
              platform,
              niche: calendar.niche,
              audience: calendar.audience,
              tone: calendar.tone,
              theme,
              siblings: platforms,
            }),
            1200
          );
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

      drafts.push({ platform, content, imagePrompt, generated, note });
    }

    // ---- 2. the image: one prompt, per-platform sizes ----
    const wantsImage = body.generateImage === true;
    const userImagePrompt = String(body.imagePrompt || '').trim();
    const perPlatformImages = body.imagePerPlatform === true;

    let imageReport: any = null;
    const mediaByPlatform = new Map<string, string>();
    let sharedPrompt = '';

    if (wantsImage) {
      const imageApiKey = String(body.imageApiKey || '').trim() || (process.env.OPENAI_API_KEY || '').trim();
      if (!imageApiKey) {
        imageReport = {
          ok: false,
          error: 'no image API key available (set OPENAI_API_KEY - DeepSeek cannot generate images)',
        };
      } else {
        const profileQuality = await pool.query('SELECT image_quality FROM users WHERE id = $1', [userId]);
        const requestedQuality = String(body.imageQuality || profileQuality.rows[0]?.image_quality || 'low').toLowerCase();
        const imageQuality = ['low', 'medium', 'high'].includes(requestedQuality) ? requestedQuality : 'low';

        // A brief from the user is fine-tuned into a production prompt; otherwise the prompt the copy
        // model wrote for this campaign is used, and we say which of the two happened.
        let promptSource = 'the image prompt written with the copy';
        let refined = false;
        let refineNote: string | null = null;

        if (userImagePrompt) {
          promptSource = 'fine-tuned from your brief';
          if (!key) {
            sharedPrompt = userImagePrompt;
            refineNote = 'no model key available to fine-tune it, so your words were used as written';
          } else {
            const fin = await complete(
              key.provider,
              key.key,
              imagePromptRefinePrompt({
                userPrompt: userImagePrompt,
                platforms,
                niche: calendar.niche,
                tone: calendar.tone,
                postText: drafts.map((d) => d.content).find(Boolean),
              }),
              500
            );
            if (fin.ok) {
              const cleaned = sanitiseImagePrompt(fin.text);
              if (cleaned) {
                sharedPrompt = cleaned;
                refined = true;
              } else refineNote = 'the model returned nothing usable, so your words were used as written';
            } else refineNote = `${fin.reason} - your words were used as written`;
          }
          if (!sharedPrompt) sharedPrompt = userImagePrompt;
        } else {
          sharedPrompt = (drafts.map((d) => d.imagePrompt).find(Boolean) as string) || '';
          if (!sharedPrompt) {
            sharedPrompt =
              `An editorial image for a post about ${calendar.niche || 'this brand'} for ${calendar.audience || 'its audience'}, ` +
              `clean modern style, natural light, no text or lettering in the image.`;
            promptSource = 'described from the calendar topic (no copy prompt was available)';
          }
        }

        const dir = path.join(process.cwd(), 'media', 'generated', String(calendar.id));
        fs.mkdirSync(dir, { recursive: true });
        const stamp = Date.now().toString(36);
        const prefix = `${calendar.id}_${dateStr}_img${stamp}`;
        const scriptPath = path.join(process.cwd(), 'tools', 'generate_calendar.py');

        const args = [
          scriptPath,
          '--campaignImage',
          '--campaignPrompt', sharedPrompt,
          '--campaignPlatforms', platforms.join(','),
          '--campaignOutDir', dir,
          '--campaignPrefix', prefix,
          '--imageQuality', imageQuality,
          '--imageApiKey', imageApiKey,
        ];
        if (perPlatformImages) args.push('--imagePerPlatform');

        const run = await runGenerator(args);
        let parsed: any = null;
        try {
          parsed = JSON.parse(run.out.trim().split('\n').pop() || '{}');
        } catch {
          parsed = null;
        }

        if (run.code !== 0 || !parsed?.ok) {
          imageReport = {
            ok: false,
            error: parsed?.error || run.err.slice(0, 300) || 'image generation failed',
            prompt: sharedPrompt,
            promptSource,
            promptRefined: refined,
          };
        } else {
          const files: any = {};
          for (const [platform, info] of Object.entries(parsed.outputs || {})) {
            const anyInfo = info as any;
            if (anyInfo?.error || !anyInfo?.path) {
              files[platform] = { error: anyInfo?.error || 'no file' };
              continue;
            }
            const url = mediaUrlFor(String(calendar.id), anyInfo.path);
            files[platform] = {
              url,
              fileName: path.basename(String(anyInfo.path).replace(/\\/g, '/')),
              width: anyInfo.width,
              height: anyInfo.height,
              bytes: anyInfo.bytes,
              ratio: anyInfo.ratio,
              upscaled: !!anyInfo.upscaled,
              from: anyInfo.from,
            };
            if (url) mediaByPlatform.set(platform, url);
          }
          imageReport = {
            ok: true,
            perPlatform: !!parsed.perPlatform,
            quality: imageQuality,
            prompt: sharedPrompt,
            promptSource,
            promptRefined: refined,
            yourPrompt: userImagePrompt || null,
            note: refineNote,
            master: parsed.master || null,
            files,
          };
        }
      }
    }

    // ---- 3. store ----
    const createdPosts: any[] = [];
    const results: any[] = [];

    for (const draft of drafts) {
      const platform = draft.platform;
      const spec = specFor(platform);
      const slotHour = SLOTS[platform] ?? 14;
      const scheduledTime = explicitTime || new Date(`${dateStr}T${String(slotHour).padStart(2, '0')}:00:00Z`).toISOString();

      const baseId = `post_${calendar.id}_${dayIndex}_${platform.toLowerCase()}`;
      let id = baseId;
      let n = 1;
      while ((await pool.query('SELECT 1 FROM posts WHERE id = $1', [id])).rows.length > 0) {
        n += 1;
        id = `${baseId}_x${n}`;
        if (n > 50) return NextResponse.json({ error: 'could not mint a unique post id' }, { status: 500 });
      }

      // Prefer the prompt written for THIS platform, so a later regeneration stays platform-specific.
      const storedPrompt = draft.imagePrompt || (wantsImage ? sharedPrompt : null);
      const mediaUrl = mediaByPlatform.get(platform) || null;

      await pool.query(
        `INSERT INTO posts (id, calendar_id, user_id, day_index, platform, content, media_prompt, media_url, scheduled_time, status, tagged_users)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_APPROVAL', '[]'::jsonb)`,
        [id, calendar.id, userId, dayIndex, platform, draft.content || null, storedPrompt, mediaUrl, scheduledTime]
      );

      const imageFile = imageReport?.ok ? imageReport.files?.[platform] : null;
      createdPosts.push({
        id,
        platform,
        content: draft.content,
        mediaPrompt: storedPrompt,
        mediaUrl,
        scheduledTime,
        status: 'PENDING_APPROVAL',
        taggedUsers: [],
      });
      results.push({
        platform,
        id,
        generated: draft.generated,
        chars: draft.content.length,
        imagePrompt: !!storedPrompt,
        image: imageFile && !imageFile.error ? `${imageFile.width}x${imageFile.height}` : null,
        imageError: imageFile?.error || null,
        slot: `${String(slotHour).padStart(2, '0')}:00 UTC`,
        note: draft.note || `generated ${draft.content.length} characters`,
      });
    }

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
      images: imageReport,
      calendarId: calendar.id,
      dayIndex,
      date: dateStr,
      generated: results.some((r) => r.generated),
      dueImmediately,
      note:
        `Created ${label} on ${dateStr}: ` +
        results
          .map((r) => `${r.platform} ${r.chars} chars${r.image ? ` + image ${r.image}` : ''} at ${r.slot} (${r.note})`)
          .join('; ') +
        '.' +
        (imageReport?.ok
          ? ` Image: ${imageReport.perPlatform ? 'one generation per platform' : 'generated once and cropped per platform'}, prompt ${imageReport.promptSource}.`
          : imageReport
          ? ` Image NOT generated: ${imageReport.error}`
          : '') +
        (dueImmediately ? ' That time has already passed, so the scheduler treats it as due.' : ''),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
