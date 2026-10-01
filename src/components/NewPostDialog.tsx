'use client';

import React, { useState } from 'react';
import { Platform, PostItem } from '@/types';
import { Loader2, Plus, Twitter, Linkedin, Instagram } from 'lucide-react';

interface Props {
  /** Pre-filled date, YYYY-MM-DD (the day that was clicked, or today). */
  initialDate: string;
  /** Day index when the date belongs to a day the calendar already knows. */
  dayIndex?: number;
  onAddPost: (args: {
    dayIndex?: number;
    date: string;
    platform: Platform;
    generateContent: boolean;
    content?: string;
  }) => Promise<{ ok: boolean; note: string; post?: PostItem; dayIndex?: number }>;
  onCreated: (post: PostItem, dayIndex: number, note: string) => void;
  onClose: () => void;
}

const PLATFORMS: Platform[] = ['LINKEDIN', 'TWITTER', 'INSTAGRAM'];

function PlatformIcon({ platform, size = 12 }: { platform: Platform; size?: number }) {
  if (platform === 'TWITTER') return <Twitter size={size} className="text-sky-400" />;
  if (platform === 'LINKEDIN') return <Linkedin size={size} className="text-blue-400" />;
  return <Instagram size={size} className="text-pink-400" />;
}

/**
 * Create one post from the calendar view: pick the date, the platform, and whether the copy should be
 * written for you. The server mints the id and the scheduled slot.
 */
export default function NewPostDialog({ initialDate, dayIndex, onAddPost, onCreated, onClose }: Props) {
  const [date, setDate] = useState(initialDate);
  const [platform, setPlatform] = useState<Platform>('LINKEDIN');
  const [mode, setMode] = useState<'generate' | 'write' | 'blank'>('generate');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      setError('Pick a date first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await onAddPost({
        // Only claim a day index when the date has not been edited away from it.
        dayIndex: date === initialDate ? dayIndex : undefined,
        date,
        platform,
        generateContent: mode === 'generate',
        content: mode === 'write' ? content : undefined,
      });
      if (!res.ok) {
        setError(res.note);
        return;
      }
      if (res.post) onCreated(res.post, res.dayIndex ?? dayIndex ?? 1, res.note);
      else onClose();
    } finally {
      setBusy(false);
    }
  };

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

          <div className="flex flex-col gap-1.5">
            <span className="text-zinc-500">Platform</span>
            <div className="flex gap-2">
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => setPlatform(p)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded border text-[10px] font-mono ${
                    platform === p
                      ? 'bg-cyan-600 text-black border-cyan-500 font-semibold'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  <PlatformIcon platform={p} size={11} /> {p}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-zinc-500">Copy</span>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  { id: 'generate', label: 'write it for me (uses your AI model)' },
                  { id: 'write', label: 'I will write it now' },
                  { id: 'blank', label: 'start blank - edit it later' },
                ] as const
              ).map((m) => (
                <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" checked={mode === m.id} onChange={() => setMode(m.id)} />
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

          <div className="text-zinc-500 leading-relaxed border-t border-zinc-800 pt-3">
            It is created as <span className="text-zinc-300">PENDING_APPROVAL</span> at that platform's usual
            slot on the day you pick, and you can change any of it afterwards in the editor.
          </div>

          {error && <div className="text-red-300 bg-red-500/10 border border-red-500/40 rounded px-3 py-2">{error}</div>}

          <div className="flex justify-end gap-2">
            <button
              onClick={submit}
              disabled={busy}
              className="flex items-center gap-1.5 px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-mono font-semibold disabled:opacity-50"
            >
              {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
              {busy ? 'Creating' : 'Create post'}
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
