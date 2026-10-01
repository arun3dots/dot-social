'use client';

import React, { useMemo, useState } from 'react';
import { ContentCalendar, PostItem, Platform, SocialConnection } from '@/types';
import PostEditorModal from '@/components/PostEditorModal';
import DispatchConfirmDialog from '@/components/DispatchConfirmDialog';
import NewPostDialog from '@/components/NewPostDialog';
import { ChevronLeft, ChevronRight, Plus, Loader2, Pencil, Send, Trash2, Check, Twitter, Linkedin, Instagram } from 'lucide-react';

interface Props {
  calendar: ContentCalendar;
  onUpdatePost: (dayIndex: number, postId: string, updatedFields: Partial<PostItem>) => void;
  onPublishSinglePost: (post: PostItem, opts: { keepScheduled: boolean }) => Promise<void>;
  onAddPost: (args: {
    dayIndex?: number;
    date: string;
    platforms: Platform[];
    generateContent: boolean;
    content?: string;
  }) => Promise<{ ok: boolean; note: string; posts?: PostItem[]; dayIndex?: number }>;
  onDeletePost?: (postId: string) => Promise<{ ok: boolean; note: string }>;
  publishingId: string | null;
  llm?: { provider?: string; apiKey?: string; imageApiKey?: string; imageQuality?: string };
  connections?: SocialConnection[];
  platformStatus?: { platform: string; configured: boolean; requiredEnv: string }[];
}

const STATUS_STYLE: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  APPROVED: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30',
  SCHEDULED: 'bg-violet-500/15 text-violet-300 border-violet-500/30',
  PUBLISHED: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  FAILED: 'bg-red-500/15 text-red-300 border-red-500/30',
};

const PLATFORMS: Platform[] = ['LINKEDIN', 'TWITTER', 'INSTAGRAM'];

function PlatformIcon({ platform, size = 11 }: { platform: Platform; size?: number }) {
  if (platform === 'TWITTER') return <Twitter size={size} className="text-sky-400" />;
  if (platform === 'LINKEDIN') return <Linkedin size={size} className="text-blue-400" />;
  return <Instagram size={size} className="text-pink-400" />;
}

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/**
 * Month calendar view. Days come from the calendar's own dates, and every post is addressed by the id
 * the server stored, so anything done here (edit, dispatch, delete) acts on the real row.
 */
