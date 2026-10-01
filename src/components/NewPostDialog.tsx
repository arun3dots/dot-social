'use client';

import React, { useState } from 'react';
import { Platform, PostItem } from '@/types';
import { Check, Loader2, Plus, Twitter, Linkedin, Instagram } from 'lucide-react';

interface Props {
  /** Pre-filled date, YYYY-MM-DD (the day that was clicked, or today). */
  initialDate: string;
  /** Day index when the date belongs to a day the calendar already knows. */
  dayIndex?: number;
  onAddPost: (args: {
    dayIndex?: number;
    date: string;
    platforms: Platform[];
    generateContent: boolean;
    content?: string;
    generateImage?: boolean;
    imagePrompt?: string;
    imagePerPlatform?: boolean;
  }) => Promise<{ ok: boolean; note: string; posts?: PostItem[]; dayIndex?: number }>;
  onCreated: (posts: PostItem[], dayIndex: number, note: string) => void;
  onClose: () => void;
}

const PLATFORMS: Platform[] = ['LINKEDIN', 'TWITTER', 'INSTAGRAM'];

/** What that platform's generated copy is actually written like. */
const PLATFORM_NOTE: Record<Platform, string> = {
  LINKEDIN: 'long-form argument, 3-5 hashtags',
  TWITTER: 'one idea, under 280 characters',
  INSTAGRAM: 'visual-first caption, 5-8 hashtags',
};

function PlatformIcon({ platform, size = 12 }: { platform: Platform; size?: number }) {
  if (platform === 'TWITTER') return <Twitter size={size} className="text-sky-400" />;
  if (platform === 'LINKEDIN') return <Linkedin size={size} className="text-blue-400" />;
  return <Instagram size={size} className="text-pink-400" />;
}

/**
 * Create posts from the calendar view. Several platforms can be selected at once: each gets its own post
 * and its own generated copy - the server writes a different version per platform rather than reusing
 * one text - and each is placed at that platform's own slot on the chosen day.
 */
