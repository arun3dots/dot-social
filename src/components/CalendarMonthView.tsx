'use client';

import React, { useMemo, useState } from 'react';
import { ContentCalendar, PostItem, Platform, SocialConnection, UserSession } from '@/types';
import PostEditorModal from '@/components/PostEditorModal';
import DispatchConfirmDialog from '@/components/DispatchConfirmDialog';
import NewPostDialog from '@/components/NewPostDialog';
import { ChevronLeft, ChevronRight, Plus, Loader2, Pencil, Send, Trash2, Check, Twitter, Linkedin, Instagram, Sparkles } from 'lucide-react';

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
    generateImage?: boolean;
    imagePrompt?: string;
    imagePerPlatform?: boolean;
    mediaUrl?: string;
  }) => Promise<{ ok: boolean; note: string; posts?: PostItem[]; dayIndex?: number }>;
  onDeletePost?: (postId: string) => Promise<{ ok: boolean; note: string }>;
  onDuplicatePost?: (sourcePost: PostItem, targetDate: string, targetTime: string, autoSchedule: boolean) => Promise<void>;
  availableImages?: string[];
  publishingId: string | null;
  llm?: { provider?: string; apiKey?: string; imageApiKey?: string; imageQuality?: string };
  user?: UserSession;
  connections?: SocialConnection[];
  platformStatus?: { platform: string; configured: boolean; requiredEnv: string }[];
  onGenerateFirstPosts?: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  PENDING_APPROVAL: 'bg-amber-50 text-amber-700 border-amber-200',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  SCHEDULED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  PUBLISHED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
};

const PLATFORMS: Platform[] = ['LINKEDIN', 'TWITTER', 'INSTAGRAM'];

