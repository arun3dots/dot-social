'use client';

import React, { useState } from 'react';
import { Platform } from '@/types';
import { specFor } from '@/lib/platformSpecs';
import { MessageCircle, Repeat2, Heart, Send, Bookmark, ThumbsUp, Globe, MoreHorizontal, BadgeCheck } from 'lucide-react';

/** Another post on the same day, for the same campaign - one per platform. */
export interface SiblingPost {
  platform: Platform;
  content?: string;
  mediaUrl?: string | null;
  status?: string;
}

interface Props {
  content: string;
  mediaUrl?: string | null;
  /**
   * The other posts on this day. Each platform gets its own post, with its own copy and its own image
   * generated for that platform's frame - so the preview must show THAT post's image when you switch
   * tabs, never the image of whichever platform happened to be open first.
   */
  siblings?: SiblingPost[];
  /** The platform this post actually belongs to (its own tab is marked "this post"). */
  ownPlatform?: Platform;
  /** Author shown in the mock, so the preview is recognisable rather than anonymous. */
  authorName?: string;
  authorHandle?: string;
  authorHeadline?: string;
  /** Default tab; falls back to the post's own platform. */
  initialPlatform?: Platform;
}

const ORDER: Platform[] = ['LINKEDIN', 'INSTAGRAM', 'TWITTER'];

const RATIO_CLASS: Record<string, string> = {
  '16:9': 'aspect-video',
  '1:1': 'aspect-square',
  '4:5': 'aspect-[4/5]',
};

function PlatformIcon({ platform, size = 12 }: { platform: Platform; size?: number }) {
  if (platform === 'TWITTER') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-sky-400">
        <path d="M18.9 2H22l-6.8 7.8L22.8 22h-6.3l-4.9-6.4L5.9 22H2.8l7.3-8.3L1.7 2h6.4l4.6 6.1L18.9 2zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20z" />
      </svg>
    );
  }
  if (platform === 'LINKEDIN') {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className="text-blue-500">
        <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.75-1.95C20.4 8.75 21 11 21 14.1V21h-4v-6.1c0-1.45-.03-3.3-2.02-3.3-2.02 0-2.33 1.57-2.33 3.2V21H9z" />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className="text-pink-400">
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" stroke="currentColor" strokeWidth="2" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" />
      <circle cx="17.6" cy="6.4" r="1.3" fill="currentColor" />
    </svg>
  );
}

/**
 * How the post will look on each platform, using the platform's own frame, image ratio and truncation.
 * The numbers under each frame (image size, characters used, hashtags) are the real ones this app
 * generates to, so the preview is a check rather than decoration.
 */
