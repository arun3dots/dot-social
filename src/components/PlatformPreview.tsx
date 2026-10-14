'use client';

import React, { useState } from 'react';
import { Platform } from '@/types';
import {
  Twitter,
  Linkedin,
  Instagram,
  ThumbsUp,
  MessageCircle,
  Repeat2,
  Heart,
  Send,
  Bookmark,
  MoreHorizontal,
  BadgeCheck,
  Globe,
} from 'lucide-react';

interface SiblingPost {
  id: string;
  platform: Platform;
  content: string;
  mediaUrl?: string | null;
  status?: string;
}

interface Props {
  content: string;
  mediaUrl?: string | null;
  siblings?: SiblingPost[];
  ownPlatform?: Platform;
  authorName?: string;
  authorHandle?: string;
  authorHeadline?: string;
  initialPlatform?: Platform;
}

const ORDER: Platform[] = ['TWITTER', 'LINKEDIN', 'INSTAGRAM'];

function specFor(p: Platform) {
  switch (p) {
    case 'TWITTER':
      return { label: 'X (Twitter)', maxChars: 280, ratio: '16:9' as const, imageSize: [1200, 675] };
    case 'LINKEDIN':
      return { label: 'LinkedIn', maxChars: 3000, ratio: '16:9' as const, imageSize: [1200, 627] };
    case 'INSTAGRAM':
      return { label: 'Instagram', maxChars: 2200, ratio: '1:1' as const, imageSize: [1080, 1080] };
  }
}

function PlatformIcon({ platform, size = 12 }: { platform: Platform; size?: number }) {
  switch (platform) {
    case 'TWITTER':
      return <Twitter size={size} className="text-sky-600" />;
    case 'LINKEDIN':
      return <Linkedin size={size} className="text-blue-600" />;
    case 'INSTAGRAM':
      return <Instagram size={size} className="text-pink-600" />;
  }
}

const RATIO_CLASS: Record<string, string> = {
  '16:9': 'aspect-[16/9]',
  '1:1': 'aspect-square',
};

/**
 * How the post will look on each platform, using the platform's own frame, image ratio and truncation.
 */
