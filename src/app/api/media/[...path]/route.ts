import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { currentUserId } from '@/lib/session';

const MEDIA_ROOT = path.join(process.cwd(), 'media');

export async function GET(_req: NextRequest, { params }: { params: { path: string[] } }) {
  // Generated media is user data and is only served to a signed-in user.
  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const rel = (params.path || []).join('/');
  const resolved = path.resolve(MEDIA_ROOT, rel);
  // Path-traversal guard: the resolved file must stay inside the media root.
  if (!resolved.startsWith(path.resolve(MEDIA_ROOT) + path.sep)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 });
  }
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
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
