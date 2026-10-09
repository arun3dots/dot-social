import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';

const MEDIA_ROOT = path.join(process.cwd(), 'media');

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  // Generated media is user data and is only served to a signed-in user.
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const parts = params.path || [];
  // Only /generated/<calendarId>/<file> is servable, and only to the calendar's owner.
  // The id in the path was previously the only protection, which let any signed-in user read
  // any other tenant's generated images.
  if (parts[0] !== 'generated' || parts.length < 3) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const calendarId = parts[1];
  try {
    await initPostgresTables();
    const owner = await pool.query('SELECT user_id FROM content_calendars WHERE id = $1', [calendarId]);
    if (owner.rows.length === 0 || owner.rows[0].user_id !== userId) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const rel = parts.join('/');
  const resolved = path.resolve(MEDIA_ROOT, rel);
  // Path-traversal guard: the resolved file must stay inside the media root.
  if (!resolved.startsWith(path.resolve(MEDIA_ROOT) + path.sep)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
    // S3 Fallback: fetch from S3 grouped by userId if missing on local disk
    try {
      const fileName = parts.slice(2).join('/');
      const { buildUserS3Key, downloadS3ObjectToBuffer } = await import('@/lib/s3');
      const s3Key = buildUserS3Key(userId, calendarId, fileName);
      const s3Obj = await downloadS3ObjectToBuffer(s3Key);
      if (s3Obj && s3Obj.buffer) {
        // Cache to local disk for fast subsequent access
        try {
          fs.mkdirSync(path.dirname(resolved), { recursive: true });
          fs.writeFileSync(resolved, s3Obj.buffer);
        } catch {}

        return new NextResponse(new Uint8Array(s3Obj.buffer), {
          headers: {
            'Content-Type': s3Obj.contentType || 'image/png',
            'Content-Length': String(s3Obj.buffer.length),
            'Cache-Control': 'private, max-age=3600',
          },
        });
      }
    } catch (e: any) {
      console.error('[Media Route] S3 download error:', e.message);
    }

    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ext = path.extname(resolved).toLowerCase();
  const type = ext === '.png' ? 'image/png'
    : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp'
    : 'application/octet-stream';

  const buf = fs.readFileSync(resolved);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(buf.length),
      'Cache-Control': 'private, max-age=3600',
    },
  });
}
