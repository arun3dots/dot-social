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
import { localWallTimeToUtc, timezoneLabel, userTimezone } from '@/lib/schedule';
import { uploadLocalFileToS3 } from '@/lib/s3';

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
    // The copy generation and the image-prompt fine-tune need the key for different reasons: asking for
    // no copy ("start blank") must NOT silently disable prompt refinement, so the two are resolved apart.
    const key = wantsGeneration && !explicitContent ? resolveKey(String(body.provider || '').toLowerCase(), body.apiKey) : null;
    const llmKey = resolveKey(String(body.provider || '').toLowerCase(), body.apiKey);
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
    // Generating separately per platform is the default for a multi-platform post: each platform's
    // image is composed for its own frame, so nothing has to be cut off or padded. The single-image
    // path stays available (body.imagePerPlatform === false) for anyone who wants to spend one
    // generation instead of three - it fits the same image into every frame, uncropped.
    const perPlatformImages = body.imagePerPlatform !== false;

    let imageReport: any = null;
    const mediaByPlatform = new Map<string, string>();
    const s3ByPlatform = new Map<string, { key: string; url: string }>();

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

        // One prompt per platform. With a separate generation per platform each prompt is fine-tuned
        // against that platform's OWN frame, so the model composes for it and nothing has to be fitted.
        const prompts = new Map<string, string>();
        let promptSource = 'the image prompt written with the copy';
        let refined = false;
        let refineNote: string | null = null;
        let describedFallback = false;

        if (userImagePrompt) {
          if (!llmKey) {
            // No model to fine-tune with: use the brief exactly as written, and say so.
            for (const platform of platforms) prompts.set(platform, userImagePrompt);
            refineNote = 'no model key available to fine-tune it, so your words were used as written';
          } else {
            for (const platform of platforms) {
              const fin = await complete(
                llmKey.provider,
                llmKey.key,
                imagePromptRefinePrompt({
                  userPrompt: userImagePrompt,
                  platforms: [platform],
                  niche: calendar.niche,
                  tone: calendar.tone,
                  postText: drafts.find((d) => d.platform === platform)?.content || drafts.map((d) => d.content).find(Boolean),
                }),
                500
              );
              const cleaned = fin.ok ? sanitiseImagePrompt(fin.text) : '';
              if (cleaned) {
                prompts.set(platform, cleaned);
                refined = true;
              } else {
                prompts.set(platform, userImagePrompt);
                refineNote = fin.ok
                  ? 'the model returned nothing usable, so your words were used as written'
                  : `${fin.reason} - your words were used as written`;
              }
            }
          }
        } else {
          for (const platform of platforms) {
            const fromCopy = drafts.find((d) => d.platform === platform)?.imagePrompt;
            if (fromCopy) prompts.set(platform, fromCopy);
          }
          for (const platform of platforms) {
            if (prompts.get(platform)) continue;
            const spec = specFor(platform);
            prompts.set(
              platform,
              `An editorial image for a ${spec.label} post about ${calendar.niche || 'this brand'} for ` +
                `${calendar.audience || 'its audience'}, composed for a ${spec.ratio} frame, clean modern style, ` +
                'natural light, no text or lettering in the image.'
            );
            describedFallback = true;
          }
        }

        // The source label must describe what really happened, not what was attempted: saying
        // "fine-tuned" while the model's words never made it in would be a false claim.
        if (userImagePrompt) {
          promptSource = refined
            ? perPlatformImages
              ? "fine-tuned from your brief, once per platform for that platform's own frame"
              : 'fine-tuned from your brief'
            : 'your brief, used as written';
        } else if (describedFallback) {
          promptSource = 'described from the calendar topic (no copy prompt was available)';
        }

        const firstPrompt = () => Array.from(prompts.values())[0] || '';
        const promptFor = (platform: string) => prompts.get(platform) || firstPrompt();

        const dir = path.join(process.cwd(), 'media', 'generated', String(calendar.id));
        fs.mkdirSync(dir, { recursive: true });
        const stamp = Date.now().toString(36);
        const scriptPath = path.join(process.cwd(), 'tools', 'generate_calendar.py');

        // One spawn per image decision: a single platform when generating separately, or the whole set
        // when fitting one image into every frame.
        const generate = async (plats: string[], prompt: string) => {
          const args = [
            scriptPath,
            '--campaignImage',
            '--campaignPrompt', prompt,
            '--campaignPlatforms', plats.join(','),
            '--campaignOutDir', dir,
            '--campaignPrefix', `${calendar.id}_${dateStr}_img${stamp}${plats.length === 1 ? `_${plats[0].toLowerCase()}` : ''}`,
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
          return { run, parsed };
        };

        const outputs: Record<string, any> = {};
        const failures: Record<string, string> = {};
        let master: any = null;
        let masterSize: string | null = null;

        if (perPlatformImages) {
          for (const platform of platforms) {
            const { run, parsed } = await generate([platform], promptFor(platform));
            if (!parsed?.ok) {
              failures[platform] = parsed?.error || run.err.slice(0, 200) || 'image generation failed';
              continue;
            }
            const produced = parsed.outputs?.[platform];
            if (!produced || produced.error) {
              failures[platform] = produced?.error || 'the generator returned no file for this platform';
              continue;
            }
            outputs[platform] = produced;
          }
        } else {
          const { run, parsed } = await generate(platforms, promptFor(platforms[0]));
          if (parsed?.ok) {
            master = parsed.master || null;
            masterSize = parsed.masterSize || parsed.master?.size || null;
            for (const platform of platforms) {
              const produced = parsed.outputs?.[platform];
              if (!produced || produced.error) {
                failures[platform] = produced?.error || 'the generator returned no file for this platform';
                continue;
              }
              outputs[platform] = produced;
            }
          } else {
            const reason = parsed?.error || run.err.slice(0, 300) || 'image generation failed';
            for (const platform of platforms) failures[platform] = reason;
          }
        }

        if (Object.keys(outputs).length === 0) {
          imageReport = {
            ok: false,
            error: Object.values(failures)[0] || 'image generation failed',
            failures,
            prompt: firstPrompt(),
            promptSource,
            promptRefined: refined,
          };
        } else {
          const files: any = {};
          for (const platform of platforms) {
            const info = outputs[platform];
            if (!info) {
              files[platform] = { error: failures[platform] || 'no file' };
              continue;
            }
            const url = mediaUrlFor(String(calendar.id), info.path);
            files[platform] = {
              url,
              fileName: path.basename(String(info.path).replace(/\\/g, '/')),
              width: info.width,
              height: info.height,
              bytes: info.bytes,
              ratio: info.ratio,
              upscaled: !!info.upscaled,
              from: info.from,
              // How the image reached the exact size, and the proof nothing was cut: mode "resize"
              // (the shapes matched), "fit-bleed" (the whole image inset, the gap filled with the same
              // image blurred) or "fit-solid". content is the box the picture occupies inside the frame.
              mode: info.mode,
              content: info.content,
              bandPx: info.bandPx,
              cropped: false,
            };
            if (url) mediaByPlatform.set(platform, url);
          }

          // Upload generated images to S3 grouped by userId
          for (const platform of platforms) {
            const info = outputs[platform];
            if (info?.path && fs.existsSync(info.path)) {
              try {
                const s3Res = await uploadLocalFileToS3({
                  filePath: info.path,
                  userId,
                  calendarId: String(calendar.id),
                  customFileName: path.basename(info.path),
                });
                if (s3Res) {
                  s3ByPlatform.set(platform, { key: s3Res.key, url: s3Res.url });
                }
              } catch (e: any) {
                console.error('[S3] Failed to upload to S3 in posts create:', e.message);
              }
            }
          }

          imageReport = {
            ok: true,
            perPlatform: perPlatformImages,
            noCrop: true,
            quality: imageQuality,
            prompt: promptFor(platforms[0]),
            promptsByPlatform: Object.fromEntries(Array.from(prompts.entries())),
            promptSource,
            promptRefined: refined,
            yourPrompt: userImagePrompt || null,
            note: refineNote,
            master,
            masterSize,
            files,
            failures: Object.keys(failures).length ? failures : undefined,
          };
        }
      }
    }

    // ---- 3. store ----
    const createdPosts: any[] = [];
    const results: any[] = [];

    // Slots are LOCAL wall-clock hours in the user's timezone, converted to UTC for storage.
    const tz = await userTimezone(userId);
    for (const draft of drafts) {
      const platform = draft.platform;
      const spec = specFor(platform);
      const slotHour = SLOTS[platform] ?? 14;
      const scheduledTime = explicitTime || localWallTimeToUtc(dateStr, slotHour, 0, tz);

      const baseId = `post_${calendar.id}_${dayIndex}_${platform.toLowerCase()}`;
      let id = baseId;
      let n = 1;
      while ((await pool.query('SELECT 1 FROM posts WHERE id = $1', [id])).rows.length > 0) {
        n += 1;
        id = `${baseId}_x${n}`;
        if (n > 50) return NextResponse.json({ error: 'could not mint a unique post id' }, { status: 500 });
      }

      // Prefer the prompt written for THIS platform, so a later regeneration stays platform-specific.
      const storedPrompt = draft.imagePrompt || (wantsImage ? String(imageReport?.promptsByPlatform?.[platform] || imageReport?.prompt || '') || null : null);
      const mediaUrl = (typeof body.mediaUrl === 'string' && body.mediaUrl.trim()) ? body.mediaUrl.trim() : (mediaByPlatform.get(platform) || null);
      const s3Info = s3ByPlatform.get(platform) || null;

      await pool.query(
        `INSERT INTO posts (id, calendar_id, user_id, day_index, platform, content, media_prompt, media_url, scheduled_time, status, tagged_users, s3_key, s3_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_APPROVAL', '[]'::jsonb, $10, $11)`,
        [id, calendar.id, userId, dayIndex, platform, draft.content || null, storedPrompt, mediaUrl, scheduledTime, s3Info?.key || null, s3Info?.url || null]
      );

      const imageFile = imageReport?.ok ? imageReport.files?.[platform] : null;
      createdPosts.push({
        id,
        platform,
        content: draft.content,
        mediaPrompt: storedPrompt,
        mediaUrl,
        s3Key: s3Info?.key || null,
        s3Url: s3Info?.url || null,
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
        image: imageFile && !imageFile.error ? `${imageFile.width}x${imageFile.height} ${imageFile.mode}${imageFile.bandPx ? ` (${imageFile.bandPx}px band)` : ''}` : null,
        imageError: imageFile?.error || null,
        slot: `${String(slotHour).padStart(2, '0')}:00 ${timezoneLabel(tz)}`,
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
          ? ` Image: ${imageReport.perPlatform ? 'one generation per platform, each composed for its own frame' : 'generated once and fitted into each platform\'s frame'}, nothing cropped, prompt ${imageReport.promptSource}.`
          : imageReport
          ? ` Image NOT generated: ${imageReport.error}`
          : '') +
        (dueImmediately ? ' That time has already passed, so the scheduler treats it as due.' : ''),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
