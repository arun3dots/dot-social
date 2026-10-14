import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import os from 'os';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import {
  complete,
  hashtagPrompt,
  imagePromptRefinePrompt,
  parseHashtags,
  resolveKey,
  rewritePrompt,
  sanitiseImagePrompt,
} from '@/lib/ai';
import { specFor } from '@/lib/platformSpecs';
import { uploadLocalFileToS3 } from '@/lib/s3';

/**
 * Regenerate part of a post, from the post editor.
 *
 *   target: 'content'  -> rewrite the copy for its platform, save it
 *           'hashtags' -> suggest hashtags (returned only; the editor decides what to insert)
 *           'image'    -> generate a new image at the platform's exact size, save it
 *
 * Image regeneration runs through the same generator a batch uses (tools/generate_calendar.py
 * --singleImage), so sizes, quality and the resize step cannot drift between the two paths.
 *
 * The image has three ways in, and `mode` says which one is being used:
 *   'generate'  (default) the model decides from the copy and the prompt (text -> image)
 *   'reference' the model generates FROM the user's own input image(s) stored on the post
 *   (the third, "I have the final image", does not come through here - it is a direct upload)
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
              p.reference_urls, c.niche, c.audience, c.tone
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
    const mode = String(body.mode || 'generate').toLowerCase() === 'reference' ? 'reference' : 'generate';
    const baseMediaDir = process.env.VERCEL ? '/tmp' : process.cwd();
    const dir = path.join(baseMediaDir, 'media', 'generated', String(post.calendar_id));

    // The user's input image(s), resolved to files INSIDE this post's own media directory. The stored value
    // is a URL, so only its basename is used - a stored path can never reach outside the calendar's folder.
    const referenceUrls: string[] = Array.isArray(post.reference_urls) ? post.reference_urls : [];
    const referencePaths = referenceUrls
      .map((u) => path.join(dir, path.basename(String(u))))
      .filter((abs) => fs.existsSync(abs));
    if (mode === 'reference' && referencePaths.length === 0) {
      return NextResponse.json(
        {
          error: referenceUrls.length
            ? 'the input image(s) stored on this post are no longer on disk - upload them again'
            : 'upload at least one input image first (Image → "Generate from my input image")',
        },
        { status: 400 }
      );
    }
    try { fs.mkdirSync(dir, { recursive: true }); } catch {}
    const stamp = Date.now().toString(36);
    const fileName = `${post.calendar_id}_${post.day_index || 1}_${String(post.platform).toLowerCase()}_regen_${stamp}.png`;
    const outPath = path.join(dir, fileName);

    // A prompt typed in the editor is treated as a brief: it is fine-tuned into a production image
    // prompt first (composition, light, style, and "no text in the image"), then generated. Without one
    // the stored prompt is reused, and if there is none either, a plain description of the post.
    const userPrompt = String(body.imagePrompt || '').trim();
    const excerpt = String(post.content || '').replace(/\s+/g, ' ').trim().slice(0, 240);
    // A prompt stored by an EARLIER run belongs to that run. When the user's own image is the source, a stored
    // text-to-image prompt describes a different picture and simply overrides their image - which is exactly
    // what happened: a stored "laptop screen with green code" prompt beat the supplied portrait. In reference
    // mode the stored prompt is therefore NOT reused as the instruction; the input image is the subject.
    const storedPrompt = mode === 'reference' ? '' : (post.media_prompt || '').trim();
    let prompt = storedPrompt ||
      (mode === 'reference'
        ? `Make a ${spec.label} post image FROM the supplied input image. Keep the subject, the composition and the ` +
          `colour palette of the supplied image recognisable — clean it up, frame it for ${spec.ratio}, and improve ` +
          `the lighting so it holds up as a standalone ${spec.ratio} visual; do not replace what the picture shows ` +
          `with a different scene, and leave the middle uncluttered. ` +
          (excerpt ? `The post it accompanies says: "${excerpt}". ` : '') +
          `No text, lettering or logos in the image.`
        : `An editorial image for a ${spec.label} post about ${post.niche || 'the brand topic'}. Clean, modern, no text.`);
    let refined = false;
    let refineNote: string | null = null;
    if (userPrompt) {
      if (!key) {
        prompt = userPrompt; // no model to refine with: use the user's words unchanged rather than inventing
        refineNote = 'no model key available to fine-tune the prompt, so your words were used as written';
      } else {
        const fin = await complete(key.provider, key.key, imagePromptRefinePrompt({
          userPrompt,
          platforms: [post.platform],
          niche: post.niche,
          tone: post.tone,
          postText: post.content,
          hasInputImage: mode === 'reference',
        }), 500);
        if (fin.ok) {
          const cleaned = sanitiseImagePrompt(fin.text);
          if (cleaned) {
            prompt = cleaned;
            refined = true;
          } else refineNote = 'the model returned nothing usable, so your prompt was used as written';
        } else refineNote = `${fin.reason} - your prompt was used as written`;
      }
    }

    const scriptPath = path.join(process.cwd(), 'tools', 'generate_calendar.py');
    const child = spawn('python', [
      scriptPath,
      '--singleImage', String(post.platform).toUpperCase(),
      '--singleImagePrompt', prompt,
      '--singleImageOut', outPath,
      '--imageQuality', imageQuality,
      '--imageApiKey', imageApiKey,
      // mode 'reference': the model generates FROM these files instead of from text alone
      ...referencePaths.flatMap((abs) => ['--reference', abs]),
    ]);
    let out = '';
    let err = '';
    child.stdout?.on('data', (d) => { out += d.toString(); });
    child.stderr?.on('data', (d) => { err += d.toString(); });
    const code = await new Promise<number>((resolve) => {
      child.on('error', (e) => {
        err += ` Python error: ${e.message}`;
        resolve(1);
      });
      child.on('close', (c) => resolve(c ?? 1));
    });

    let parsed: any = null;
    try { parsed = JSON.parse(out.trim().split('\n').pop() || '{}'); } catch { parsed = null; }
    if (code !== 0 || !parsed?.ok) {
      return NextResponse.json(
        { error: parsed?.error || err.slice(0, 300) || 'image generation failed', exitCode: code },
        { status: 502 }
      );
    }

    const mediaUrl = `/api/media/generated/${post.calendar_id}/${fileName}`;
    let s3Key: string | null = null;
    let s3Url: string | null = null;
    try {
      const s3Res = await uploadLocalFileToS3({
        filePath: outPath,
        userId,
        calendarId: String(post.calendar_id),
        customFileName: fileName,
      });
      if (s3Res) {
        s3Key = s3Res.key;
        s3Url = s3Res.url;
      }
    } catch (s3Err: any) {
      console.error('[S3] Failed to upload regenerated image to S3:', s3Err.message);
    }

    // Store the prompt that produced the image, refined or not, and S3 credentials
    await pool.query(
      'UPDATE posts SET media_url = $1, media_prompt = $2, s3_key = $3, s3_url = $4 WHERE id = $5 AND user_id = $6',
      [mediaUrl, prompt, s3Key, s3Url, postId, userId]
    );
    return NextResponse.json({
      success: true,
      target,
      imageMode: mode,
      source: parsed.source || null,
      references: mode === 'reference' ? referencePaths.length : 0,
      mediaUrl,
      s3Key,
      s3Url,
      width: parsed.width,
      height: parsed.height,
      bytes: parsed.bytes,
      quality: parsed.quality,
      resized: parsed.resized,
      cropped: false,
      mode: parsed.mode || null,
      content: parsed.content || null,
      bandPx: parsed.bandPx ?? 0,
      prompt,
      promptSource: userPrompt ? (refined ? 'your brief, fine-tuned' : 'your words as written') : mode === 'reference' ? 'written to keep your input image' : 'the prompt stored with this post',
      promptRefined: refined,
      yourPrompt: userPrompt || null,
      note: refineNote,
      size: `${spec.imageSize[0]}x${spec.imageSize[1]} (${spec.ratio})`,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
