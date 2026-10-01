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
