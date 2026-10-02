'use client';

import React, { useState } from 'react';
import { ContentCalendar, PostItem, Platform, SocialConnection } from '@/types';
import PostEditorModal from '@/components/PostEditorModal';
import DispatchConfirmDialog from '@/components/DispatchConfirmDialog';
import {
  Calendar,
  Twitter,
  Linkedin,
  Instagram,
  CheckCircle2,
  Clock,
  Send,
  ExternalLink,
  Edit3,
  Image as ImageIcon,
  Check,
} from 'lucide-react';

interface Props {
  calendar: ContentCalendar;
  onUpdatePost: (dayIndex: number, postId: string, updatedFields: Partial<PostItem>) => void;
  onApproveBatch: () => void;
  onPublishSinglePost: (post: PostItem, opts: { keepScheduled: boolean }) => Promise<void>;
  onPublishDay: (dayIndex: number, date: string) => void;
  publishingId: string | null;
  /** Provider + BYOK key the editor uses for regenerate/suggest (never persisted). */
  llm?: { provider?: string; apiKey?: string; imageApiKey?: string; imageQuality?: string };
  /** Real connection facts, so the confirmation can say what will actually happen. */
  connections?: SocialConnection[];
  platformStatus?: { platform: string; configured: boolean; requiredEnv: string }[];
}