export default function PlatformPreview({
  content,
  mediaUrl,
  siblings = [],
  ownPlatform,
  authorName = 'Creator',
  authorHandle = 'creator',
  authorHeadline = 'Content Creator & Strategist',
  initialPlatform,
}: Props) {
  const [tab, setTab] = useState<Platform>(initialPlatform || ownPlatform || 'LINKEDIN');
  const spec = specFor(tab);

  const sibling = siblings.find((s) => s.platform === tab && s.platform !== ownPlatform);
  const showingSibling = !!sibling;
  const isOwnFrame = !ownPlatform || tab === ownPlatform;
  const text = String(showingSibling ? sibling.content || '' : content || '');
  const image_ = showingSibling ? sibling.mediaUrl ?? null : isOwnFrame ? mediaUrl : null;
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
    <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shrink-0 shadow-2xs">
      {authorName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
    </div>
  );

  const image = (className: string) =>
    image_ ? (
      <div className={`w-full overflow-hidden bg-slate-100 ${className}`}>
        <img src={image_} alt="" className="w-full h-full object-cover" />
      </div>
    ) : (
      <div className={`w-full ${className} bg-slate-100 border border-dashed border-slate-200 flex items-center justify-center`}>
        <span className="text-[10px] font-mono text-slate-400">
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
      {/* Platform Switcher Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {ORDER.map((p) => {
          const s = specFor(p);
          const active = tab === p;
          return (
            <button
              key={p}
              type="button"
              onClick={() => setTab(p)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
                active
                  ? 'bg-white border-slate-300 text-slate-900 shadow-xs'
                  : 'bg-slate-100/70 border-slate-200 text-slate-500 hover:bg-slate-200/60 hover:text-slate-800'
              }`}
            >
              <PlatformIcon platform={p} size={13} />
              <span>{s.label}</span>
              {ownPlatform === p && <span className="text-[10px] text-sky-600 font-bold">· current</span>}
              {ownPlatform !== p && siblings.some((x) => x.platform === p) && (
                <span className="text-[10px] text-slate-400">· on day</span>
              )}
            </button>
          );
        })}
      </div>

      {/* The Native Preview Frame (Light Mode) */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-3 sm:p-4 shadow-xs">
        {/* LINKEDIN PREVIEW */}
        {tab === 'LINKEDIN' && (
          <div className="max-w-[430px] mx-auto bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="p-3.5 flex items-start gap-2.5">
              {avatar}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-900 font-bold flex items-center gap-1">
                  <span>{authorName}</span>
                  <BadgeCheck size={13} className="text-blue-600" />
                </div>
                <div className="text-[10px] text-slate-500 truncate mt-0.5">{authorHeadline}</div>
                <div className="text-[9px] text-slate-400 flex items-center gap-1 mt-0.5">
                  <span>2h</span> · <span>Edited</span> · <Globe size={10} />
                </div>
              </div>
              <MoreHorizontal size={14} className="text-slate-400 ml-auto" />
            </div>

            <div className="px-3.5 pb-2.5 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {shown}
              {cut && <span className="text-slate-500 hover:text-blue-600 font-semibold cursor-pointer"> …see more</span>}
            </div>

            {image(ratioClass)}

            <div className="px-3.5 py-2 flex items-center justify-between text-[10px] text-slate-500 border-b border-slate-100">
              <span className="flex items-center gap-1">
                <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px]">
                  👍
                </span>
                <span className="font-medium ml-0.5">148</span>
              </span>
              <span>24 comments · 6 reposts</span>
            </div>

            <div className="px-3.5 py-2 flex items-center justify-between text-[11px] text-slate-600">
              <span className="flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                <ThumbsUp size={12} /> Like
              </span>
              <span className="flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                <MessageCircle size={12} /> Comment
              </span>
              <span className="flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                <Repeat2 size={12} /> Repost
              </span>
              <span className="flex items-center gap-1 hover:text-slate-900 cursor-pointer">
                <Send size={12} /> Send
              </span>
            </div>
          </div>
        )}

        {/* INSTAGRAM PREVIEW */}
        {tab === 'INSTAGRAM' && (
          <div className="max-w-[400px] mx-auto bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
            <div className="px-3.5 py-2.5 flex items-center gap-2.5">
              <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 shrink-0">
                <div className="w-7 h-7 rounded-full bg-white border border-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-800">
                  {authorName.split(' ').map((w) => w[0]).join('').slice(0, 2)}
                </div>
              </div>
              <span className="text-xs font-bold text-slate-900">{authorHandle}</span>
              <MoreHorizontal size={14} className="text-slate-400 ml-auto cursor-pointer" />
            </div>

            {image(ratioClass)}

            <div className="px-3.5 pt-2.5 pb-1 flex items-center gap-3.5 text-slate-700">
              <Heart size={16} className="hover:text-pink-600 cursor-pointer transition-colors" />
              <MessageCircle size={16} className="hover:text-slate-900 cursor-pointer transition-colors" />
              <Send size={16} className="hover:text-slate-900 cursor-pointer transition-colors" />
              <Bookmark size={16} className="ml-auto hover:text-slate-900 cursor-pointer transition-colors" />
            </div>

            <div className="px-3.5 pb-3 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              <span className="font-bold text-slate-900 mr-1.5">{authorHandle}</span>
              {shown}
              {cut && <span className="text-slate-400 hover:text-pink-600 cursor-pointer font-medium"> … more</span>}
            </div>
          </div>
        )}

        {/* TWITTER PREVIEW */}
        {tab === 'TWITTER' && (
          <div className="max-w-[430px] mx-auto bg-white border border-slate-200 rounded-xl shadow-xs p-3.5">
            <div className="flex items-start gap-2.5">
              {avatar}
              <div className="min-w-0 flex-1">
                <div className="text-xs text-slate-900 flex items-center gap-1">
                  <span className="font-bold hover:underline cursor-pointer">{authorName}</span>
                  <BadgeCheck size={13} className="text-sky-500" />
                  <span className="text-[11px] text-slate-500">@{authorHandle} · now</span>
                  <MoreHorizontal size={14} className="text-slate-400 ml-auto cursor-pointer" />
                </div>
                <div className="text-xs text-slate-800 whitespace-pre-wrap leading-relaxed mt-1">
                  {shown}
                  {cut && <span className="text-sky-600 hover:underline cursor-pointer font-medium"> …Show more</span>}
                </div>
                {image(`${ratioClass} mt-2.5 rounded-xl border border-slate-200`)}
                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2.5 max-w-[280px]">
                  <span className="flex items-center gap-1 hover:text-sky-600 cursor-pointer transition-colors">
                    <MessageCircle size={13} /> 12
                  </span>
                  <span className="flex items-center gap-1 hover:text-emerald-600 cursor-pointer transition-colors">
                    <Repeat2 size={13} /> 34
                  </span>
                  <span className="flex items-center gap-1 hover:text-pink-600 cursor-pointer transition-colors">
                    <Heart size={13} /> 210
                  </span>
                  <span className="flex items-center gap-1 hover:text-sky-600 cursor-pointer transition-colors">
                    <Send size={13} />
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 text-[10px] text-slate-400 leading-relaxed font-sans">
          {showingSibling ? (
            <>
              Previewing the <span className="font-semibold text-slate-600">{spec.label}</span> post on this day
              {sibling.status ? ` (${sibling.status})` : ''} — formatted with native platform frame, truncation & aspect ratio.
            </>
          ) : (
            <>
              Previewing <span className="font-semibold text-slate-600">this post</span>
              {ownPlatform && ownPlatform !== tab ? ` (${specFor(ownPlatform).label} copy previewed in ${spec.label} frame)` : ''}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
