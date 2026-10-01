'use client';

import React, { useState } from 'react';
import { ContentCalendar, PostItem, Platform } from '@/types';
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
  onPublishSinglePost: (post: PostItem) => Promise<void>;
  publishingId: string | null;
}

export default function CalendarReviewBoard({
  calendar,
  onUpdatePost,
  onApproveBatch,
  onPublishSinglePost,
  publishingId,
}: Props) {
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

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

  const startEdit = (post: PostItem) => {
    setEditingPostId(post.id);
    setEditContent(post.content);
  };

  const saveEdit = (dayIndex: number, postId: string) => {
    onUpdatePost(dayIndex, postId, { content: editContent });
    setEditingPostId(null);
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
            <div className="flex items-center gap-2.5 pb-3 mb-4 border-b border-zinc-800/80">
              <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/40 text-cyan-400 border border-cyan-800/40 font-semibold">
                DAY {day.dayIndex}
              </span>
              <span className="font-mono text-xs text-zinc-400">{day.date}</span>
              <span className="text-xs font-semibold text-zinc-200">Theme: {day.theme}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {day.posts.map((post) => {
                const isEditing = editingPostId === post.id;
                const isPublishingThis = publishingId === post.id;

                return (
                  <div
                    key={post.id}
                    className="bg-[#07090e] border border-zinc-800/80 rounded-md p-3.5 flex flex-col justify-between hover:border-zinc-700 transition-colors"
                  >
                    <div>
                      <div className="flex justify-between items-center mb-2.5">
                        <div className="flex items-center gap-1.5">
                          {getPlatformIcon(post.platform)}
                          <span className="font-mono text-xs font-semibold text-zinc-200">
                            {post.platform}
                          </span>
                        </div>
                        {getStatusBadge(post.status)}
                      </div>

                      {post.mediaUrl && (
                        <div className="mb-2.5 rounded overflow-hidden border border-zinc-800 relative h-28 bg-black">
                          <img
                            src={post.mediaUrl}
                            alt="AI generated visual"
                            className="w-full h-full object-cover opacity-90"
                          />
                          <div className="absolute bottom-1.5 left-1.5 text-[10px] font-mono bg-black/80 px-2 py-0.5 rounded text-zinc-300 flex items-center gap-1">
                            <ImageIcon size={10} /> AI Visual Ready
                          </div>
                        </div>
                      )}

                      {post.mediaPrompt && !post.mediaUrl && (
                        <div className="mb-2.5 p-2 bg-zinc-900 border border-zinc-800 rounded text-[11px] text-zinc-400 font-mono">
                          💡 Visual Prompt: {post.mediaPrompt}
                        </div>
                      )}

                      {isEditing ? (
                        <div className="mb-2.5">
                          <textarea
                            className="w-full bg-[#0b0e14] border border-zinc-700 rounded p-2 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500"
                            rows={5}
                            value={editContent}
                            onChange={(e) => setEditContent(e.target.value)}
                          />
                          <div className="flex gap-2 mt-2">
                            <button
                              onClick={() => saveEdit(day.dayIndex, post.id)}
                              className="px-2.5 py-1 rounded bg-cyan-600 text-black font-mono text-xs font-semibold flex items-center gap-1"
                            >
                              <Check size={12} /> Save
                            </button>
                            <button
                              onClick={() => setEditingPostId(null)}
                              className="px-2.5 py-1 rounded bg-zinc-800 text-zinc-300 font-mono text-xs"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div
                          className={`text-xs whitespace-pre-wrap leading-relaxed text-zinc-200 mb-3 ${
                            post.platform === 'TWITTER' ? 'font-mono' : ''
                          }`}
                        >
                          {post.content}
                        </div>
                      )}
                    </div>

                    <div className="border-t border-zinc-800/80 pt-2.5 mt-2">
                      <div className="flex items-center gap-1.5 text-[11px] text-zinc-400 font-mono mb-2.5">
                        <Clock size={12} />
                        <span>
                          Scheduled:{' '}
                          {new Date(post.scheduledTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {post.externalUrl ? (
                        <a
                          href={post.externalUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="w-full py-1.5 px-3 rounded bg-zinc-900 border border-zinc-700 text-cyan-400 hover:text-cyan-300 font-mono text-xs flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <ExternalLink size={12} />
                          View Live/Mock Post
                        </a>
                      ) : (
                        <div className="flex gap-1.5">
                          {!isEditing && (
                            <button
                              onClick={() => startEdit(post)}
                              className="flex-1 py-1.5 px-2 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-mono text-xs flex items-center justify-center gap-1 border border-zinc-700"
                            >
                              <Edit3 size={11} /> Edit
                            </button>
                          )}

                          {post.status === 'PENDING_APPROVAL' && (
                            <button
                              onClick={() => onUpdatePost(day.dayIndex, post.id, { status: 'APPROVED' })}
                              className="flex-1 py-1.5 px-2 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-400 font-mono text-xs flex items-center justify-center gap-1 border border-emerald-800/50"
                            >
                              <Check size={11} /> Approve
                            </button>
                          )}

                          <button
                            onClick={() => onPublishSinglePost(post)}
                            disabled={isPublishingThis}
                            className="py-1.5 px-3 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-semibold font-mono text-xs flex items-center justify-center gap-1 transition-all"
                            title="Force instantaneous dispatch for live validation"
                          >
                            <Send size={11} />
                            {isPublishingThis ? 'Dispatching...' : 'Dispatch Now'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
