import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import { appendDbAuditLog } from '@/lib/postgres';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { post, isSandbox = true } = body;

    if (!post) {
      return NextResponse.json({ error: 'Post object is required' }, { status: 400 });
    }

    const rootDir = process.cwd();
    const scriptPath = path.join(rootDir, 'tools', 'scheduler_worker.py');

    const postPayload = JSON.stringify({
      ...post,
      isSandbox,
    });

    const child = spawn('python', [scriptPath, '--postJson', postPayload]);

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

    if (exitCode === 0 && stdoutData) {
      try {
        const parsed = JSON.parse(stdoutData);
        const result = parsed.results?.[0] || parsed;

        // Persist to PostgreSQL database audit log
        try {
          await appendDbAuditLog({
            userId: post.userId || 'usr_creator_01',
            platform: post.platform,
            postId: post.id,
            status: result.status || 'SUCCESS',
            isSandbox: result.isSandbox ?? isSandbox,
            payload: post,
            externalId: result.externalId,
            externalUrl: result.externalUrl,
          });
        } catch (dbErr) {
          console.error('Failed to log to PostgreSQL:', dbErr);
        }

        return NextResponse.json(parsed);
      } catch (e) {
        // fallback
      }
    }

    return NextResponse.json(
      { error: 'Publish failed', details: stderrData || stdoutData },
      { status: 500 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
