import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';

// Formats LinkedIn, X and Instagram all accept (webp is not accepted by LinkedIn's Images API).
const ACCEPTED: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
};
const MAX_BYTES = 8 * 1024 * 1024;

/** Replace a post's image with one the user uploads. */
export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'expected a multipart upload' }, { status: 400 });

    const postId = String(form.get('postId') || '');
    const file = form.get('file');
    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    if (!(file instanceof File)) return NextResponse.json({ error: 'no file was uploaded' }, { status: 400 });

    const ext = ACCEPTED[file.type];
    if (!ext) {
      return NextResponse.json(
        { error: `unsupported image type ${file.type || 'unknown'} - use PNG, JPG or GIF (LinkedIn rejects WebP)` },
        { status: 400 }
      );
    }
    if (file.size > MAX_BYTES) {
      return NextResponse.json({ error: `image is ${(file.size / 1048576).toFixed(1)} MB - the limit is 8 MB` }, { status: 400 });
    }

    await initPostgresTables();
    const owned = await pool.query('SELECT id, calendar_id FROM posts WHERE id = $1 AND user_id = $2', [postId, userId]);
    if (owned.rows.length === 0) return NextResponse.json({ error: 'Post not found for this user' }, { status: 404 });
    const calendarId = owned.rows[0].calendar_id;

    const dir = path.join(process.cwd(), 'media', 'generated', String(calendarId));
    fs.mkdirSync(dir, { recursive: true });
    const fileName = `${calendarId}_uploaded_${Date.now().toString(36)}${ext}`;
    fs.writeFileSync(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));

    const mediaUrl = `/api/media/generated/${calendarId}/${fileName}`;
    await pool.query('UPDATE posts SET media_url = $1 WHERE id = $2 AND user_id = $3', [mediaUrl, postId, userId]);

    return NextResponse.json({
      success: true,
      mediaUrl,
      bytes: file.size,
      contentType: file.type,
      originalName: file.name || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
