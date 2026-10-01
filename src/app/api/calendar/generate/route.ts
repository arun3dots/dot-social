import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';

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

    // Cadence guard: clamp any requested horizon to the 7-day maximum.
    const requestedDays = parseInt(String(body.days ?? 3), 10);
    const horizonDays = Math.min(Math.max(Number.isFinite(requestedDays) ? requestedDays : 3, 1), MAX_HORIZON_DAYS);

    const rootDir = process.cwd();
    const scriptPath = path.join(rootDir, 'tools', 'generate_calendar.py');
    const outputPath = path.join(rootDir, '.tmp', `calendar_${Date.now()}.json`);

    const pythonArgs = [
      scriptPath,
      '--niche', niche,
      '--audience', audience,
      '--tone', tone,
      '--provider', providerUsed,
      '--apiKey', apiKey,
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
    const calendarId = calendar.calendarId || `cal_${Date.now()}`;
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
          `${niche} - ${days.length} day batch`,
          calendar.batchStatus || 'PENDING_APPROVAL',
          niche,
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
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
