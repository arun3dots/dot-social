import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import { clampHorizon, daysForCadence } from '@/lib/cadence';

const MAX_HORIZON_DAYS = 7; // hard cap: never generate a month in one stretch

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { niche = 'AI SaaS & Automation', audience = 'Solopreneurs', tone = 'Insightful', provider = 'gemini' } = body;
    const requestedProvider = String(provider || 'gemini').toLowerCase();

    // Resolve a provider key: BYOK from the body first, then the server's own .env.
    const envKeyFor = (p: string): string => {
      const map: Record<string, string | undefined> = {
        gemini: process.env.GEMINI_API_KEY,
        openai: process.env.OPENAI_API_KEY,
        deepseek: process.env.DEEPSEEK_API_KEY,
      };
      return (map[p] || '').trim();
    };

    let apiKey: string = String(body.apiKey || '').trim();
    let providerUsed = requestedProvider;
    if (!apiKey) apiKey = envKeyFor(requestedProvider);
    if (!apiKey) {
      for (const p of ['deepseek', 'gemini', 'openai']) {
        const k = envKeyFor(p);
        if (k) { apiKey = k; providerUsed = p; break; }
      }
    }

    // Cadence guard: honour the user's saved cadence, then clamp to the 7-day maximum.
    const userIdForProfile = await currentUserId();
    let profileCadence: string | null = null;
    let profileNiche: string | null = null;
    let profilePillars: string[] = [];
    let profileGoals: string[] = [];
    let profileScreenName = '';
    let profilePersona = '';
    if (userIdForProfile) {
      try {
        await initPostgresTables();
        const pr = await pool.query(
          'SELECT cadence, niches, pillars, goals, screen_name, persona FROM users WHERE id = $1',
          [userIdForProfile]
        );
        profileCadence = pr.rows[0]?.cadence ?? null;
        profileNiche = (pr.rows[0]?.niches || [])[0] ?? null;
        profilePillars = pr.rows[0]?.pillars || [];
        profileGoals = pr.rows[0]?.goals || [];
        profileScreenName = pr.rows[0]?.screen_name || '';
        profilePersona = pr.rows[0]?.persona || '';
      } catch (e) {
        profileCadence = null;
      }
    }

    const requestedDays = body.days != null ? parseInt(String(body.days), 10) : daysForCadence(profileCadence);
    const horizonDays = clampHorizon(requestedDays);
    const effectiveNiche = niche || profileNiche || 'AI SaaS & Automation';

    // ---- image model: BYOK first, then the server's key ----
    // DeepSeek has no image endpoint, so content and image providers are resolved separately.
    let imageApiKey = String(body.imageApiKey || '').trim();
    let imageProvider = String(body.imageProvider || '').trim().toLowerCase();
    if (!imageApiKey && process.env.OPENAI_API_KEY) {
      imageApiKey = process.env.OPENAI_API_KEY.trim();
      imageProvider = 'openai';
    }
    if (!imageApiKey) imageProvider = '';

    const imageQuality = String(body.imageQuality || 'low');
    const requestedMaxImages = parseInt(String(body.maxImages ?? '6'), 10);
    const maxImages = Number.isFinite(requestedMaxImages) ? Math.max(0, Math.min(requestedMaxImages, 12)) : 6;

    // Server-assigned unique id: generation must never collide with an existing calendar.
    const genId = `cal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const rootDir = process.cwd();
    const scriptPath = path.join(rootDir, 'tools', 'generate_calendar.py');
    const outputPath = path.join(rootDir, '.tmp', `calendar_${Date.now()}.json`);

    const pythonArgs = [
      scriptPath,
      '--niche', effectiveNiche,
      '--audience', audience,
      '--tone', tone,
      '--provider', providerUsed,
      '--apiKey', apiKey,
      '--days', String(horizonDays),
      '--pillars', profilePillars.join('|'),
      '--goals', profileGoals.join('|'),
      '--screenName', profileScreenName,
      '--persona', profilePersona,
      '--imageProvider', imageProvider,
      '--imageApiKey', imageApiKey,
      '--imageQuality', imageQuality,
      '--maxImages', String(maxImages),
      '--calendarId', genId,
      '--output', outputPath,
    ];

    const child = spawn('python', pythonArgs);
    let stdoutData = '';
    let stderrData = '';
    child.stdout.on('data', (d) => { stdoutData += d.toString(); });
    child.stderr.on('data', (d) => { stderrData += d.toString(); });
    const exitCode = await new Promise<number>((resolve) => { child.on('close', resolve); });

    let calendar: any = null;
    if (exitCode === 0 && fs.existsSync(outputPath)) {
      calendar = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    } else if (stdoutData) {
      try { calendar = JSON.parse(stdoutData); } catch { calendar = null; }
    }

    if (!calendar) {
      return NextResponse.json(
        { error: 'Calendar generation failed', details: stderrData || stdoutData },
        { status: 500 }
      );
    }

    // ---- persist, keyed to the signed-in user ----
    const userId = await currentUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    await initPostgresTables();
    const calendarId = genId;
    calendar.generatorLabel = calendar.calendarId;
    calendar.calendarId = calendarId;

    const days: any[] = Array.isArray(calendar.days) ? calendar.days : [];
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO content_calendars (id, user_id, title, batch_status, niche, audience, tone, days_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO NOTHING`,
        [
          calendarId,
          userId,
          `${effectiveNiche} - ${days.length} day batch`,
          calendar.batchStatus || 'PENDING_APPROVAL',
          effectiveNiche,
          audience,
          tone,
          JSON.stringify(days),
        ]
      );

      for (const d of days) {
        for (const p of (d.posts || [])) {
          await client.query(
            `INSERT INTO posts (id, calendar_id, user_id, day_index, platform, content, media_prompt, media_url, scheduled_time, status)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
             ON CONFLICT (id) DO NOTHING`,
            [
              `post_${calendarId}_${d.dayIndex}_${String(p.platform).toLowerCase()}`,
              calendarId,
              userId,
              d.dayIndex ?? null,
              p.platform,
              p.content ?? null,
              p.mediaPrompt ?? null,
              p.mediaUrl ?? null,
              p.scheduledTime ?? null,
              p.status || 'PENDING_APPROVAL',
            ]
          );
        }
      }
      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    return NextResponse.json({
      ...calendar,
      calendarId,
      persisted: true,
      userId,
      horizonDays,
      providerUsed,
      imageProvider: imageProvider || null,
      imageSummary: calendar.imageSummary || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