export default function PlatformPreview({
  content,
  mediaUrl,
  siblings = [],
  ownPlatform,
  authorName = 'Sobin JM',
  authorHandle = 'jmsobin',
  authorHeadline = 'Director of Engineering',
  initialPlatform,
}: Props) {
  const [tab, setTab] = useState<Platform>(initialPlatform || ownPlatform || 'LINKEDIN');
  const spec = specFor(tab);

  // What the active tab shows: this post while its own platform is up, otherwise that platform's own
  // post from the same day. Nothing falls back to the first platform's image.
  const sibling = siblings.find((s) => s.platform === tab && s.platform !== ownPlatform);
  const showingSibling = !!sibling;
  const isOwnFrame = !ownPlatform || tab === ownPlatform;
  const text = String(showingSibling ? sibling.content || '' : content || '');
  // A tab only ever shows ITS OWN platform's image. No post on that platform means no image here - not
  // another platform's picture, which is what made every tab look identical.
  const image_ = showingSibling ? sibling.mediaUrl ?? null : isOwnFrame ? mediaUrl : null;
  const hashtags = (text.match(/#[A-Za-z0-9_]+/g) || []).length;
  const over = text.length > spec.maxChars;
  const ratioClass = RATIO_CLASS[spec.ratio] || 'aspect-square';

  // Truncation the way each platform actually does it.
  const shown =
    tab === 'TWITTER'
      ? text.slice(0, spec.maxChars)
      : tab === 'LINKEDIN'
      ? text.slice(0, 210)
      : text.slice(0, 125);
  const cut = shown.length < text.length;

  const avatar = (
    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-cyan-500 to-violet-600 flex items-center justify-center text-[11px] font-bold text-black shrink-0">
      {authorName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
    </div>
  );

  const image = (className: string) =>
    image_ ? (
      <div className={`w-full overflow-hidden bg-black ${className}`}>
        <img src={image_} alt="" className="w-full h-full object-cover" />
      </div>
    ) : (
      <div className={`w-full ${className} bg-zinc-900 border border-dashed border-zinc-700 flex items-center justify-center`}>
        <span className="text-[10px] font-mono text-zinc-600">
          {showingSibling
            ? `no image on the ${spec.label} post`
            : isOwnFrame
            ? 'no image on this post'
            : `no ${spec.label} post on this day`}
        </span>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      {/* tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {ORDER.map((p) => {
          const s = specFor(p);
          return (
            <button
              key={p}
              onClick={() => setTab(p)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-mono ${
                tab === p ? 'bg-zinc-800 border-zinc-600 text-zinc-100' : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800'
              }`}
            >
              <PlatformIcon platform={p} size={11} />
              {s.label}
              {ownPlatform === p && <span className="text-[9px] text-cyan-400">this post</span>}
              {ownPlatform !== p && siblings.some((x) => x.platform === p) && (
                <span className="text-[9px] text-zinc-500">on this day</span>
              )}
            </button>
          );
        })}
      </div>

      {/* the frame */}
      <div className="rounded-lg border border-zinc-800 bg-[#0b0e14] p-3">
        {tab === 'LINKEDIN' && (
          <div className="max-w-[420px] mx-auto bg-[#1b1f23] rounded-lg overflow-hidden">
            <div className="p-3 flex items-start gap-2">
              {avatar}
              <div className="min-w-0">
                <div className="text-[11px] text-zinc-100 font-semibold flex items-center gap-1">
                  {authorName} <BadgeCheck size={11} className="text-blue-400" />
                </div>
                <div className="text-[9px] text-zinc-400 truncate">{authorHeadline}</div>
                <div className="text-[9px] text-zinc-500 flex items-center gap-1">
                  2h · <Globe size={9} />
                </div>
              </div>
              <MoreHorizontal size={13} className="text-zinc-500 ml-auto" />
            </div>
            <div className="px-3 pb-2 text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed">
              {shown}
              {cut && <span className="text-zinc-400"> …see more</span>}
            </div>
            {image(ratioClass)}
            <div className="px-3 py-2 flex items-center justify-between text-[9px] text-zinc-400 border-b border-zinc-700">
              <span className="flex items-center gap-1">
                <span className="w-3.5 h-3.5 rounded-full bg-blue-500 flex items-center justify-center">
                  <ThumbsUp size={8} className="text-white" />
                </span>
                128
              </span>
              <span>24 comments · 6 reposts</span>
            </div>
            <div className="px-3 py-2 flex items-center justify-between text-[10px] text-zinc-400">
              <span className="flex items-center gap-1">
                <ThumbsUp size={11} /> Like
              </span>
              <span className="flex items-center gap-1">
                <MessageCircle size={11} /> Comment
              </span>
              <span className="flex items-center gap-1">
                <Repeat2 size={11} /> Repost
              </span>
              <span className="flex items-center gap-1">
                <Send size={11} /> Send
              </span>
            </div>
          </div>
        )}

        {tab === 'INSTAGRAM' && (
          <div className="max-w-[400px] mx-auto bg-black border border-zinc-800 rounded-lg overflow-hidden">
            <div className="px-3 py-2 flex items-center gap-2">
              <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-violet-600">
                <div className="w-8 h-8 rounded-full bg-black flex items-center justify-center text-[10px] font-bold text-white">
                  {authorName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                </div>
              </div>
              <span className="text-[11px] text-zinc-100">{authorHandle}</span>
              <MoreHorizontal size={13} className="text-zinc-400 ml-auto" />
            </div>
            {/* Instagram puts the image above the caption */}
            {image(ratioClass)}
            <div className="px-3 py-2 flex items-center gap-3 text-zinc-300">
              <Heart size={14} />
              <MessageCircle size={14} />
              <Send size={14} />
              <Bookmark size={14} className="ml-auto" />
            </div>
            <div className="px-3 pb-3 text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed">
              <span className="text-zinc-100 font-semibold mr-1">{authorHandle}</span>
              {shown}
              {cut && <span className="text-zinc-500"> … more</span>}
            </div>
          </div>
        )}

        {tab === 'TWITTER' && (
          <div className="max-w-[420px] mx-auto bg-black border border-zinc-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              {avatar}
              <div className="min-w-0 flex-1">
                <div className="text-[11px] text-zinc-100 flex items-center gap-1">
                  <span className="font-semibold">{authorName}</span>
                  <BadgeCheck size={11} className="text-sky-400" />
                  <span className="text-zinc-500">@{authorHandle} · now</span>
                  <MoreHorizontal size={13} className="text-zinc-500 ml-auto" />
                </div>
                <div className="text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed mt-1">
                  {shown}
                  {cut && <span className="text-sky-400"> …Show more</span>}
                </div>
                {image(`${ratioClass} mt-2 rounded-xl border border-zinc-800`)}
                <div className="flex items-center justify-between text-[10px] text-zinc-500 mt-2 max-w-[280px]">
                  <span className="flex items-center gap-1">
                    <MessageCircle size={11} /> 12
                  </span>
                  <span className="flex items-center gap-1">
                    <Repeat2 size={11} /> 34
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart size={11} /> 210
                  </span>
                  <span className="flex items-center gap-1">
                    <Send size={11} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 text-[10px] font-mono text-zinc-500 leading-relaxed">
          {showingSibling ? (
            <>
              showing the <span className="text-zinc-300">{spec.label}</span> post on this day
              {sibling.status ? ` (${sibling.status})` : ''} — a separate post with its own copy and its own image,
              generated for this frame. Your edits below apply to the {ownPlatform ? specFor(ownPlatform).label : 'open'} post.
            </>
          ) : (
            <>
              showing <span className="text-zinc-300">this post</span>
              {ownPlatform && ownPlatform !== tab ? ` (it is a ${specFor(ownPlatform).label} post, previewed in the ${spec.label} frame)` : ''}
              {!siblings.some((s) => s.platform === tab) && ownPlatform !== tab
                ? ` — there is no ${spec.label} post on this day, so no ${spec.label} image is shown.`
                : ''}
            </>
          )}
        </div>

        {/* the real numbers, not decoration */}
        <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center gap-3 flex-wrap text-[10px] font-mono">
          <span className={over ? 'text-red-400' : 'text-zinc-400'}>
            {text.length}/{spec.maxChars} chars{over ? ' — over the limit' : ''}
          </span>
          <span className={hashtags > 8 ? 'text-amber-400' : 'text-zinc-500'}>{hashtags} hashtags</span>
          <span className="text-zinc-500">
            image {spec.imageSize[0]}×{spec.imageSize[1]} ({spec.ratio})
          </span>
          <span className="text-zinc-600">{spec.hashtags} suggested</span>
        </div>
      </div>
    </div>
  );
}
