'use client';

import React, { useState } from 'react';
import { ContentCalendar, PostItem, Platform, SocialConnection, UserSession } from '@/types';
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
  Check,
} from 'lucide-react';

interface Props {
  calendar: ContentCalendar;
  onUpdatePost: (dayIndex: number, postId: string, updatedFields: Partial<PostItem>) => void;
  onApproveBatch: () => void;
  onPublishSinglePost: (post: PostItem, opts: { keepScheduled: boolean }) => Promise<void>;
  onPublishDay: (dayIndex: number, date: string) => void;
  onDuplicatePost?: (sourcePost: PostItem, targetDate: string, targetTime: string, autoSchedule: boolean) => Promise<void>;
  availableImages?: string[];
  publishingId: string | null;
  llm?: { provider?: string; apiKey?: string; imageApiKey?: string; imageQuality?: string };
  user?: UserSession;
  connections?: SocialConnection[];
  platformStatus?: { platform: string; configured: boolean; requiredEnv: string }[];
}

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === 'TWITTER')   return <Twitter   size={13} style={{ color: '#0f172a' }} />;
  if (platform === 'LINKEDIN')  return <Linkedin  size={13} style={{ color: '#0a66c2' }} />;
  return                               <Instagram size={13} style={{ color: '#e1306c' }} />;
}

function StatusBadge({ status }: { status: PostItem['status'] }) {
  const map: Record<string, string> = {
    PENDING_APPROVAL: 'badge-pending',
    APPROVED: 'badge-approved',
    SCHEDULED: 'badge-scheduled',
    PUBLISHED: 'badge-published',
    FAILED: 'badge-failed',
  };
  const labels: Record<string, string> = {
    PENDING_APPROVAL: 'Pending',
    APPROVED: 'Approved',
    SCHEDULED: 'Scheduled',
    PUBLISHED: 'Published',
    FAILED: 'Failed',
  };
  return (
    <span className={`badge ${map[status] ?? ''}`}>
      {status === 'SCHEDULED' && <Clock size={9} />}
      {status === 'PUBLISHED' && <CheckCircle2 size={9} />}
      {labels[status] ?? status}
    </span>
  );
}

const PLATFORM_BG: Record<Platform, string> = {
  TWITTER:   '#e0f2fe',
  LINKEDIN:  '#dbeafe',
  INSTAGRAM: '#fce7f3',
};

