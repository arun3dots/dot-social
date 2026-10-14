'use client';

import React, { useState } from 'react';
import { PostItem, SocialConnection } from '@/types';

interface Props {
  post: PostItem;
  /** Real connection facts, so the dialog says what will actually happen. */
  connections?: SocialConnection[];
  platformStatus?: { platform: string; configured: boolean; requiredEnv: string }[];
  onConfirm: (post: PostItem, opts: { keepScheduled: boolean }) => void;
  onCancel: () => void;
}

const fmt = (iso: string) =>
  new Date(iso).toLocaleString([], { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

/**
 * Shown before anything is dispatched to a real account. It states the consequence in the platform's
 * own terms (connected account, missing configuration, sandbox) rather than assuming success, and it
 * decides whether the post stays queued for its scheduled time.
 */
export default function DispatchConfirmDialog({
  post,
  connections = [],
  platformStatus = [],
  onConfirm,
  onCancel,
}: Props) {
  // Keep the schedule by default: a manual post should not silently cancel the scheduled one.
  const [keepScheduled, setKeepScheduled] = useState(true);

  const reality = (() => {
    const conn = connections.find((c) => c.platform === post.platform);
    const st = platformStatus.find((s) => s.platform === post.platform);
    if (conn?.connected && !conn.isSandbox) {
      return {
        willPost: true,
        text: `This goes straight to your connected ${post.platform} account (@${conn.handle}). It cannot be undone from here.`,
      };
    }
    if (conn?.connected && conn.isSandbox) {
      return {
        willPost: false,
        text: `The ${post.platform} account here is a sandbox demo account, not a real one. A dispatch will not reach ${post.platform}.`,
      };
    }
    if (st && !st.configured) {
      return {
        willPost: false,
        text: `No ${post.platform} account is connected, and ${post.platform} is not configured yet (set ${st.requiredEnv} in .env). Dispatching will fail with "no ${post.platform} account connected".`,
      };
    }
    return {
      willPost: false,
      text: `No ${post.platform} account is connected to this workspace yet. Dispatching will fail with "no ${post.platform} account connected" - connect one in Social Accounts first.`,
    };
  })();

  const mentions = post.taggedUsers?.length || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <div className="text-sm font-bold text-slate-900 font-mono">
            Post this to {post.platform} now?
          </div>
        </div>
        <div className="p-5 flex flex-col gap-3.5 text-xs text-slate-700">
          <div>
            Scheduled for <span className="text-slate-900 font-bold">{fmt(post.scheduledTime)}</span>
          </div>
          <div className="text-slate-600">
            {post.mediaUrl ? 'With its image attached.' : 'Text only — no image on this post.'}
            {mentions > 0 ? ` ${mentions} tagged mention(s).` : ''}
          </div>

          <label className="flex items-start gap-2.5 mt-1 cursor-pointer bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <input
              type="checkbox"
              checked={keepScheduled}
              onChange={(e) => setKeepScheduled(e.target.checked)}
              className="mt-0.5 rounded text-sky-600 focus:ring-sky-500"
            />
            <span className="leading-relaxed text-slate-700 text-xs">
              {keepScheduled ? (
                <>
                  Keep it scheduled — it will post <span className="text-amber-600 font-bold">again</span> at{' '}
                  {fmt(post.scheduledTime)}
                  <br />
                  <span className="text-slate-400 text-[11px]">Uncheck to post once now and take it out of the schedule</span>
                </>
              ) : (
                <>
                  Post <span className="text-slate-900 font-bold">once</span> now and take it out of the schedule (nothing will
                  be posted at {fmt(post.scheduledTime)})
                  <br />
                  <span className="text-slate-400 text-[11px]">Tick to keep it queued as well</span>
                </>
              )}
            </span>
          </label>

          <div
            className={`leading-relaxed border-t border-slate-100 pt-3 text-xs ${
              reality.willPost ? 'text-slate-500' : 'text-amber-600 font-medium'
            }`}
          >
            {reality.text}
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirm(post, { keepScheduled })}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors shadow-xs"
            >
              Post now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