export default function CalendarMonthView({
  calendar,
  onUpdatePost,
  onPublishSinglePost,
  onAddPost,
  onDeletePost,
  publishingId,
  llm,
  connections = [],
  platformStatus = [],
}: Props) {
  /** Every post on a day, as the calendar currently holds them (used for the per-platform previews). */
  const postsForDay = (dayIndex: number): PostItem[] => {
    const day = (calendar.days || []).find((d) => Number(d.dayIndex) === Number(dayIndex));
    return day ? day.posts || [] : [];
  };

  // date -> { dayIndex, theme, posts }
  const daysByDate = useMemo(() => {
    const map = new Map<string, { dayIndex: number; theme: string; posts: PostItem[] }>();
    for (const d of calendar.days || []) {
      let date = String(d.date || '');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        // A day added after generation has no date of its own: take it from its posts.
        const p = (d.posts || []).find((x) => x.scheduledTime);
        if (p) {
          const t = new Date(p.scheduledTime);
          if (!Number.isNaN(t.getTime())) date = iso(new Date(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
        }
      }
      if (!date) continue;
      const existing = map.get(date);
      if (existing) existing.posts.push(...(d.posts || []));
      else map.set(date, { dayIndex: Number(d.dayIndex), theme: String(d.theme || ''), posts: [...(d.posts || [])] });
    }
    return map;
  }, [calendar]);

  const knownDates = useMemo(() => Array.from(daysByDate.keys()).sort(), [daysByDate]);

  const [cursor, setCursor] = useState(() => {
    const first = knownDates[0];
    const base = first ? new Date(`${first}T00:00:00Z`) : new Date();
    return new Date(base.getUTCFullYear(), base.getUTCMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(knownDates[0] || null);
  const [editor, setEditor] = useState<{ post: PostItem; dayIndex: number } | null>(null);
  const [confirmDispatch, setConfirmDispatch] = useState<PostItem | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generateOnAdd, setGenerateOnAdd] = useState(true);
  // Creating a post straight from the calendar: which date the dialog is open for (null = closed).
  const [newPostDate, setNewPostDate] = useState<string | null>(null);
  const todayIsoForDialog = iso(new Date());

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayIso = iso(new Date());

  const cells: (string | null)[] = [];
  for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(iso(new Date(year, month, d)));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleString([], { month: 'long', year: 'numeric' });
  const selectedDay = selected ? daysByDate.get(selected) : undefined;

  const monthPostCount = cells.reduce((n, c) => (c ? n + (daysByDate.get(c)?.posts.length || 0) : n), 0);
  const outsideMonth = knownDates.filter((d) => {
    const t = new Date(`${d}T00:00:00Z`);
    return t.getUTCFullYear() !== year || t.getUTCMonth() !== month;
  });

  const handleAdd = async (platform: Platform) => {
    if (!selected) return;
    setBusy(`add-${platform}`);
    setNote(null);
    setError(null);
    try {
      const res = await onAddPost({
        dayIndex: selectedDay?.dayIndex,
        date: selected,
        platforms: [platform],
        generateContent: generateOnAdd,
      });
      setNote(res.note);
      if (res.ok && res.posts && res.posts.length) {
        setEditor({ post: res.posts[0], dayIndex: res.dayIndex ?? selectedDay?.dayIndex ?? 1 });
      }
      if (!res.ok) setError(res.note);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (post: PostItem) => {
    if (!onDeletePost) return;
    setBusy(`del-${post.id}`);
    setNote(null);
    setError(null);
    try {
      const res = await onDeletePost(post.id);
      if (res.ok) setNote(res.note);
      else setError(res.note);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {/* month header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400"
          >
            <ChevronLeft size={14} />
          </button>
          <div className="text-sm font-semibold text-zinc-100 font-mono w-44 text-center">{monthLabel}</div>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400"
          >
            <ChevronRight size={14} />
          </button>
          <button
            onClick={() => {
              const t = new Date();
              setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
              setSelected(iso(t));
            }}
            className="px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-mono text-zinc-400"
          >
            Today
          </button>
          <button
            onClick={() => setNewPostDate(selected || todayIsoForDialog)}
            className="flex items-center gap-1 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-[10px] font-mono font-semibold"
          >
            <Plus size={11} /> New post
          </button>
        </div>
        <div className="text-[10px] font-mono text-zinc-500">
          {monthPostCount} post(s) this month
          {outsideMonth.length > 0 ? ` · ${outsideMonth.length} day(s) outside this month` : ''}
        </div>
      </div>

      {(note || error) && (
        <div
          className={`text-[11px] font-mono px-3 py-2 rounded border ${
            error ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-200'
          }`}
        >
          {error || note}
        </div>
      )}

      {/* grid */}
      <div className="border border-zinc-800 rounded-lg overflow-hidden">
        <div className="grid grid-cols-7 bg-zinc-900/60 text-[10px] font-mono text-zinc-500">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-2 py-1.5 text-center border-r border-zinc-800 last:border-r-0">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell, i) => {
            const day = cell ? daysByDate.get(cell) : undefined;
            const posts = day?.posts || [];
            const isToday = cell === todayIso;
            const isSelected = cell === selected;
            return (
              <div
                key={i}
                role={cell ? 'button' : undefined}
                tabIndex={cell ? 0 : undefined}
                onClick={() => cell && setSelected(cell)}
                onKeyDown={(e) => {
                  if (cell && (e.key === 'Enter' || e.key === ' ')) setSelected(cell);
                }}
                className={`group relative min-h-[86px] text-left align-top p-2 border-r border-b border-zinc-800 last:border-r-0 ${
                  cell ? 'hover:bg-zinc-900/70 cursor-pointer' : 'bg-zinc-950/40'
                } ${isSelected ? 'bg-zinc-900 ring-1 ring-inset ring-cyan-500/50' : ''}`}
              >
                {cell && (
                  <>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`text-[11px] font-mono ${
                          isToday ? 'text-cyan-400 font-bold' : 'text-zinc-500'
                        }`}
                      >
                        {Number(cell.slice(8, 10))}
                      </span>
                      <span className="flex items-center gap-1">
                        {posts.length > 0 && (
                          <span className="text-[9px] font-mono text-zinc-600">{posts.length}</span>
                        )}
                        <button
                          title={`Add a post on ${cell}`}
                          aria-label={`Add a post on ${cell}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(cell);
                            setNewPostDate(cell);
                          }}
                          className="opacity-40 group-hover:opacity-100 focus:opacity-100 p-0.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black transition-opacity"
                        >
                          <Plus size={10} />
                        </button>
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {posts.map((p) => (
                        <span
                          key={p.id}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-mono ${
                            STATUS_STYLE[p.status] || 'bg-zinc-800 text-zinc-400 border-zinc-700'
                          }`}
                        >
                          <PlatformIcon platform={p.platform} size={9} />
                          <span className="truncate">{p.platform.slice(0, 2)}</span>
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* the selected day */}
      <div className="border border-zinc-800 rounded-lg bg-[#0b0e14]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold font-mono text-zinc-100">
              {selected ? new Date(`${selected}T00:00:00Z`).toDateString() : 'Pick a day'}
            </span>
            {selectedDay?.theme && (
              <span className="text-[10px] font-mono text-zinc-500 truncate max-w-[280px]">{selectedDay.theme}</span>
            )}
          </div>
          <span className="text-[10px] font-mono text-zinc-500">
            {selectedDay ? `day ${selectedDay.dayIndex}` : 'not part of the batch yet'}
          </span>
        </div>

        {!selected ? (
          <div className="p-4 text-[11px] font-mono text-zinc-500">Click a day to see and add posts.</div>
        ) : (
          <>
            <div className="divide-y divide-zinc-800">
              {(selectedDay?.posts || []).map((post) => (
                <div key={post.id} className="p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-300">
                      <PlatformIcon platform={post.platform} size={12} /> {post.platform}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded border text-[9px] font-mono ${
                        STATUS_STYLE[post.status] || 'bg-zinc-800 text-zinc-400 border-zinc-700'
                      }`}
                    >
                      {post.status}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-500">
                      {new Date(post.scheduledTime).toLocaleString([], {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {post.mediaUrl ? (
                      <span className="text-[10px] font-mono text-zinc-500">image</span>
                    ) : (
                      <span className="text-[10px] font-mono text-amber-500/80">no image</span>
                    )}
                    {post.manualExternalUrl && (
                      <a
                        href={post.manualExternalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300"
                      >
                        posted manually ↗
                      </a>
                    )}
                    {post.externalUrl && (
                      <a
                        href={post.externalUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300"
                      >
                        published ↗
                      </a>
                    )}
                    <span className="text-[9px] font-mono text-zinc-600 ml-auto">{post.id}</span>
                  </div>
                  {post.mediaUrl && (
                    <img src={post.mediaUrl} alt="" className="w-20 h-20 object-cover rounded border border-zinc-800" />
                  )}
                  <div className="text-[11px] text-zinc-400 leading-relaxed whitespace-pre-wrap line-clamp-4">
                    {post.content || <span className="text-zinc-600">(empty)</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditor({ post, dayIndex: selectedDay?.dayIndex || 1 })}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-mono text-zinc-300"
                    >
                      <Pencil size={10} /> Edit
                    </button>
                    {post.status === 'PENDING_APPROVAL' && (
                      <button
                        onClick={() => onUpdatePost(selectedDay?.dayIndex || 1, post.id, { status: 'APPROVED' })}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-emerald-700 hover:bg-emerald-600 text-[10px] font-mono text-white"
                      >
                        <Check size={10} /> Approve
                      </button>
                    )}
                    {post.status !== 'PUBLISHED' && (
                      <button
                        onClick={() => setConfirmDispatch(post)}
                        disabled={publishingId === post.id}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-[10px] font-mono font-semibold disabled:opacity-50"
                      >
                        {publishingId === post.id ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                        Dispatch Now
                      </button>
                    )}
                    {onDeletePost && post.status !== 'PUBLISHED' && (
                      <button
                        onClick={() => handleDelete(post)}
                        disabled={busy === `del-${post.id}`}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-red-950 border border-zinc-800 hover:border-red-900 text-[10px] font-mono text-zinc-400 hover:text-red-300 disabled:opacity-50"
                      >
                        {busy === `del-${post.id}` ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {(selectedDay?.posts || []).length === 0 && (
                <div className="p-4 text-[11px] font-mono text-zinc-500">
                  No post on this day yet.
                </div>
              )}
            </div>

            {/* add another post on this day */}
            <div className="px-4 py-3 border-t border-zinc-800 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                <Plus size={11} /> Add a post on this day:
              </span>
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleAdd(p)}
                  disabled={busy === `add-${p}`}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-[10px] font-mono text-zinc-300 disabled:opacity-50"
                >
                  {busy === `add-${p}` ? <Loader2 size={10} className="animate-spin" /> : <PlatformIcon platform={p} size={10} />}
                  {p}
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-[10px] font-mono text-zinc-500 cursor-pointer">
                <input type="checkbox" checked={generateOnAdd} onChange={(e) => setGenerateOnAdd(e.target.checked)} />
                write the copy for me
              </label>
            </div>
          </>
        )}
      </div>

      {newPostDate && (
        <NewPostDialog
          initialDate={newPostDate}
          dayIndex={daysByDate.get(newPostDate)?.dayIndex}
          onAddPost={onAddPost}
          onClose={() => setNewPostDate(null)}
          onCreated={(posts, dayIndex, message) => {
            setNewPostDate(null);
            setSelected(newPostDate);
            setNote(message);
            setError(null);
            // Several platforms were created: open the editor on the first one, the rest are listed
            // in the message above and are on the day already.
            if (posts[0]) setEditor({ post: posts[0], dayIndex });
          }}
        />
      )}

      {confirmDispatch && (
        <DispatchConfirmDialog
          post={confirmDispatch}
          connections={connections}
          platformStatus={platformStatus}
          onCancel={() => setConfirmDispatch(null)}
          onConfirm={(post, opts) => {
            setConfirmDispatch(null);
            onPublishSinglePost(post, opts);
          }}
        />
      )}

      {editor && (
        <PostEditorModal
          post={editor.post}
          dayIndex={editor.dayIndex}
          siblings={postsForDay(editor.dayIndex)}
          llm={llm}
          onClose={() => setEditor(null)}
          onSave={(dayIndex, postId, fields) => {
            onUpdatePost(dayIndex, postId, fields);
          }}
        />
      )}
    </div>
  );
}