function PlatformIcon({ platform, size = 11 }: { platform: Platform; size?: number }) {
  if (platform === 'TWITTER') return <Twitter size={size} className="text-slate-800" />;
  if (platform === 'LINKEDIN') return <Linkedin size={size} className="text-blue-600" />;
  return <Instagram size={size} className="text-pink-600" />;
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
  onDuplicatePost,
  availableImages,
  publishingId,
  llm,
  user,
  connections = [],
  platformStatus = [],
  onGenerateFirstPosts,
}: Props) {
  const { allAvailableImages, allAvailablePosts } = useMemo(() => {
    const images = new Set<string>();
    const posts: PostItem[] = [];
    if (availableImages) {
      availableImages.forEach((img) => images.add(img));
    }
    for (const d of calendar.days || []) {
      for (const p of d.posts || []) {
        posts.push(p);
        if (p.mediaUrl && typeof p.mediaUrl === 'string') {
          images.add(p.mediaUrl);
        }
      }
    }
    return {
      allAvailableImages: Array.from(images),
      allAvailablePosts: posts,
    };
  }, [calendar, availableImages]);

  /** Every post on a day: the group modal's tabs, and each platform's own image for the previews. */
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
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setCursor(new Date(year, month - 1, 1))}
            className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-sm transition-colors"
          >
            <ChevronLeft size={15} />
          </button>
          <div className="text-sm font-semibold text-slate-900 w-44 text-center">{monthLabel}</div>
          <button
            onClick={() => setCursor(new Date(year, month + 1, 1))}
            className="p-2 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-600 shadow-sm transition-colors"
          >
            <ChevronRight size={15} />
          </button>
          <button
            onClick={() => {
              const t = new Date();
              setCursor(new Date(t.getFullYear(), t.getMonth(), 1));
              setSelected(iso(t));
            }}
            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 shadow-sm transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => setNewPostDate(selected || todayIsoForDialog)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium shadow-sm transition-colors"
          >
            <Plus size={13} /> New post
          </button>
        </div>
        <div className="text-xs text-slate-500 font-medium">
          {monthPostCount} post(s) this month
          {outsideMonth.length > 0 ? ` · ${outsideMonth.length} day(s) outside this month` : ''}
        </div>
      </div>

      {monthPostCount === 0 && onGenerateFirstPosts && (
        <div className="bg-gradient-to-r from-sky-50 via-blue-50 to-indigo-50 border border-sky-200/90 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white border border-sky-200 flex items-center justify-center text-sky-600 shadow-2xs shrink-0">
              <Sparkles size={16} />
            </div>
            <div>
              <p className="font-bold text-slate-800">No posts scheduled for this month</p>
              <p className="text-slate-500 text-[11px]">Ready to launch automated content for Twitter, LinkedIn, and Instagram?</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onGenerateFirstPosts}
            className="px-4 py-2 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-xl text-xs shadow-sm hover:shadow transition-all flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <Sparkles size={13} className="text-sky-200" />
            <span>Click here to generate your first post contents</span>
          </button>
        </div>
      )}

      {(note || error) && (
        <div
          className={`text-xs font-medium px-3.5 py-2.5 rounded-xl border ${
            error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-blue-200 bg-blue-50 text-blue-700'
          }`}
        >
          {error || note}
        </div>
      )}

      {/* grid */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm bg-white">
        <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="px-2 py-2.5 text-center border-r border-slate-100 last:border-r-0">
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
                className={`group relative min-h-[96px] text-left align-top p-2.5 border-r border-b border-slate-100 last:border-r-0 transition-all ${
                  cell ? 'hover:bg-slate-50/80 cursor-pointer bg-white' : 'bg-slate-50/40'
                } ${isSelected ? 'bg-blue-50/40 ring-2 ring-inset ring-blue-500/30' : ''}`}
              >
                {cell && (
                  <>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`text-xs font-semibold ${
                          isToday ? 'w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center text-[11px]' : 'text-slate-600'
                        }`}
                      >
                        {Number(cell.slice(8, 10))}
                      </span>
                      <span className="flex items-center gap-1">
                        {posts.length > 0 && (
                          <span className="text-[10px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full">{posts.length}</span>
                        )}
                        <button
                          title={`Add a post on ${cell}`}
                          aria-label={`Add a post on ${cell}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelected(cell);
                            setNewPostDate(cell);
                          }}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 p-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200/60 transition-opacity"
                        >
                          <Plus size={11} />
                        </button>
                      </span>
                    </div>
                    <div className="flex flex-col gap-1">
                      {posts.map((p) => (
                        <span
                          key={p.id}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-md border text-[10px] font-medium ${
                            STATUS_STYLE[p.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                          }`}
                        >
                          <PlatformIcon platform={p.platform} size={10} />
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
      <div className="border border-slate-200 rounded-2xl bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-semibold text-slate-900">
              {selected ? new Date(`${selected}T00:00:00Z`).toDateString() : 'Pick a day'}
            </span>
            {selectedDay?.theme && (
              <span className="text-xs text-slate-500 font-medium truncate max-w-[320px] bg-white px-2 py-0.5 rounded-md border border-slate-200">{selectedDay.theme}</span>
            )}
          </div>
          <span className="text-xs text-slate-500 font-medium">
            {selectedDay ? `day ${selectedDay.dayIndex}` : 'not part of the batch yet'}
          </span>
        </div>

        {!selected ? (
          <div className="p-6 text-xs text-slate-500 text-center">Click a day to see and add posts.</div>
        ) : (
          <>
            {(() => {
              const posts = (selectedDay?.posts || [])
                .slice()
                .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
              const dayIndex = selectedDay?.dayIndex || 1;
              if (posts.length === 0) {
                return (
                  <div className="p-6 text-xs text-slate-500 text-center">No post on this day yet.</div>
                );
              }
              const published = posts.filter((p) => p.status === 'PUBLISHED').length;
              const open = (post?: PostItem) =>
                setEditor({ post: post || posts.find((p) => p.status !== 'PUBLISHED') || posts[0], dayIndex });
              return (
                /* ONE card for the day: the platforms are rows inside it, not separate posts. */
                <div className="p-5">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => open()}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') open();
                    }}
                    className="bg-white border border-slate-200 rounded-xl hover:border-blue-300 hover:shadow-md cursor-pointer transition-all overflow-hidden"
                  >
                    <div className="divide-y divide-slate-100">
                      {posts.map((post) => (
                        <div
                          key={post.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            open(post);
                          }}
                          className="p-4 flex items-start gap-4 hover:bg-slate-50/50 transition-colors"
                        >
                          {post.mediaUrl ? (
                            <img
                              src={post.mediaUrl}
                              alt={`${post.platform} visual`}
                              className="w-20 h-20 shrink-0 object-contain rounded-lg border border-slate-200 bg-slate-50"
                            />
                          ) : (
                            <div className="w-20 h-20 shrink-0 rounded-lg border border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-xs text-slate-400 text-center px-1">
                              no image
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                                <PlatformIcon platform={post.platform} size={13} /> {post.platform}
                              </span>
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-medium ${
                                  STATUS_STYLE[post.status] || 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                {post.status}
                              </span>
                              <span className="text-xs text-slate-500">
                                {new Date(post.scheduledTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </span>
                              {post.manualExternalUrl && (
                                <a
                                  href={post.manualExternalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                                >
                                  posted manually ↗
                                </a>
                              )}
                              {post.externalUrl && (
                                <a
                                  href={post.externalUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
                                >
                                  published ↗
                                </a>
                              )}
                            </div>
                            <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap line-clamp-3">
                              {post.content || <span className="text-slate-400 italic">(empty)</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between gap-3 bg-slate-50/60">
                      <span className="text-xs text-slate-500">
                        One campaign — edit, approve or dispatch each platform in tabs
                      </span>
                      <span className="text-xs font-medium text-blue-600 shrink-0">
                        {published ? `${published} of ${posts.length} live · ` : ''}Open ▸
                      </span>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* add another post on this day */}
            <div className="px-5 py-3.5 border-t border-slate-100 flex items-center gap-2 flex-wrap bg-slate-50/60">
              <span className="flex items-center gap-1 text-xs font-medium text-slate-700">
                <Plus size={12} /> Add a post on this day:
              </span>
              {PLATFORMS.map((p) => (
                <button
                  key={p}
                  onClick={() => handleAdd(p)}
                  disabled={busy === `add-${p}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 shadow-sm transition-colors disabled:opacity-50"
                >
                  {busy === `add-${p}` ? <Loader2 size={12} className="animate-spin" /> : <PlatformIcon platform={p} size={12} />}
                  {p}
                </button>
              ))}
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer ml-2">
                <input type="checkbox" checked={generateOnAdd} onChange={(e) => setGenerateOnAdd(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
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
          availablePosts={allAvailablePosts}
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
          group={postsForDay(editor.dayIndex)}
          dayIndex={editor.dayIndex}
          availableImages={allAvailableImages}
          onDuplicatePost={onDuplicatePost}
          llm={llm}
          user={user}
          onClose={() => setEditor(null)}
          onSave={(dayIndex, postId, fields) => {
            onUpdatePost(dayIndex, postId, fields);
          }}
          onApprovePost={(p) => onUpdatePost(editor.dayIndex, p.id, { status: 'APPROVED' })}
          onDispatchPost={(p) => setConfirmDispatch(p)}
          onDeletePost={(p) => handleDelete(p)}
          publishingId={publishingId}
        />
      )}
    </div>
  );
}
