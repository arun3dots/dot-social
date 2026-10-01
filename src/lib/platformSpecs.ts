/**
 * Per-platform content rules and image dimensions.
 *
 * These mirror PLATFORM_SPECS in tools/generate_calendar.py (which actually generates the images) so
 * the editor, the previews and the generator all agree. Keep the two in step: X is 16:9 landscape,
 * LinkedIn 1:1 square, Instagram 4:5 portrait - one image size for all platforms is wrong.
 */
export type PlatformSpec = {
  label: string;
  maxChars: number;
  hashtags: string;
  tone: string;
  structure: string;
  /** Exact feed image size, in pixels. Deliberately different per platform. */
  imageSize: [number, number];
  /** Feed aspect ratio, for previews and for describing the image. */
  ratio: string;
};

export const PLATFORM_SPECS: Record<string, PlatformSpec> = {
  TWITTER: {
    label: 'X / Twitter',
    maxChars: 280,
    hashtags: '0-2',
    tone: 'punchy hook in the first 6 words, ONE idea, no preamble, no corporate speak',
    structure: 'hook -> one concrete point -> short question or CTA',
    imageSize: [1600, 900],
    ratio: '16:9',
  },
  LINKEDIN: {
    label: 'LinkedIn',
    maxChars: 3000,
    hashtags: '3-5',
    tone: 'professional and insight-led, one clear argument, short lines, no hype',
    structure: 'hook -> context -> 3 short bullets -> takeaway -> question',
    imageSize: [1200, 1200],
    ratio: '1:1',
  },
  INSTAGRAM: {
    label: 'Instagram',
    maxChars: 2200,
    hashtags: '5-8',
    tone: 'visual-first, hook line then short scannable body, emoji used sparingly',
    structure: 'hook -> 3 quick value points -> save/share CTA -> hashtags',
    imageSize: [1080, 1350],
    ratio: '4:5',
  },
};

export function specFor(platform: string): PlatformSpec {
  return PLATFORM_SPECS[String(platform || '').toUpperCase()] || {
    label: String(platform || 'post'),
    maxChars: 2200,
    hashtags: '3-5',
    tone: 'clear and direct',
    structure: 'hook -> value -> CTA',
    imageSize: [1080, 1350],
  };
}
