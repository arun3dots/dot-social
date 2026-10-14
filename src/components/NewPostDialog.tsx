'use client';

import React, { useState } from 'react';
import { Platform, PostItem } from '@/types';
import { Check, Loader2, Plus, Twitter, Linkedin, Instagram } from 'lucide-react';

interface Props {
  /** Pre-filled date, YYYY-MM-DD (the day that was clicked, or today). */
  initialDate: string;
  /** Day index when the date belongs to a day the calendar already knows. */
  dayIndex?: number;
  availablePosts?: PostItem[];
  onAddPost: (args: {
    dayIndex?: number;
    date: string;
    platforms: Platform[];
    generateContent: boolean;
    content?: string;
    generateImage?: boolean;
    imagePrompt?: string;
    imagePerPlatform?: boolean;
    mediaUrl?: string;
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
export default function NewPostDialog({ initialDate, dayIndex, availablePosts = [], onAddPost, onCreated, onClose }: Props) {
  const [date, setDate] = useState(initialDate);
  const [platforms, setPlatforms] = useState<Platform[]>(['LINKEDIN']);
  const [mode, setMode] = useState<'generate' | 'write' | 'blank' | 'reuse'>('generate');
  const [content, setContent] = useState('');
  const [reusedMediaUrl, setReusedMediaUrl] = useState<string | null>(null);
  const [selectedPostId, setSelectedPostId] = useState<string>('');
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

  const handleSelectReusePost = (postId: string) => {
    setSelectedPostId(postId);
    const found = availablePosts.find((p) => p.id === postId);
    if (found) {
      setContent(found.content || '');
      setReusedMediaUrl(found.mediaUrl || null);
      if (found.platform && !platforms.includes(found.platform)) {
        setPlatforms([found.platform]);
      }
    }
  };

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
        content: (mode === 'write' || mode === 'reuse') ? content : undefined,
        generateImage: mode === 'reuse' ? false : withImage,
        imagePrompt: mode !== 'reuse' && withImage && imagePrompt.trim() ? imagePrompt.trim() : undefined,
        imagePerPlatform: mode !== 'reuse' && withImage && perPlatformImage,
        mediaUrl: mode === 'reuse' && reusedMediaUrl ? reusedMediaUrl : undefined,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center gap-2.5 bg-white">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Plus size={15} />
          </div>
          <span className="text-base font-semibold text-slate-900">New post</span>
        </div>

        <div className="p-6 flex flex-col gap-4 text-xs text-slate-700">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Day</span>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
            />
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Platforms (pick any — one post each)</span>
              <button
                onClick={() => setPlatforms(platforms.length === PLATFORMS.length ? [] : [...PLATFORMS])}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
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
                    className={`flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl border text-left transition-colors ${
                      on ? 'bg-blue-50/80 border-blue-200' : 'bg-white border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <span
                      className={`w-4 h-4 flex items-center justify-center rounded border ${
                        on ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {on && <Check size={10} />}
                    </span>
                    <PlatformIcon platform={p} size={13} />
                    <span className={`font-medium ${on ? 'text-slate-900' : 'text-slate-600'}`}>{p}</span>
                    <span className="text-[10px] text-slate-400 ml-auto text-right">{PLATFORM_NOTE[p]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Copy</span>
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
                  ...(availablePosts.length > 0
                    ? [{ id: 'reuse', label: 'reuse already generated post & image' }]
                    : []),
                ] as const
              ).map((m) => (
                <label key={m.id} className="flex items-start gap-2 cursor-pointer">
                  <input
                    type="radio"
                    checked={mode === m.id}
                    onChange={() => {
                      setMode(m.id as any);
                      if (m.id === 'reuse' && !selectedPostId && availablePosts.length > 0) {
                        handleSelectReusePost(availablePosts[0].id);
                      }
                    }}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <span className={mode === m.id ? 'text-slate-900 font-medium' : 'text-slate-600'}>{m.label}</span>
                </label>
              ))}
            </div>

            {mode === 'reuse' && (
              <div className="flex flex-col gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200 mt-1">
                <span className="text-[11px] font-semibold text-slate-700">Select Generated Post to Reuse:</span>
                <select
                  value={selectedPostId}
                  onChange={(e) => handleSelectReusePost(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                >
                  {availablePosts.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.platform}] {p.content ? (p.content.slice(0, 55) + (p.content.length > 55 ? '…' : '')) : 'No copy'} {p.mediaUrl ? '🖼️ (has image)' : ''}
                    </option>
                  ))}
                </select>
                {reusedMediaUrl && (
                  <div className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200">
                    <img
                      src={reusedMediaUrl}
                      alt="Reused media"
                      className="w-12 h-12 object-cover rounded-md border border-slate-200 shrink-0"
                    />
                    <div className="flex flex-col text-[11px] overflow-hidden">
                      <span className="font-semibold text-slate-800">Attached image will be preserved</span>
                      <span className="text-slate-400 truncate">{reusedMediaUrl}</span>
                    </div>
                  </div>
                )}
                <textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  placeholder="Post content..."
                  className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y"
                />
              </div>
            )}

            {mode === 'write' && (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={5}
                placeholder="Write the post here, or leave it to edit after creating."
                className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y transition-all"
              />
            )}
          </div>

          {mode === 'reuse' && reusedMediaUrl && (
            <div className="flex items-center gap-2 border-t border-slate-100 pt-3 text-xs text-emerald-700 bg-emerald-50/60 p-2.5 rounded-xl border border-emerald-200">
              <Check size={14} className="text-emerald-600 shrink-0" />
              <span>Reusing existing generated image. No new generation required.</span>
            </div>
          )}

          {mode !== 'reuse' && (
            <div className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Image</span>
                <span className="text-[10px] text-slate-400">quality set in Settings (~$0.01/image at low)</span>
              </div>
              <label className="flex items-start gap-2 cursor-pointer">
                <input type="checkbox" checked={withImage} onChange={(e) => setWithImage(e.target.checked)} className="mt-0.5 rounded text-blue-600 focus:ring-blue-500" />
                <span className={withImage ? 'text-slate-900 font-medium' : 'text-slate-600'}>
                  generate an image
                  <span className="text-slate-400 font-normal">
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
                    className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-900 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 resize-y transition-all"
                  />
                  <div className="flex flex-col gap-1 pl-2 text-[11px] text-slate-500">
                    <span>
                      {imagePrompt.trim()
                        ? 'your brief is fine-tuned under the hood (subject, setting, light, style, no text in the image), then generated'
                        : 'leave it empty and the prompt written with the copy is used'}
                    </span>
                    <span className="text-slate-400 text-[10px]">
                      sizes: X 1600×900 (16:9) · LinkedIn 1200×1200 (1:1) · Instagram 1080×1350 (4:5) — never the same
                      image size twice
                    </span>
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer pl-2">
                    <input
                      type="checkbox"
                      checked={perPlatformImage}
                      onChange={(e) => setPerPlatformImage(e.target.checked)}
                      className="mt-0.5 rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className={perPlatformImage ? 'text-slate-900 font-medium' : 'text-slate-600'}>
                      a separate image for each platform
                      <span className="text-slate-400 font-normal">
                        {' '}— the default. Each image is composed for its own frame (16:9, 1:1, 4:5), so nothing is
                        cut off. Costs one generation per platform.
                      </span>
                    </span>
                  </label>
                  {!perPlatformImage && count > 1 && (
                    <div className="pl-2 text-[11px] text-amber-600 font-medium">
                      one generation for all {count} platforms: the same picture is fitted into every frame — nothing is
                      cropped, but where the shapes differ (X 16:9 vs Instagram 4:5) you get a thin blurred edge.
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <div className="text-slate-500 text-xs leading-relaxed border-t border-slate-100 pt-3">
            {count > 1 ? (
              <>
                Creates <span className="text-slate-900 font-medium">{count} posts</span>, one per platform, each written for
                that platform and placed at its own slot on the day you pick.
              </>
            ) : (
              <>
                Created as <span className="text-slate-900 font-medium">PENDING_APPROVAL</span> at that platform's usual slot
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

          {error && <div className="text-xs font-medium text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 bg-slate-50/50 -mx-6 -mb-6 px-6 py-4 rounded-b-2xl">
            <button
              onClick={submit}
              disabled={busy || count === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
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
              className="px-4 py-2 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-medium shadow-sm transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
