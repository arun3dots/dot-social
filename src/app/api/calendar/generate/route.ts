import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { niche = 'AI SaaS & Automation', audience = 'Solopreneurs', tone = 'Insightful', provider = 'gemini' } = body;
    const requestedProvider = String(provider || 'gemini').toLowerCase();

    // Resolve a provider key: BYOK from the body first, then the server's own .env.
    // Without this the route ignored .env entirely (apiKey came only from the request body),
    // so every call fell through to the deterministic template in tools/generate_calendar.py.
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
      // Fall back to whichever provider the server actually has a key for.
      for (const p of ['deepseek', 'gemini', 'openai']) {
        const k = envKeyFor(p);
        if (k) { apiKey = k; providerUsed = p; break; }
      }
    }

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

    child.stdout.on('data', (d) => {
      stdoutData += d.toString();
    });

    child.stderr.on('data', (d) => {
      stderrData += d.toString();
    });

    const exitCode = await new Promise<number>((resolve) => {
      child.on('close', resolve);
    });

    if (exitCode === 0 && fs.existsSync(outputPath)) {
      const fileData = fs.readFileSync(outputPath, 'utf-8');
      const calendar = JSON.parse(fileData);
      return NextResponse.json(calendar);
    }

    if (stdoutData) {
      try {
        const parsed = JSON.parse(stdoutData);
        return NextResponse.json(parsed);
      } catch (err) {
        // Fallback to reading default generated calendar
      }
    }

    return NextResponse.json(
      { error: 'Calendar generation failed', details: stderrData || stdoutData },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
