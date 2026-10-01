import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import { complete, hashtagPrompt, parseHashtags, resolveKey, rewritePrompt } from '@/lib/ai';
import { specFor } from '@/lib/platformSpecs';

/**
 * Regenerate part of a post, from the post editor.
 *
 *   target: 'content'  -> rewrite the copy for its platform, save it
 *           'hashtags' -> suggest hashtags (returned only; the editor decides what to insert)
 *           'image'    -> generate a new image at the platform's exact size, save it
 *
 * Image regeneration runs through the same generator a batch uses (tools/generate_calendar.py
 * --singleImage), so sizes, quality and the resize step cannot drift between the two paths.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const postId = String(body.postId || '');
    const target = String(body.target || '').toLowerCase();
    if (!postId) return NextResponse.json({ error: 'postId is required' }, { status: 400 });
    if (!['content', 'hashtags', 'image'].includes(target)) {
      return NextResponse.json({ error: "target must be 'content', 'hashtags' or 'image'" }, { status: 400 });
    }

    await initPostgresTables();
    const q = await pool.query(
      `SELECT p.id, p.calendar_id, p.user_id, p.day_index, p.platform, p.content, p.media_prompt, p.media_url,
              c.niche, c.audience, c.tone
         FROM posts p LEFT JOIN content_calendars c ON c.id = p.calendar_id
        WHERE p.id = $1 AND p.user_id = $2`,
      [postId, userId]
    );
    if (q.rows.length === 0) return NextResponse.json({ error: 'Post not found for this user' }, { status: 404 });
    const post = q.rows[0];

    // The caller's own key wins (BYOK); otherwise the server's. Never stored.
    const key = resolveKey(String(body.provider || ''), String(body.apiKey || ''));
    const profileQuality = await pool.query('SELECT image_quality FROM users WHERE id = $1', [userId]);
    const requestedQuality = String(body.imageQuality || profileQuality.rows[0]?.image_quality || 'low').toLowerCase();
    const imageQuality = ['low', 'medium', 'high'].includes(requestedQuality) ? requestedQuality : 'low';

    if (target === 'content') {
      if (!key) return NextResponse.json({ error: 'no model API key available (add one in the AI engine card)' }, { status: 400 });
      const out = await complete(key.provider, key.key, rewritePrompt({
        platform: post.platform,
        content: post.content || '',
        niche: post.niche,
        audience: post.audience,
        tone: post.tone,
      }));
      if (!out.ok) return NextResponse.json({ error: out.reason }, { status: 502 });

      const spec = specFor(post.platform);
      const content = out.text.slice(0, spec.maxChars);
      await pool.query('UPDATE posts SET content = $1 WHERE id = $2 AND user_id = $3', [content, postId, userId]);
      return NextResponse.json({ success: true, target, content, provider: key.provider, truncated: out.text.length > content.length });
    }

    if (target === 'hashtags') {
      if (!key) return NextResponse.json({ error: 'no model API key available (add one in the AI engine card)' }, { status: 400 });
      const out = await complete(key.provider, key.key, hashtagPrompt({
        platform: post.platform,
        content: post.content || '',
        niche: post.niche,
      }));
      if (!out.ok) return NextResponse.json({ error: out.reason }, { status: 502 });
      return NextResponse.json({ success: true, target, hashtags: parseHashtags(out.text), raw: out.text.slice(0, 300), provider: key.provider });
    }

    // ---- image ----
    const imageApiKey = String(body.imageApiKey || '').trim() || (process.env.OPENAI_API_KEY || '').trim();
    if (!imageApiKey) {
      return NextResponse.json({ error: 'no image API key available (set OPENAI_API_KEY - DeepSeek cannot generate images)' }, { status: 400 });
    }

    const spec = specFor(post.platform);
    const dir = path.join(process.cwd(), 'media', 'generated', String(post.calendar_id));
    fs.mkdirSync(dir, { recursive: true });
    const stamp = Date.now().toString(36);
    const fileName = `${post.calendar_id}_${post.day_index || 1}_${String(post.platform).toLowerCase()}_regen_${stamp}.png`;
    const outPath = path.join(dir, fileName);
    const prompt = (post.media_prompt || '').trim() ||
      `An editorial image for a ${spec.label} post about ${post.niche || 'the brand topic'}. Clean, modern, no text.`;

    const scriptPath = path.join(process.cwd(), 'tools', 'generate_calendar.py');
    const child = spawn('python', [
      scriptPath,
      '--singleImage', String(post.platform).toUpperCase(),
      '--singleImagePrompt', prompt,
      '--singleImageOut', outPath,
      '--imageQuality', imageQuality,
      '--imageApiKey', imageApiKey,
    ]);
    let out = '';
    let err = '';
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.stderr.on('data', (d) => { err += d.toString(); });
    const code = await new Promise<number>((resolve) => { child.on('close', resolve); });

    let parsed: any = null;
    try { parsed = JSON.parse(out.trim().split('\n').pop() || '{}'); } catch { parsed = null; }
    if (code !== 0 || !parsed?.ok) {
      return NextResponse.json(
        { error: parsed?.error || err.slice(0, 300) || 'image generation failed', exitCode: code },
        { status: 502 }
      );
    }

    const mediaUrl = `/api/media/generated/${post.calendar_id}/${fileName}`;
    await pool.query('UPDATE posts SET media_url = $1 WHERE id = $2 AND user_id = $3', [mediaUrl, postId, userId]);
    return NextResponse.json({
      success: true,
      target,
      mediaUrl,
      width: parsed.width,
      height: parsed.height,
      bytes: parsed.bytes,
      quality: parsed.quality,
      resized: parsed.resized,
      prompt,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