export default function NewPostDialog({ initialDate, dayIndex, onAddPost, onCreated, onClose }: Props) {
  const [date, setDate] = useState(initialDate);
  const [platforms, setPlatforms] = useState<Platform[]>(['LINKEDIN']);
  const [mode, setMode] = useState<'generate' | 'write' | 'blank'>('generate');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [withImage, setWithImage] = useState(true);
  const [imagePrompt, setImagePrompt] = useState('');
  // Separate generation per platform is the default: each image is composed for its own frame,
  // so nothing is cropped and no frame needs padding.
  const [perPlatformImage, setPerPlatformImage] = useState(true);

  // Keep the canonical order so the posts are created platform by platform, predictably.
  const toggle = (p: Platform) =>
    setPlatforms((prev) => PLATFORMS.filter((x) => (x === p ? !prev.includes(x) : prev.includes(x))));

  const submit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Pick a date first.');
      return;
    }
    if (platforms.length === 0) {
      setError('Pick at least one platform.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await onAddPost({
        // Only claim a day index when the date has not been edited away from it.
        dayIndex: date === initialDate ? dayIndex : undefined,
        date,
        platforms,
        generateContent: mode === 'generate',
        content: mode === 'write' ? content : undefined,
        generateImage: withImage,
        imagePrompt: withImage && imagePrompt.trim() ? imagePrompt.trim() : undefined,
        imagePerPlatform: withImage && perPlatformImage,
      });
      if (!res.ok) {
        setError(res.note);
        return;
      }
      if (res.posts && res.posts.length) onCreated(res.posts, res.dayIndex ?? dayIndex ?? 1, res.note);
      else onClose();
    } finally {
      setBusy(false);
    }
  };

  const count = platforms.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-md bg-[#0e121a] border border-zinc-700 rounded-lg shadow-2xl">
        <div className="px-5 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Plus size={13} className="text-cyan-400" />
          <span className="text-sm font-semibold text-zinc-100 font-mono">New post</span>
        </div>

        <div className="p-5 flex flex-col gap-4 text-[11px] font-mono text-zinc-300">
          <label className="flex flex-col gap-1.5">
            <span className="text-zinc-500">Day</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 font-mono text-[11px]"
            />
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Platforms (pick any — one post each)</span>
              <button
                onClick={() => setPlatforms(platforms.length === PLATFORMS.length ? [] : [...PLATFORMS])}
                className="text-[10px] text-cyan-400 hover:text-cyan-300"
              >
                {platforms.length === PLATFORMS.length ? 'clear' : 'all three'}
              </button>
            </div>
            <div className="flex flex-col gap-1.5">
              {PLATFORMS.map((p) => {
                const on = platforms.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => toggle(p)}
                    className={`flex items-center gap-2 px-3 py-2 rounded border text-left ${
                      on ? 'bg-cyan-500/10 border-cyan-500/50' : 'bg-zinc-900 border-zinc-800 hover:bg-zinc-800'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 flex items-center justify-center rounded border ${
                        on ? 'bg-cyan-600 border-cyan-500 text-black' : 'border-zinc-600'
                      }`}
                    >
                      {on && <Check size={10} />}
                    </span>
                    <PlatformIcon platform={p} size={12} />
                    <span className={on ? 'text-zinc-100' : 'text-zinc-400'}>{p}</span>
                    <span className="text-[9px] text-zinc-500 ml-auto text-right">{PLATFORM_NOTE[p]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-zinc-500">Copy</span>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  {
                    id: 'generate',
                    label:
                      count > 1
                        ? `write it for me — a different version for each of the ${count} platforms`
                        : 'write it for me (uses your AI model)',
                  },
                  {
                    id: 'write',
                    label:
                      count > 1
                        ? 'I will write it now (the same text goes to each platform)'
                        : 'I will write it now',
                  },
                  { id: 'blank', label: 'start blank - edit it later' },
                ] as const
              ).map((m) => (
                <label key={m.id} className="flex items-start gap-2 cursor-pointer">
                  <input type="radio" checked={mode === m.id} onChange={() => setMode(m.id)} className="mt-0.5" />
                  <span className={mode === m.id ? 'text-zinc-200' : 'text-zinc-500'}>{m.label}</span>
                </label>
              ))}
            </div>
            {mode === 'write' && (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                placeholder="Write the post here, or leave it to edit after creating."
                className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 font-mono text-[11px] resize-y"
              />
            )}
          </div>

          <div className="flex flex-col gap-2 border-t border-zinc-800 pt-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500">Image</span>
              <span className="text-[9px] text-zinc-600">quality set in Settings (~$0.01/image at low)</span>
            </div>
            <label className="flex items-start gap-2 cursor-pointer">
              <input type="checkbox" checked={withImage} onChange={(e) => setWithImage(e.target.checked)} className="mt-0.5" />
              <span className={withImage ? 'text-zinc-200' : 'text-zinc-500'}>
                generate an image
                <span className="text-zinc-500">
                  {' '}— sized for each platform below, and never cropped: the whole picture is used
                </span>
              </span>
            </label>

            {withImage && (
              <>
                <textarea
                  value={imagePrompt}
                  onChange={(e) => setImagePrompt(e.target.value)}
                  rows={3}
                  placeholder="Describe the image (optional) — e.g. a founder's desk at sunrise, laptop open, coffee, warm light, shallow depth of field. I fine-tune whatever you write before it reaches the image model."
                  className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-zinc-200 font-mono text-[11px] resize-y"
                />
                <div className="flex flex-col gap-1 pl-2 text-[10px] text-zinc-500">
                  <span>
                    {imagePrompt.trim()
                      ? 'your brief is fine-tuned under the hood (subject, setting, light, style, no text in the image), then generated'
                      : 'leave it empty and the prompt written with the copy is used'}
                  </span>
                  <span className="text-zinc-600">
                    sizes: X 1600×900 (16:9) · LinkedIn 1200×1200 (1:1) · Instagram 1080×1350 (4:5) — never the same
                    image size twice
                  </span>
                </div>
                <label className="flex items-start gap-2 cursor-pointer pl-2">
                  <input
                    type="checkbox"
                    checked={perPlatformImage}
                    onChange={(e) => setPerPlatformImage(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span className={perPlatformImage ? 'text-zinc-300' : 'text-zinc-500'}>
                    a separate image for each platform
                    <span className="text-zinc-600">
                      {' '}— the default. Each image is composed for its own frame (16:9, 1:1, 4:5), so nothing is
                      cut off. Costs one generation per platform.
                    </span>
                  </span>
                </label>
                {!perPlatformImage && count > 1 && (
                  <div className="pl-2 text-[10px] text-amber-300/80">
                    one generation for all {count} platforms: the same picture is fitted into every frame — nothing is
                    cropped, but where the shapes differ (X 16:9 vs Instagram 4:5) you get a thin blurred edge.
                  </div>
                )}
              </>
            )}
          </div>

          <div className="text-zinc-500 leading-relaxed border-t border-zinc-800 pt-3">
            {count > 1 ? (
              <>
                Creates <span className="text-zinc-300">{count} posts</span>, one per platform, each written for
                that platform and placed at its own slot on the day you pick.
              </>
            ) : (
              <>
                Created as <span className="text-zinc-300">PENDING_APPROVAL</span> at that platform's usual slot
                on the day you pick.
              </>
            )}{' '}
            {withImage && (
              <>
                {' '}With an image each
                {perPlatformImage
                  ? ' (generated separately per platform, each composed for that frame)'
                  : ' (one image, fitted into each frame)'}
                , never cropped.
              </>
            )}{' '}
            You can change any of it afterwards in the editor.
          </div>

          {error && <div className="text-red-300 bg-red-500/10 border border-red-500/40 rounded px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              onClick={submit}
              disabled={busy || count === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-mono font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {busy
                ? count > 1
                  ? `Creating ${count} posts`
                  : 'Creating'
                : count > 1
                ? `Create ${count} posts`
                : 'Create post'}
            </button>
            <button
              onClick={onClose}
              disabled={busy}
              className="px-4 py-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-mono disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
