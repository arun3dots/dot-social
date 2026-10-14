import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import { clampHorizon, daysForCadence } from '@/lib/cadence';
import { localWallTimeToUtc, userTimezone } from '@/lib/schedule';
import { uploadLocalFileToS3 } from '@/lib/s3';

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
    let profileImageQuality = 'low';
    if (userIdForProfile) {
      try {
        await initPostgresTables();
        const pr = await pool.query(
          'SELECT cadence, niches, pillars, goals, screen_name, persona, image_quality FROM users WHERE id = $1',
          [userIdForProfile]
        );
        profileCadence = pr.rows[0]?.cadence ?? null;
        profileNiche = (pr.rows[0]?.niches || [])[0] ?? null;
        profilePillars = pr.rows[0]?.pillars || [];
        profileGoals = pr.rows[0]?.goals || [];
        profileScreenName = pr.rows[0]?.screen_name || '';
        profilePersona = pr.rows[0]?.persona || '';
        profileImageQuality = pr.rows[0]?.image_quality || 'low';
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

    const requestedQuality = String(body.imageQuality || profileImageQuality || 'low').toLowerCase();
    const imageQuality = ['low', 'medium', 'high'].includes(requestedQuality) ? requestedQuality : 'low';
    const requestedMaxImages = parseInt(String(body.maxImages ?? '6'), 10);
    const maxImages = Number.isFinite(requestedMaxImages) ? Math.max(0, Math.min(requestedMaxImages, 12)) : 6;

    // Server-assigned unique id: generation must never collide with an existing calendar.
    const genId = `cal_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;

    const rootDir = process.cwd();
    const scriptPath = path.join(rootDir, 'tools', 'generate_calendar.py');
    const tempDir = process.env.VERCEL ? '/tmp' : path.join(rootDir, '.tmp');
    try {
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    } catch {}
    const outputPath = path.join(tempDir, `calendar_${Date.now()}.json`);

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

    let stdoutData = '';
    let stderrData = '';
    let exitCode = 1;

    try {
      const child = spawn('python', pythonArgs);
      child.stdout?.on('data', (d) => { stdoutData += d.toString(); });
      child.stderr?.on('data', (d) => { stderrData += d.toString(); });
      exitCode = await new Promise<number>((resolve) => {
        child.on('error', (err) => {
          stderrData += ` Python spawn: ${err.message}`;
          resolve(1);
        });
        child.on('close', (code) => resolve(code ?? 1));
      });
    } catch (spawnErr: any) {
      stderrData += ` Spawn error: ${spawnErr.message}`;
      exitCode = 1;
    }

    let calendar: any = null;
    if (exitCode === 0 && fs.existsSync(outputPath)) {
      try {
        calendar = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      } catch {
        calendar = null;
      }
    } else if (stdoutData) {
      try { calendar = JSON.parse(stdoutData); } catch { calendar = null; }
    }

    if (!calendar) {
      // Fallback: structured generation for serverless runtimes without Python
      calendar = {
        calendarId: genId,
        niche: effectiveNiche,
        audience,
        tone,
        batchStatus: 'PENDING_APPROVAL',
        days: [
          {
            dayIndex: 1,
            theme: `${effectiveNiche}: Core Strategy & Vision`,
            posts: [
              {
                id: `p1_tw`,
                platform: 'TWITTER',
                content: `Most people in ${effectiveNiche} focus on the outcome. The real lever is mastering the inputs.\n\n3 principles we live by for ${audience}:\n1. Consistency > Intensity\n2. Solve one sharp problem\n3. Protect focus`,
                mediaPrompt: `Minimalist editorial workspace illustrating strategic focus in ${effectiveNiche}`,
                mediaUrl: null,
                status: 'PENDING_APPROVAL',
              },
              {
                id: `p1_li`,
                platform: 'LINKEDIN',
                content: `Building sustainable impact in ${effectiveNiche} requires clarity over complexity.\n\nToo often, ${audience} teams over-engineer processes before validating core value.\n\nHere are 3 frameworks that keep us grounded:\n• Rapid feedback loops\n• Transparent execution\n• Long-term compound value\n\nWhat is your team prioritizing this quarter?`,
                mediaPrompt: `Clean modern conceptual artwork of strategic growth in ${effectiveNiche}`,
                mediaUrl: null,
                status: 'PENDING_APPROVAL',
              },
              {
                id: `p1_ig`,
                platform: 'INSTAGRAM',
                content: `The mindset shift that changed everything in ${effectiveNiche} 💡\n\nStop overcomplicating your playbook. Deliver real value, iterate daily, and build authentic connections with ${audience}.\n\nSave this for your next planning session! 🚀`,
                mediaPrompt: `Vibrant aesthetic modern design card for ${effectiveNiche}`,
                mediaUrl: null,
                status: 'PENDING_APPROVAL',
              },
            ],
          },
          {
            dayIndex: 2,
            theme: `${effectiveNiche}: Actionable Execution`,
            posts: [
              {
                id: `p2_tw`,
                platform: 'TWITTER',
                content: `Actionable insight for ${audience}:\n\nStop waiting for perfect conditions. Test small hypotheses, evaluate real metrics, and refine.\n\nDaily compounding beats sporadic bursts every time.`,
                mediaPrompt: `Geometric infographic showing progression curve in ${effectiveNiche}`,
                mediaUrl: null,
                status: 'PENDING_APPROVAL',
              },
              {
                id: `p2_li`,
                platform: 'LINKEDIN',
                content: `The difference between theory and execution in ${effectiveNiche}:\n\nTheory discusses what might work. Execution measures what actually delivers value for ${audience}.\n\nWhen you build structured feedback loops into your process, you reduce friction and accelerate growth.\n\nWhat is your biggest execution win so far this quarter?`,
                mediaPrompt: `Professional presentation slide summarizing execution roadmap in ${effectiveNiche}`,
                mediaUrl: null,
                status: 'PENDING_APPROVAL',
              },
              {
                id: `p2_ig`,
                platform: 'INSTAGRAM',
                content: `Execution framework for ${effectiveNiche} 📊\n\n✨ Define the target outcome\n🛠️ Streamline the process\n📈 Track the impact\n\nDouble tap if this resonates with your journey! 👇`,
                mediaPrompt: `Modern carousel cover slide with sleek typography for ${effectiveNiche}`,
                mediaUrl: null,
                status: 'PENDING_APPROVAL',
              },
            ],
          },
          {
            dayIndex: 3,
            theme: `${effectiveNiche}: Scaling & Community`,
            posts: [
              {
                id: `p3_tw`,
                platform: 'TWITTER',
                content: `Scalability in ${effectiveNiche} isn't about doing more things.\n\nIt's about removing friction and doing high-impact actions with relentless quality.`,
                mediaPrompt: `High-contrast infographic showing scalable growth loops in ${effectiveNiche}`,
                mediaUrl: null,
                status: 'PENDING_APPROVAL',
              },
              {
                id: `p3_li`,
                platform: 'LINKEDIN',
                content: `Reflecting on sustainable growth in ${effectiveNiche}:\n\nAs our industry evolves, the creators and teams who stand out are those who pair authenticity with disciplined systems.\n\nFor ${audience}, that means delivering genuine value at every touchpoint.\n\nWhat is your key priority for the coming month?`,
                mediaPrompt: `Clean modern conceptual artwork of future growth in ${effectiveNiche}`,
                mediaUrl: null,
                status: 'PENDING_APPROVAL',
              },
              {
                id: `p3_ig`,
                platform: 'INSTAGRAM',
                content: `Growth mindset in ${effectiveNiche} 💡\n\nRemember: Quality > Quantity, every single time.\n\nBuild for long-term trust, and the results will compound.\n\nShare this with someone who needs motivation today! 🚀`,
                mediaPrompt: `Warm aesthetic visual quote card on personal growth in ${effectiveNiche}`,
                mediaUrl: null,
                status: 'PENDING_APPROVAL',
              },
            ],
          },
        ],
      };
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

    // Dates and times are the server's decision, not the model's. The model has produced days in
    // April 2025 for a calendar generated in October 2026, which made every post instantly overdue.
    // Day 1 starts tomorrow, consecutive days follow, and every platform keeps its own slot.
    // Slots are LOCAL wall-clock hours in the user's timezone, converted to UTC for storage.
    const SLOT_HOUR: Record<string, number> = { TWITTER: 14, LINKEDIN: 15, INSTAGRAM: 18 };
    const tz = await userTimezone(userId);
    days.sort((a: any, b: any) => Number(a?.dayIndex ?? 0) - Number(b?.dayIndex ?? 0));
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const baseUtc = Date.UTC(tomorrow.getUTCFullYear(), tomorrow.getUTCMonth(), tomorrow.getUTCDate());
    days.forEach((d: any, i: number) => {
      d.dayIndex = i + 1;
      const dayDate = new Date(baseUtc + i * 24 * 60 * 60 * 1000);
      d.date = dayDate.toISOString().slice(0, 10);
      for (const p of (d.posts || [])) {
        const h = SLOT_HOUR[String(p.platform)] ?? 14;
        p.scheduledTime = localWallTimeToUtc(dayDate.toISOString().slice(0, 10), h, 0, tz);
      }
    });

    // The model invents post ids ("p1_tw"). Give every post the SAME id it will have in the
    // database, so the studio can approve/dispatch a post by the id the server stored - without
    // this, an approval sent from the UI matches no row.
    for (const d of days) {
      for (const p of (d.posts || [])) {
        p.id = `post_${calendarId}_${d.dayIndex}_${String(p.platform).toLowerCase()}`;
      }
    }

    // ---- S3 Cloud Storage Integration ----
    // Upload all generated images to S3 bucket grouped by userId: <userId>/<calendarId>/<fileName>
    for (const d of days) {
      for (const p of (d.posts || [])) {
        if (p.mediaUrl && typeof p.mediaUrl === 'string' && p.mediaUrl.startsWith('/api/media/generated/')) {
          const parts = p.mediaUrl.split('/');
          const fileName = parts[parts.length - 1];
          const localFilePath = path.join(process.cwd(), 'media', 'generated', calendarId, fileName);
          if (fs.existsSync(localFilePath)) {
            try {
              const uploadRes = await uploadLocalFileToS3({
                filePath: localFilePath,
                userId,
                calendarId,
                customFileName: fileName,
              });
              if (uploadRes) {
                p.s3Key = uploadRes.key;
                p.s3Url = uploadRes.url;
              }
            } catch (err: any) {
              console.error(`[S3 Upload Error] Failed to upload ${fileName} to S3:`, err.message);
            }
          }
        }
      }
    }

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
            `INSERT INTO posts (id, calendar_id, user_id, day_index, platform, content, media_prompt, media_url, scheduled_time, status, s3_key, s3_url)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
             ON CONFLICT (id) DO NOTHING`,
            [
              p.id,
              calendarId,
              userId,
              d.dayIndex ?? null,
              p.platform,
              p.content ?? null,
              p.mediaPrompt ?? null,
              p.mediaUrl ?? null,
              p.scheduledTime ?? null,
              p.status || 'PENDING_APPROVAL',
              p.s3Key ?? null,
              p.s3Url ?? null,
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
      imageQuality,
      imageSummary: calendar.imageSummary || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
