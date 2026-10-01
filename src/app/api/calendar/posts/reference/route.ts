import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';

/**
 * The user's own INPUT image(s) for a post.
 *
 * This is the third way to get an image (the other two: let the model decide from the copy, or upload the
 * finished picture). These files are stored, kept with the post, and handed to the image model as the source
 * material, so the model generates the postable image FROM the user's picture instead of from text alone.
 *
 * Files are written beside the post's other media and addressed by /api/media/..., which is ownership-checked.
 */
const ACCEPTED: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
};
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_REFS = 6;

export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'expected a multipart upload' }, { status: 400 });

    const postId = String(form.get('postId') || '');
    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 });

    const files = form.getAll('file').filter((f): f is File => f instanceof File);
    if (files.length === 0) return NextResponse.json({ error: 'no input image was uploaded' }, { status: 400 });

    await initPostgresTables();
    const owned = await pool.query('SELECT id, calendar_id, reference_urls FROM posts WHERE id = $1 AND user_id = $2', [
      postId,
      userId,
    ]);
    if (owned.rows.length === 0) return NextResponse.json({ error: 'Post not found for this user' }, { status: 404 });
    const calendarId = String(owned.rows[0].calendar_id);
    const existing: string[] = Array.isArray(owned.rows[0].reference_urls) ? owned.rows[0].reference_urls : [];
    if (existing.length + files.length > MAX_REFS) {
      return NextResponse.json(
        { error: `a post can hold ${MAX_REFS} input images and it already has ${existing.length}` },
        { status: 400 }
      );
    }

    // Validate everything BEFORE writing, so a bad file in the batch cannot leave half an upload behind.
    const planned: { file: File; ext: string; i: number }[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = ACCEPTED[file.type];
      if (!ext) {
        return NextResponse.json(
          { error: `unsupported image type ${file.type || 'unknown'} — use PNG, JPG or GIF (LinkedIn rejects WebP)` },
          { status: 400 }
        );
      }
      if (file.size > MAX_BYTES) {
        return NextResponse.json(
          { error: `${file.name || 'image'} is ${(file.size / 1048576).toFixed(1)} MB — the limit is 8 MB` },
          { status: 400 }
        );
      }
      planned.push({ file, ext, i });
    }

    const dir = path.join(process.cwd(), 'media', 'generated', calendarId);
    fs.mkdirSync(dir, { recursive: true });
    const stamp = Date.now().toString(36);
    const stored: { url: string; name: string; bytes: number }[] = [];
    for (const { file, ext, i } of planned) {
      const fileName = `${calendarId}_ref_${stamp}_${i}${ext}`;
      fs.writeFileSync(path.join(dir, fileName), Buffer.from(await file.arrayBuffer()));
      stored.push({ url: `/api/media/generated/${calendarId}/${fileName}`, name: file.name || fileName, bytes: file.size });
    }

    const referenceUrls = [...existing, ...stored.map((s) => s.url)];
    await pool.query('UPDATE posts SET reference_urls = $1::jsonb WHERE id = $2 AND user_id = $3', [
      JSON.stringify(referenceUrls),
      postId,
      userId,
    ]);

    return NextResponse.json({
      success: true,
      referenceUrls,
      added: stored.length,
      files: stored,
      note: `${stored.length} input image(s) stored with this post — the image model generates the postable image from ${stored.length === 1 ? 'it' : 'them'}.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Drop one input image (body.url) or all of them. The image they produced stays on the post. */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const postId = String(body.postId || '');
    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 });

    await initPostgresTables();
    const owned = await pool.query('SELECT id, calendar_id, reference_urls FROM posts WHERE id = $1 AND user_id = $2', [
      postId,
      userId,
    ]);
    if (owned.rows.length === 0) return NextResponse.json({ error: 'Post not found for this user' }, { status: 404 });
    const calendarId = String(owned.rows[0].calendar_id);
    const existing: string[] = Array.isArray(owned.rows[0].reference_urls) ? owned.rows[0].reference_urls : [];

    const which = body.url ? String(body.url) : null;
    const keep = which ? existing.filter((u) => u !== which) : [];
    const dropped = which ? existing.filter((u) => u === which) : existing;
    if (which && dropped.length === 0) return NextResponse.json({ error: 'that image is not on this post' }, { status: 404 });

    // Delete the files too - they were only ever this post's input images.
    const dir = path.join(process.cwd(), 'media', 'generated', calendarId);
    for (const u of dropped) {
      const abs = path.join(dir, path.basename(String(u)));
      try {
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
      } catch {
        /* the row is what matters; a locked file must not fail the request */
      }
    }

    await pool.query('UPDATE posts SET reference_urls = $1::jsonb WHERE id = $2 AND user_id = $3', [
      JSON.stringify(keep),
      postId,
      userId,
    ]);

    return NextResponse.json({
      success: true,
      referenceUrls: keep,
      removed: dropped.length,
      note: `Removed ${dropped.length} input image(s). The post's current image was not touched.`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
