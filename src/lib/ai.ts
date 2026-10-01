import { specFor } from '@/lib/platformSpecs';

/**
 * One-shot text generation for the post editor (rewrite a post, suggest hashtags).
 *
 * Same providers the batch generator uses, and the same BYOK rule: the caller's key wins,
 * otherwise the server's own key. The key is never written to the database.
 */
type Provider = 'deepseek' | 'openai' | 'gemini';

const ENDPOINTS: Record<Provider, { url: string; model: string }> = {
  deepseek: { url: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', model: 'gpt-4o-mini' },
  gemini: { url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent', model: 'gemini-1.5-flash' },
};

export function resolveKey(provider: string, byok?: string): { provider: Provider; key: string } | null {
  const env: Record<Provider, string | undefined> = {
    deepseek: process.env.DEEPSEEK_API_KEY,
    openai: process.env.OPENAI_API_KEY,
    gemini: process.env.GEMINI_API_KEY,
  };
  const p = (['deepseek', 'openai', 'gemini'] as Provider[]).find((x) => x === String(provider || '').toLowerCase());
  if (p) {
    const key = (byok || '').trim() || (env[p] || '').trim();
    if (key) return { provider: p, key };
  }
  for (const candidate of ['deepseek', 'openai', 'gemini'] as Provider[]) {
    const key = (env[candidate] || '').trim();
    if (key) return { provider: candidate, key };
  }
  return null;
}

export async function complete(
  provider: Provider,
  key: string,
  prompt: string,
  maxTokens = 900
): Promise<{ ok: true; text: string } | { ok: false; reason: string }> {
  try {
    if (provider === 'gemini') {
      const res = await fetch(`${ENDPOINTS.gemini.url}?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: maxTokens, temperature: 0.8 },
        }),
      });
      const text = await res.text();
      if (!res.ok) return { ok: false, reason: `gemini refused: HTTP ${res.status} ${text.slice(0, 200)}` };
      const parsed = JSON.parse(text);
      const out = parsed?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).filter(Boolean).join('') || '';
      if (!out) return { ok: false, reason: 'gemini returned no text' };
      return { ok: true, text: out.trim() };
    }

    const ep = ENDPOINTS[provider];
    const res = await fetch(ep.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ep.model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: maxTokens,
        temperature: 0.8,
      }),
    });
    const text = await res.text();
    if (!res.ok) return { ok: false, reason: `${provider} refused: HTTP ${res.status} ${text.slice(0, 200)}` };
    const parsed = JSON.parse(text);
    const out = parsed?.choices?.[0]?.message?.content || '';
    if (!out) return { ok: false, reason: `${provider} returned no text` };
    return { ok: true, text: out.trim() };
  } catch (e: any) {
    return { ok: false, reason: `${provider} request error: ${e.message}` };
  }
}

export function rewritePrompt(args: {
  platform: string;
  content: string;
  niche?: string;
  audience?: string;
  tone?: string;
}): string {
  const spec = specFor(args.platform);
  return `You are a senior social media strategist. Rewrite this ${spec.label} post so it performs better, keeping the same core idea and the author's voice.

HARD RULES
- platform: ${spec.label}
- max ${spec.maxChars} characters (count them; never exceed)
- ${spec.hashtags} hashtags
- tone: ${args.tone || spec.tone}
- structure: ${spec.structure}
- niche: ${args.niche || 'not specified'} | audience: ${args.audience || 'not specified'}
- no preamble, no explanation, no quotes around the post

CURRENT POST
${args.content}

Return ONLY the rewritten post text.`;
}

/**
 * One post For ONE platform, as structured JSON.
 *
 * Written for a multi-platform campaign: the same idea goes out on several platforms at once, so the
 * model is told which other platforms are getting it and must write the version that ONLY works here
 * (a 280-character hook is not a LinkedIn argument, and neither is an Instagram caption).
 */
export function postPrompt(args: {
  platform: string;
  niche?: string;
  audience?: string;
  tone?: string;
  theme?: string;
  /** The other platforms the same idea is going to, so this one is not a copy of them. */
  siblings?: string[];
}): string {
  const spec = specFor(args.platform);
  const others = (args.siblings || []).filter((s) => s && s.toUpperCase() !== args.platform.toUpperCase());
  const othersLine = others.length
    ? `\n- the same idea is ALSO being posted on ${others.map((o) => specFor(o).label).join(' and ')}: write the version that only works on ${spec.label}, do not reuse the same opening line, and do not try to cover what those formats are for`
    : '';

  return `You are a senior social media strategist writing one post for one platform.

TARGET
- platform: ${spec.label}
- max ${spec.maxChars} characters (count them; never exceed)
- ${spec.hashtags} hashtags${othersLine}

BRAND
- niche: ${args.niche || 'not specified'}
- audience: ${args.audience || 'not specified'}
- tone: ${args.tone || spec.tone}
- structure: ${spec.structure}
${args.theme ? `- angle for the day: ${args.theme}` : ''}

ALSO RETURN an image prompt for this post: one or two sentences describing a single image that suits
this platform's audience and aspect ratio (${spec.imageSize[0]}x${spec.imageSize[1]}), photographic or
clean-illustration style, absolutely no text or lettering in the image.

Return STRICT JSON only, no markdown fence, no commentary:
{"content": "<the post>", "imagePrompt": "<the image description>"}`;
}

/** Tolerant reader for the JSON above: models sometimes fence it or add a sentence around it. */
export function parsePostJson(text: string): { content: string; imagePrompt: string | null } {
  const cleaned = String(text || '')
    .replace(/^\s*```(?:json)?/i, '')
    .replace(/```\s*$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end > start) {
    try {
      const parsed = JSON.parse(cleaned.slice(start, end + 1));
      const content = typeof parsed.content === 'string' ? parsed.content.trim() : '';
      const imagePrompt = typeof parsed.imagePrompt === 'string' ? parsed.imagePrompt.trim() : '';
      if (content) return { content, imagePrompt: imagePrompt || null };
    } catch {
      // fall through: treat the raw text as the post rather than inventing structure
    }
  }
  return { content: cleaned, imagePrompt: null };
}

/**
 * Turn a short brief from the user into a prompt the image model can actually work from.
 *
 * The user's words are kept as the subject - this only fills in what an image model needs and a person
 * usually leaves out (composition, light, style, what to exclude), plus the platform's own framing.
 */
export function imagePromptRefinePrompt(args: {
  userPrompt: string;
  platforms: string[];
  niche?: string;
  tone?: string;
  postText?: string;
  /** True when the user's own image is handed to the image model as the SOURCE of this picture. */
  hasInputImage?: boolean;
}): string {
  const sizes = args.platforms
    .map((p) => {
      const spec = specFor(p);
      return `- ${spec.label}: ${spec.imageSize[0]}x${spec.imageSize[1]} (${spec.ratio})`;
    })
    .join('\n');
  const oneFrame = args.platforms.length === 1 ? specFor(args.platforms[0]) : null;

  const sourceRule = args.hasInputImage
    ? `
THIS IS AN EDIT OF A REAL PICTURE THE USER SUPPLIED
- the user's own image is given to the image model as the source, and the model must work FROM it
- the finished prompt MUST keep that picture's subject, composition and colour palette recognisable
- change only what the brief asks for (light, background, framing, polish) - never describe a different
  scene, a different person, or objects that are not in the supplied picture
- do not invent props, text or settings that would replace what the picture shows
`
    : '';

  return `You are an art director writing one image-generation prompt.

THE USER'S BRIEF (keep this as the subject, do not replace the idea)
"${args.userPrompt}"
${sourceRule}
CONTEXT
- brand niche: ${args.niche || 'not specified'}
- tone: ${args.tone || 'not specified'}
${args.postText ? `- the post it illustrates: ${String(args.postText).slice(0, 400)}` : ''}
- the image is a single photograph or illustration used as the post's picture, at these sizes:
${sizes}
${oneFrame ? `- COMPOSE FOR THIS FRAME: ${oneFrame.ratio} (${oneFrame.imageSize[0]}x${oneFrame.imageSize[1]}). The image is shown whole, never cropped, so fill this frame and place the subject with comfortable margins - do not run detail off the edges.` : ''}

WRITE one prompt of 40-80 words covering, in this order: subject and what it is doing; setting; light and
time of day; style and lens feel; colour direction; composition and where the empty space is.

HARD RULES
- absolutely no text, letters, words, logos, watermarks or UI screenshots in the image
- no collages, no split panels, no before/after
- the whole picture is kept and shown complete; never compose something that only reads after being cut
- describe an image, not a poster: no "banner", no "thumbnail", no "cover"

Answer with the prompt alone - no preamble, no quotes, no markdown.`;
}

/** Whatever the model returned, keep it a single clean prompt. */
export function sanitiseImagePrompt(text: string): string {
  return String(text || '')
    .replace(/^\s*```[a-z]*/i, '')
    .replace(/```\s*$/, '')
    .replace(/^\s*(image\s*prompt|prompt)\s*[:\-]\s*/i, '')
    .replace(/^["'`]+|["'`]+$/g, '')
    .replace(/\s*\n\s*/g, ' ')
    .trim()
    .slice(0, 900);
}

export function hashtagPrompt(args: { platform: string; content: string; niche?: string }): string {
  const spec = specFor(args.platform);
  return `Suggest relevant, specific hashtags for this ${spec.label} post.
Rules: ${spec.hashtags} hashtags, each starting with #, no duplicates, no generic filler (#love #instagood), no explanation.
Niche: ${args.niche || 'not specified'}

POST
${args.content}

Return ONLY the hashtags separated by spaces.`;
}

/** Pull hashtags out of whatever the model returned. */
export function parseHashtags(text: string): string[] {
  const found = (text.match(/#[A-Za-z0-9_]{2,}/g) || []).map((h) => h.trim());
  return Array.from(new Set(found)).slice(0, 12);
}