export default function CalendarReviewBoard({
  calendar,
  onUpdatePost,
  onApproveBatch,
  onPublishSinglePost,
  onPublishDay,
  publishingId,
  llm,
  connections = [],
  platformStatus = [],
}: Props) {
  // Full editor in a modal: text, image (regenerate/upload), hashtags, tags, schedule.
  const [editor, setEditor] = useState<{ post: PostItem; dayIndex: number } | null>(null);
  // Manual dispatch asks first: it posts to a real account immediately.
  const [confirmDispatch, setConfirmDispatch] = useState<PostItem | null>(null);

  const getPlatformIcon = (platform: Platform) => {
    switch (platform) {
      case 'TWITTER':
        return <Twitter size={14} className="text-sky-400" />;
      case 'LINKEDIN':
        return <Linkedin size={14} className="text-blue-500" />;
      case 'INSTAGRAM':
        return <Instagram size={14} className="text-pink-500" />;
    }
  };

  const getStatusBadge = (status: PostItem['status']) => {
    switch (status) {
      case 'PENDING_APPROVAL':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-amber-950/40 text-amber-400 border border-amber-800/40">
            PENDING_APPROVAL
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/40 text-cyan-400 border border-cyan-800/40">
            APPROVED
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
            <Clock size={10} /> SCHEDULED
          </span>
        );
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
            <CheckCircle2 size={10} /> PUBLISHED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
            {status}
          </span>
        );
    }
  };

  /** Every post on a day: the group modal's tabs, and each platform's own image for the previews. */
  const siblingsForDay = (dayIndex: number): PostItem[] => {
    const day = (calendar.days || []).find((d) => Number(d.dayIndex) === Number(dayIndex));
    return day ? day.posts || [] : [];
  };

  const isAllApproved = calendar.days.every((d) =>
    d.posts.every((p) => p.status === 'APPROVED' || p.status === 'SCHEDULED' || p.status === 'PUBLISHED')
  );

  return (
    <div className="mt-6">
      <div className="flex flex-wrap justify-between items-center mb-4 gap-3">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
            <Calendar size={18} className="text-cyan-400" />
            3-Day Post Approval & Scheduling Pipeline
          </h2>
          <p className="text-xs text-zinc-400">
            Human-in-the-loop review. Edit text, verify AI media assets, and approve for automated background dispatch.
          </p>
        </div>

        <button
          onClick={onApproveBatch}
          disabled={isAllApproved}
          className={`flex items-center gap-2 px-4 py-2 rounded text-xs font-mono font-medium transition-all ${
            isAllApproved
              ? 'bg-zinc-800 text-zinc-400 border border-zinc-700 cursor-default'
              : 'bg-emerald-600 hover:bg-emerald-500 text-black font-semibold shadow-lg shadow-emerald-950/30'
          }`}
        >
          <CheckCircle2 size={15} />
          {isAllApproved ? 'Batch Approved & Scheduled' : 'Approve & Schedule All 3 Days (9 Posts)'}
        </button>
      </div>

      <div className="flex flex-col gap-5">
        {calendar.days.map((day) => (
          <div
            key={day.dayIndex}
            className="bg-[#0e121a] border border-zinc-800 rounded-lg p-4 shadow-xl"
          >
            <div className="flex items-center justify-between gap-2.5 pb-3 mb-4 border-b border-zinc-800/80">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 font-semibold">
                  DAY {day.dayIndex}
                </span>
                <span className="font-mono text-xs text-zinc-400">{day.date}</span>
                <span className="text-xs font-semibold text-zinc-200 truncate">Theme: {day.theme}</span>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPublishDay(day.dayIndex, day.date);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-mono border border-cyan-700/60 text-cyan-300 hover:bg-cyan-950/40 transition-colors shrink-0"
              >
                <Send size={12} /> Publish all platforms
              </button>
            </div>

            {(() => {
              const posts = (day.posts || [])
                .slice()
                .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
              const published = posts.filter((p) => p.status === 'PUBLISHED').length;
              const firstPending = posts.find((p) => p.status !== 'PUBLISHED') || posts[0];
              const open = () => firstPending && setEditor({ post: firstPending, dayIndex: day.dayIndex });
              return (
                /* ONE card for the whole day - the platforms are rows inside it, not separate posts. */
                <div
                  role="button"
                  tabIndex={0}
                  onClick={open}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') open();
                  }}
                  className="bg-[#07090e] border border-zinc-800/80 rounded-md hover:border-cyan-800/60 cursor-pointer transition-colors"
                >
                  <div className="divide-y divide-zinc-800/80">
                    {posts.map((post) => (
                      <div
                        key={post.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditor({ post, dayIndex: day.dayIndex });
                        }}
                        className="p-3.5 flex items-start gap-3.5 hover:bg-zinc-900/40"
                      >
                        {post.mediaUrl ? (
                          <img
                            src={post.mediaUrl}
                            alt={`${post.platform} visual`}
                            className="w-24 h-24 shrink-0 object-contain rounded border border-zinc-800 bg-black"
                          />
                        ) : (
                          <div className="w-24 h-24 shrink-0 rounded border border-dashed border-zinc-800 flex items-center justify-center text-[9px] font-mono text-zinc-600 text-center px-1">
                            no image
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1.5">
                            {getPlatformIcon(post.platform)}
                            <span className="font-mono text-xs font-semibold text-zinc-200">{post.platform}</span>
                            {getStatusBadge(post.status)}
                            <span className="flex items-center gap-1 text-[10px] font-mono text-zinc-500">
                              <Clock size={10} />
                              {new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {Array.isArray(post.taggedUsers) && post.taggedUsers.length > 0 && (
                              <span className="text-[10px] font-mono text-cyan-400/80">
                                tags: {post.taggedUsers.map((t) => t.name || t.urn).join(', ')}
                              </span>
                            )}
                            {post.manualExternalUrl && (
                              <a
                                href={post.manualExternalUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 hover:text-emerald-300"
                              >
                                posted manually
                                {post.manualPublishedAt
                                  ? ` ${new Date(post.manualPublishedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                                  : ''}{' '}
                                <ExternalLink size={9} />
                              </a>
                            )}
                            {post.externalUrl && (
                              <a
                                href={post.externalUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 hover:text-emerald-300"
                              >
                                live post <ExternalLink size={9} />
                              </a>
                            )}
                          </div>

                          <div
                            className={`text-xs whitespace-pre-wrap leading-relaxed text-zinc-300 line-clamp-3 ${
                              post.platform === 'TWITTER' ? 'font-mono' : ''
                            }`}
                          >
                            {post.content || <span className="text-zinc-600">(empty)</span>}
                          </div>

                          {post.mediaPrompt && !post.mediaUrl && (
                            <div className="mt-1.5 text-[10px] font-mono text-zinc-500 line-clamp-2">
                              💡 {post.mediaPrompt}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="px-3.5 py-2.5 border-t border-zinc-800/80 flex items-center justify-between gap-3">
                    <span className="text-[10px] font-mono text-zinc-500">
                      One campaign — open it to edit, approve or dispatch each platform in tabs
                    </span>
                    <span className="text-[10px] font-mono text-cyan-400 shrink-0">
                      {published ? `${published} of ${posts.length} live · ` : ''}Open ▸
                    </span>
                  </div>
                </div>
              );
            })()}
          </div>
        ))}
      </div>

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
          group={siblingsForDay(editor.dayIndex)}
          dayIndex={editor.dayIndex}
          llm={llm}
          onSave={onUpdatePost}
          onClose={() => setEditor(null)}
          onApprovePost={(p) => onUpdatePost(editor.dayIndex, p.id, { status: 'APPROVED' })}
          onDispatchPost={(p) => setConfirmDispatch(p)}
          publishingId={publishingId}
        />
      )}
    </div>
  );
}