export default function CalendarReviewBoard({
  calendar,
  onUpdatePost,
  onApproveBatch,
  onPublishSinglePost,
  onPublishDay,
  onDuplicatePost,
  availableImages,
  publishingId,
  llm,
  user,
  connections = [],
  platformStatus = [],
}: Props) {
  const [editor, setEditor] = useState<{ post: PostItem; dayIndex: number } | null>(null);
  const [confirmDispatch, setConfirmDispatch] = useState<PostItem | null>(null);

  const siblingsForDay = (dayIndex: number): PostItem[] => {
    const day = (calendar.days || []).find((d) => Number(d.dayIndex) === Number(dayIndex));
    return day ? day.posts || [] : [];
  };

  const isAllApproved = calendar.days.every((d) =>
    d.posts.every((p) => p.status === 'APPROVED' || p.status === 'SCHEDULED' || p.status === 'PUBLISHED')
  );

  return (
    <div className="space-y-4">
      {/* Batch header */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">Calendar Studio</h2>
            <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-sky-100 text-sky-800">
              3-Day Batch
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {calendar.niche || 'Multi-platform social content'} {calendar.audience ? `· Target: ${calendar.audience}` : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onApproveBatch}
            disabled={isAllApproved}
            className={`btn ${isAllApproved ? 'btn-secondary' : 'btn-success'}`}
            style={{ fontSize: 12 }}
          >
            <CheckCircle2 size={14} />
            {isAllApproved ? 'All Approved & Scheduled' : 'Approve & Schedule All 3 Days'}
          </button>
        </div>
      </div>

      {/* Day cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {calendar.days.map((day) => {
          const posts = (day.posts || [])
            .slice()
            .sort((a, b) => new Date(a.scheduledTime).getTime() - new Date(b.scheduledTime).getTime());
          const published = posts.filter((p) => p.status === 'PUBLISHED').length;
          const firstPending = posts.find((p) => p.status !== 'PUBLISHED') || posts[0];
          const openEditor = () => firstPending && setEditor({ post: firstPending, dayIndex: day.dayIndex });

          return (
            <div key={day.dayIndex} className="card" style={{ overflow: 'hidden' }}>
              {/* Day header */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 18px',
                borderBottom: '1px solid hsl(var(--border))',
                background: 'hsl(var(--bg-surface-2))',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{
                    padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: 'hsl(221 83% 53% / .1)', color: 'hsl(221 83% 45%)',
                    border: '1px solid hsl(221 83% 53% / .2)',
                  }}>
                    Day {day.dayIndex}
                  </span>
                  <span style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>{day.date}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))' }}>
                    {day.theme}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {published > 0 && (
                    <span style={{ fontSize: 11, color: 'hsl(142 55% 35%)' }}>
                      {published}/{posts.length} live
                    </span>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); onPublishDay(day.dayIndex, day.date); }}
                    className="btn btn-sm btn-secondary"
                    style={{ fontSize: 11 }}
                  >
                    <Send size={11} />
                    Publish all
                  </button>
                </div>
              </div>

              {/* Posts list */}
              <div
                role="button"
                tabIndex={0}
                onClick={openEditor}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openEditor(); }}
                style={{ cursor: 'pointer' }}
              >
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  {posts.map((post, i) => (
                    <div
                      key={post.id}
                      onClick={(e) => { e.stopPropagation(); setEditor({ post, dayIndex: day.dayIndex }); }}
                      style={{
                        display: 'flex', alignItems: 'flex-start', gap: 14,
                        padding: '14px 18px',
                        borderTop: i > 0 ? '1px solid hsl(var(--border))' : 'none',
                        transition: 'background 0.12s',
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'hsl(var(--bg-surface-2))')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      {/* Image thumbnail */}
                      {post.mediaUrl ? (
                        <img
                          src={post.mediaUrl}
                          alt={`${post.platform} visual`}
                          style={{
                            width: 72, height: 72, flexShrink: 0,
                            objectFit: 'cover', borderRadius: 8,
                            border: '1px solid hsl(var(--border))',
                          }}
                        />
                      ) : (
                        <div style={{
                          width: 72, height: 72, flexShrink: 0,
                          borderRadius: 8,
                          border: '1.5px dashed hsl(var(--border-strong))',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'hsl(var(--bg-surface-2))',
                          fontSize: 20,
                        }}>
                          🖼️
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0 }}>
                        {/* Platform + status row */}
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                          <span style={{
                            display: 'inline-flex', alignItems: 'center', gap: 5,
                            padding: '3px 8px', borderRadius: 6,
                            background: PLATFORM_BG[post.platform],
                            fontSize: 11, fontWeight: 600,
                            color: 'hsl(var(--text-primary))',
                          }}>
                            <PlatformIcon platform={post.platform} />
                            {post.platform === 'TWITTER' ? 'X / Twitter' : post.platform}
                          </span>
                          <StatusBadge status={post.status} />
                          <span style={{ fontSize: 11, color: 'hsl(var(--text-tertiary))', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={10} />
                            {new Date(post.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {post.manualExternalUrl && (
                            <a
                              href={post.manualExternalUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: 11, color: 'hsl(142 55% 35%)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                            >
                              Manual post <ExternalLink size={9} />
                            </a>
                          )}
                          {post.externalUrl && (
                            <a
                              href={post.externalUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              style={{ fontSize: 11, color: 'hsl(142 55% 35%)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                            >
                              View live <ExternalLink size={9} />
                            </a>
                          )}
                        </div>

                        {/* Content preview */}
                        <p style={{
                          fontSize: 13, color: 'hsl(var(--text-secondary))',
                          lineHeight: 1.5, overflow: 'hidden',
                          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                        }}>
                          {post.content || <span style={{ color: 'hsl(var(--text-tertiary))' }}>(empty)</span>}
                        </p>

                        {post.mediaPrompt && !post.mediaUrl && (
                          <p style={{ fontSize: 11, color: 'hsl(var(--text-tertiary))', marginTop: 4 }}>
                            💡 {post.mediaPrompt}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Footer hint */}
                <div style={{
                  padding: '10px 18px',
                  borderTop: '1px solid hsl(var(--border))',
                  background: 'hsl(var(--bg-surface-2))',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-tertiary))' }}>
                    Click to open editor — review and approve each platform
                  </span>
                  <span style={{ fontSize: 11, color: 'hsl(221 83% 53%)', fontWeight: 500 }}>
                    Open →
                  </span>
                </div>
              </div>
            </div>
          );
        })}
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
          availableImages={availableImages}
          onDuplicatePost={onDuplicatePost}
          llm={llm}
          user={user}
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
