'use client';

import React, { useState, useEffect } from 'react';
import { ContentCalendar, PostItem, SocialConnection, Platform } from '@/types';
import {
  RotateCcw,
  RotateCw,
  Plus,
  Minus,
  Mail,
  UserCheck,
  Send,
  MessageSquare,
  Bell,
  Sparkles,
  ExternalLink,
  CheckCircle2,
  Clock,
  Layers,
  Calendar,
  X,
  Zap,
  Check,
  Twitter,
  Linkedin,
  Instagram,
  Pencil,
  Eye,
  Maximize2,
  Share2,
  RefreshCw,
  AlertCircle,
  Smartphone,
  LayoutGrid,
  ChevronRight,
  TrendingUp,
  Image as ImageIcon,
  SlidersHorizontal,
  ThumbsUp,
  MessageCircle,
  Repeat2,
  Heart,
  Bookmark,
  Globe,
  MoreHorizontal,
  BadgeCheck,
  BarChart2,
} from 'lucide-react';

interface Props {
  calendar: ContentCalendar | null;
  onOpenEditor: (post: PostItem, dayIndex: number) => void;
  onQuickGenerate: () => void;
  onSelectView?: (view: 'canvas' | 'board' | 'calendar' | 'config') => void;
  onApproveBatch?: () => void;
  onOpenConfigModal?: (modal: 'niche' | 'llm' | 'settings' | 'channels') => void;
  onUpdatePost?: (dayIndex: number, postId: string, fields: Partial<PostItem>) => void;
  onPublishSinglePost?: (post: PostItem, opts?: { keepScheduled?: boolean }) => Promise<void>;
  publishingId?: string | null;
  isGenerating: boolean;
  connections: SocialConnection[];
}

const PLATFORM_CONFIG: Record<
  Platform,
  {
    name: string;
    icon: any;
    color: string;
    bg: string;
    border: string;
    maxChars: number;
    badgeBg: string;
    badgeText: string;
  }
> = {
  TWITTER: {
    name: 'X (Twitter)',
    icon: Twitter,
    color: '#0284c7',
    bg: '#f0f9ff',
    border: '#bae6fd',
    maxChars: 280,
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
  },
  LINKEDIN: {
    name: 'LinkedIn',
    icon: Linkedin,
    color: '#0a66c2',
    bg: '#eff6ff',
    border: '#bfdbfe',
    maxChars: 3000,
    badgeBg: 'bg-blue-100',
    badgeText: 'text-blue-800',
  },
  INSTAGRAM: {
    name: 'Instagram',
    icon: Instagram,
    color: '#e1306c',
    bg: '#fdf2f8',
    border: '#fbcfe8',
    maxChars: 2200,
    badgeBg: 'bg-pink-100',
    badgeText: 'text-pink-800',
  },
};

export default function WorkflowCanvas({
  calendar,
  onOpenEditor,
  onQuickGenerate,
  onSelectView,
  onApproveBatch,
  onOpenConfigModal,
  onUpdatePost,
  onPublishSinglePost,
  publishingId,
  isGenerating,
  connections,
}: Props) {
  const [zoomLevel, setZoomLevel] = useState(100);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number | 'all'>(1);
  const [viewMode, setViewMode] = useState<'graph' | 'pipeline'>('graph');
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [showAddStepModal, setShowAddStepModal] = useState(false);
  const [showAbModal, setShowAbModal] = useState(false);
  const [showEventModal, setShowEventModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string; prompt?: string } | null>(null);

  // Auto-detect mobile screen on mount to provide optimal default
  useEffect(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      setViewMode('pipeline');
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(140, Math.max(60, prev + delta)));
  };

  const fitToScreen = () => {
    if (typeof window !== 'undefined') {
      const containerWidth = window.innerWidth > 1024 ? window.innerWidth - 600 : window.innerWidth - 32;
      const targetZoom = Math.min(100, Math.max(65, Math.floor((containerWidth / 560) * 100)));
      setZoomLevel(targetZoom);
      showToast(`Canvas fit to screen (${targetZoom}%)`);
    }
  };

  // Dynamic multi-platform fallback posts per day (demonstrating 1 theme -> 3 native formats)
  const getFallbackPosts = (dayNum: number) => {
    if (dayNum === 2) {
      return {
        theme: 'Why 90% of AI Workflows Break in Production',
        twitter: {
          id: 'demo-tw-2',
          platform: 'TWITTER' as Platform,
          content: 'Why 90% of AI automations fail in production:\n\n1. Fragile JSON schema parsing\n2. Missing rate-limit backoffs\n3. Zero human review gates\n\nFix these 3 before scaling. What is your biggest failure point? #dev #saas',
          status: 'PENDING_APPROVAL' as const,
          scheduledTime: new Date(Date.now() + 3600000 * 26).toISOString(),
          mediaUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
          mediaPrompt: 'Futuristic observability dashboard showing automated error rates and pipeline metrics',
        },
        linkedin: {
          id: 'demo-li-2',
          platform: 'LINKEDIN' as Platform,
          content: 'We tested 40+ generative AI pipelines across production workloads. Here is what actually broke:\n\n1. Prompt drift across model version updates\n2. Rate limits silently dropping webhook payloads\n3. Lack of asynchronous queue workers\n\nWhen we introduced BullMQ with circuit breakers and presigned media uploads, our failure rate dropped from 14% to 0.2%.\n\nEngineering resilience matters more than prompt novelty. How does your team handle failure gates in AI agents?',
          status: 'PENDING_APPROVAL' as const,
          scheduledTime: new Date(Date.now() + 3600000 * 28).toISOString(),
          mediaUrl: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&auto=format&fit=crop&q=80',
          mediaPrompt: 'Clean minimalist systems architecture diagram on a dark glass background',
        },
        instagram: {
          id: 'demo-ig-2',
          platform: 'INSTAGRAM' as Platform,
          content: 'Why your AI automations keep breaking (and how to fix them today) 🛠️\n\nSwipe through for our 3-step production checklist:\n\n🔒 Use structured JSON schemas\n⚡ Add Redis queue retries\n👀 Include one-click approval gates\n\nBookmark this post before your next deployment! 🚀 #developer #automation #systemdesign #coding',
          status: 'PENDING_APPROVAL' as const,
          scheduledTime: new Date(Date.now() + 3600000 * 30).toISOString(),
          mediaUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=600&auto=format&fit=crop&q=80',
          mediaPrompt: 'Cyberpunk coding terminal screen with glowing green and cyan debug text',
        },
      };
    }

    if (dayNum === 3) {
      return {
        theme: 'From 12h/Week Ops to Autonomous Publishing: A 7-Day Case Study',
        twitter: {
          id: 'demo-tw-3',
          platform: 'TWITTER' as Platform,
          content: 'From 12 hours/week of manual social scheduling to 10 minutes.\n\nHere is the autonomous pipeline architecture that made it possible. 🧵👇 #buildinpublic #solopreneur',
          status: 'PENDING_APPROVAL' as const,
          scheduledTime: new Date(Date.now() + 3600000 * 50).toISOString(),
          mediaUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=600&auto=format&fit=crop&q=80',
          mediaPrompt: 'Clean analytics growth chart showing exponential organic audience scale',
        },
        linkedin: {
          id: 'demo-li-3',
          platform: 'LINKEDIN' as Platform,
          content: 'Case Study: How we cut 12 hours of manual social content distribution down to 10 minutes a week.\n\nThe old way: Writing separate copy per platform, downloading images, re-uploading manually.\n\nThe autonomous way:\n• 1 single campaign theme synthesized by AI\n• Native adaptations generated per channel\n• Multi-tenant S3 media storage with automatic presigned links\n• BullMQ queue dispatching at peak engagement windows\n\nFocus on strategy. Let machines handle the plumbing.',
          status: 'PENDING_APPROVAL' as const,
          scheduledTime: new Date(Date.now() + 3600000 * 52).toISOString(),
          mediaUrl: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=600&auto=format&fit=crop&q=80',
          mediaPrompt: 'Professional office meeting discussing high-growth social media marketing strategy',
        },
        instagram: {
          id: 'demo-ig-3',
          platform: 'INSTAGRAM' as Platform,
          content: '12 hours of weekly busywork ➡️ 10 minutes of automated review. 📈\n\nHere is how we set up our multi-channel creator engine:\n\n✨ 1 core campaign brief\n📱 3 platform-tailored formats\n☁️ Auto-synced S3 asset storage\n\nShare this with a creator who needs to reclaim their time! 💡 #creatoreconomy #automation #productivitytips #solopreneur',
          status: 'PENDING_APPROVAL' as const,
          scheduledTime: new Date(Date.now() + 3600000 * 54).toISOString(),
          mediaUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?w=600&auto=format&fit=crop&q=80',
          mediaPrompt: 'Bright modern collaborative workspace with creator laptop and mobile phone preview',
        },
      };
    }

    // Default: Day 1
    return {
      theme: 'The 3-Tool Rule for Solopreneur AI Automation',
      twitter: {
        id: 'demo-tw-1',
        platform: 'TWITTER' as Platform,
        content: 'Stop using 10 AI tools. Pick 3 that talk to each other: Make, ChatGPT, and Notion automate 80% of busywork.\n\nWhat is your core stack? 👇 #automation #solopreneur',
        status: 'APPROVED' as const,
        scheduledTime: new Date(Date.now() + 3600000 * 2).toISOString(),
        mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
        mediaPrompt: 'Futuristic AI software workspace with glowing connection lines',
      },
      linkedin: {
        id: 'demo-li-1',
        platform: 'LINKEDIN' as Platform,
        content: 'Most founders drown in AI tools. They collect them like trading cards, but rarely connect them.\n\nThe real leverage is the workflow between tools:\n1. Choose 3 core tools max\n2. Connect them with a webhook pipeline\n3. Audit weekly: if a tool does not save 2+ hours, remove it.\n\nSimplicity scales. Complexity breaks. What is the one automation tool you cannot live without?',
        status: 'PENDING_APPROVAL' as const,
        scheduledTime: new Date(Date.now() + 3600000 * 4).toISOString(),
        mediaUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80',
        mediaPrompt: 'Executive analytics dashboard showing automated creator workflows',
      },
      instagram: {
        id: 'demo-ig-1',
        platform: 'INSTAGRAM' as Platform,
        content: 'Your AI stack is too big. 🛑\n\nHere is the 3-tool rule that changed my business workflow:\n\n1️⃣ Capture with Notion\n2️⃣ Reason with ChatGPT\n3️⃣ Connect with Make\n\nSave this for your next tool audit! ⚡ #saas #growth #automation #solopreneur',
        status: 'PENDING_APPROVAL' as const,
        scheduledTime: new Date(Date.now() + 3600000 * 6).toISOString(),
        mediaUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80',
        mediaPrompt: 'Modern gradient carousel slide showcasing the 3-tool rule',
      },
    };
  };

  // Resolve active day number and theme
  const activeDayNum = selectedDayIndex === 'all' ? 1 : Number(selectedDayIndex);
  const currentDay =
    calendar?.days?.find((d) => Number(d.dayIndex) === activeDayNum) || calendar?.days?.[0];

  const fallback = getFallbackPosts(activeDayNum);
  const activeTheme = currentDay?.theme || fallback.theme;

  const twitterPost = currentDay?.posts?.find((p) => p.platform === 'TWITTER');
  const linkedinPost = currentDay?.posts?.find((p) => p.platform === 'LINKEDIN');
  const instagramPost = currentDay?.posts?.find((p) => p.platform === 'INSTAGRAM');

  const activeTwitter = twitterPost || fallback.twitter;
  const activeLinkedin = linkedinPost || fallback.linkedin;
  const activeInstagram = instagramPost || fallback.instagram;

  // Helper to resolve connected account info or defaults
  const getAccountDetails = (platform: Platform) => {
    const conn = connections?.find((c) => c.platform === platform);
    if (conn && conn.connected) {
      return {
        name: conn.accountName || 'Sobin JM',
        handle: conn.handle ? (conn.handle.startsWith('@') ? conn.handle.slice(1) : conn.handle) : 'jmsobin',
        headline: 'Director of Engineering · AI Automation & Systems',
        isSandbox: conn.isSandbox,
      };
    }
    return {
      name: 'Sobin JM',
      handle: 'jmsobin',
      headline: 'Director of Engineering · AI Automation & Systems',
      isSandbox: false,
    };
  };

  // Helper to format scheduled time
  const formatSchedule = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return 'Scheduled';
    }
  };

  // Helper to render status badge with icon (ManyChat High-Contrast Light Style)
  const renderStatusBadge = (status: PostItem['status']) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 size={10} className="text-emerald-600" />
            Approved
          </span>
        );
      case 'PUBLISHED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
            <Check size={10} className="text-sky-600" />
            Dispatched
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
            <Calendar size={10} className="text-purple-600" />
            Scheduled
          </span>
        );
      case 'FAILED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
            <AlertCircle size={10} className="text-rose-600" />
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock size={10} className="text-amber-600" />
            Pending
          </span>
        );
    }
  };

  // Helper to syntax-highlight hashtags and mentions per platform
  const renderStyledText = (content: string, platform: Platform) => {
    const hashtagClass =
      platform === 'TWITTER'
        ? 'text-sky-400 hover:underline font-mono'
        : platform === 'LINKEDIN'
        ? 'text-blue-400 hover:underline font-mono'
        : 'text-pink-400 hover:underline font-mono';

    const words = content.split(/(\s+)/);
    return words.map((chunk, i) => {
      if (chunk.startsWith('#')) {
        return (
          <span key={i} className={hashtagClass}>
            {chunk}
          </span>
        );
      }
      if (chunk.startsWith('@')) {
        return (
          <span key={i} className="text-sky-300 font-semibold">
            {chunk}
          </span>
        );
      }
      return chunk;
    });
  };

  // ManyChat-style operational footer for each node
  const renderCardActionBar = (post: PostItem, dayIndex: number, maxChars: number) => {
    const isPublishingThis = publishingId === post.id;
    const charCount = post.content.length;
    const isOver = charCount > maxChars;
    const config = PLATFORM_CONFIG[post.platform];

    return (
      <div className="px-3.5 py-2.5 bg-white border-t border-slate-100 flex items-center justify-between gap-1.5 rounded-b-2xl">
        {/* Character meter pill */}
        <span
          className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-semibold ${
            isOver
              ? 'bg-rose-50 text-rose-600 border border-rose-200'
              : 'bg-slate-100 text-slate-500 border border-slate-200'
          }`}
          title={`${charCount} of ${maxChars} maximum characters`}
        >
          {charCount}/{maxChars}
        </span>

        <div className="flex items-center gap-1.5 ml-auto">
          {/* Edit Button */}
          <button
            type="button"
            onClick={() => onOpenEditor(post, dayIndex)}
            className="py-1 px-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
            title="Open modal editor"
          >
            <Pencil size={11} className="text-slate-500" />
            <span>Edit</span>
          </button>

          {/* Approve / Revert Button */}
          {onUpdatePost && (
            <button
              type="button"
              onClick={() => {
                const nextStatus = post.status === 'APPROVED' ? 'PENDING_APPROVAL' : 'APPROVED';
                onUpdatePost(dayIndex, post.id, { status: nextStatus });
                showToast(
                  nextStatus === 'APPROVED'
                    ? `Approved post for ${config.name}!`
                    : `Marked post pending review.`
                );
              }}
              className={`py-1 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 transition-colors ${
                post.status === 'APPROVED'
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs'
              }`}
              title="Toggle approval status"
            >
              <Check size={11} />
              <span>{post.status === 'APPROVED' ? 'Approved' : 'Approve'}</span>
            </button>
          )}

          {/* Publish / Dispatch Button (Signature ManyChat Blue) */}
          {onPublishSinglePost && (
            <button
              type="button"
              disabled={isPublishingThis}
              onClick={() => {
                if (window.confirm(`Publish post to ${config.name} now?`)) {
                  onPublishSinglePost(post, { keepScheduled: false });
                }
              }}
              className="py-1 px-2.5 rounded-lg bg-[#0084ff] hover:bg-[#0073e6] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1 transition-colors shadow-2xs"
              title="Dispatch post now to live platform"
            >
              <Send size={11} className={isPublishingThis ? 'animate-spin' : ''} />
              <span>{isPublishingThis ? 'Sending…' : 'Publish'}</span>
            </button>
          )}
        </div>
      </div>
    );
  };

  // ──────────────────────────────────────────────────────────
  // AUTHENTIC NATIVE SOCIAL MEDIA PREVIEW CARDS
  // ──────────────────────────────────────────────────────────
  const renderNativeSocialCard = (
    post: PostItem,
    dayIndex: number,
    isCompactInGraph = false
  ) => {
    const authorInfo = getAccountDetails(post.platform);
    const cardWidth = isCompactInGraph ? 'w-[320px] sm:w-[350px]' : 'w-full';

    // ──────────────────────────────────────────────────────────
    // 1. X / TWITTER AUTHENTIC NATIVE CARD
    // ──────────────────────────────────────────────────────────
    if (post.platform === 'TWITTER') {
      return (
        <div
          className={`manychat-node overflow-hidden flex flex-col text-left ${cardWidth}`}
        >
          {isCompactInGraph && <div className="manychat-port manychat-port-top" title="Input Port" />}

          {/* ManyChat Step Top Bar */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200/90 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-black border border-slate-700 flex items-center justify-center text-white shrink-0 shadow-2xs">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.9 2H22l-6.8 7.8L22.8 22h-6.3l-4.9-6.4L5.9 22H2.8l7.3-8.3L1.7 2h6.4l4.6 6.1L18.9 2zm-1.1 18h1.7L7.3 3.8H5.5L17.8 20z" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block leading-tight">𝕏 Twitter Step</span>
                <span className="text-[10px] text-slate-500 font-mono">16:9 Landscape Media</span>
              </div>
            </div>
            <div>{renderStatusBadge(post.status)}</div>
          </div>

          {/* Native Post Body */}
          <div className="bg-[#0f1419] p-3.5 flex flex-col gap-2.5">
            {/* Author Row */}
            <div className="flex items-start gap-2.5">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-sky-400 to-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs">
                {authorInfo.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 leading-tight flex-wrap">
                  <span className="text-xs font-bold text-white hover:underline cursor-pointer">
                    {authorInfo.name}
                  </span>
                  <BadgeCheck size={13} className="text-sky-400 fill-sky-400/20" />
                  <span className="text-[11px] text-slate-400">@{authorInfo.handle}</span>
                  <span className="text-slate-500 text-[10px]">· 2h</span>
                  <MoreHorizontal size={14} className="text-slate-500 ml-auto hover:text-slate-300 cursor-pointer" />
                </div>

                {/* Tweet Copy */}
                <div className="text-xs text-slate-100 whitespace-pre-wrap leading-relaxed mt-1.5 select-text">
                  {renderStyledText(post.content, 'TWITTER')}
                </div>
              </div>
            </div>

            {/* Media Preview (16:9 aspect) */}
            {post.mediaUrl ? (
              <div
                onClick={() =>
                  setPreviewImage({
                    url: post.mediaUrl!,
                    title: `X (Twitter) Visual (Day ${dayIndex})`,
                    prompt: post.mediaPrompt || undefined,
                  })
                }
                className="relative group/media overflow-hidden rounded-xl border border-slate-800 bg-black aspect-video max-h-44 w-full cursor-pointer mt-1"
              >
                <img
                  src={post.mediaUrl}
                  alt="X Visual"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/media:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                  <Eye size={14} />
                  <span>Zoom Media</span>
                </div>
              </div>
            ) : post.mediaPrompt ? (
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-dashed border-slate-800 flex items-center justify-between gap-2 text-[10px] mt-1">
                <span className="text-slate-400 truncate flex items-center gap-1.5">
                  <ImageIcon size={12} className="text-sky-400 shrink-0" />
                  <span className="italic truncate">&quot;{post.mediaPrompt}&quot;</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenEditor(post, dayIndex)}
                  className="text-sky-400 hover:text-sky-300 font-semibold shrink-0 hover:underline"
                >
                  Generate
                </button>
              </div>
            ) : null}

            {/* Native Metrics Bar */}
            <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1.5 border-t border-slate-800/80">
              <span className="flex items-center gap-1 hover:text-sky-400 cursor-pointer transition-colors">
                <MessageCircle size={13} /> 14
              </span>
              <span className="flex items-center gap-1 hover:text-emerald-400 cursor-pointer transition-colors">
                <Repeat2 size={13} /> 38
              </span>
              <span className="flex items-center gap-1 hover:text-pink-500 cursor-pointer transition-colors">
                <Heart size={13} /> 245
              </span>
              <span className="flex items-center gap-1 hover:text-sky-400 cursor-pointer transition-colors">
                <BarChart2 size={13} /> 2.8K
              </span>
              <span className="flex items-center gap-1 hover:text-slate-200 cursor-pointer transition-colors">
                <Bookmark size={13} />
              </span>
            </div>
          </div>

          {/* Workflow Action Controls */}
          {renderCardActionBar(post, dayIndex, 280)}

          {isCompactInGraph && <div className="manychat-port manychat-port-bottom" title="Output Port" />}
        </div>
      );
    }

    // ──────────────────────────────────────────────────────────
    // 2. LINKEDIN AUTHENTIC NATIVE CARD
    // ──────────────────────────────────────────────────────────
    if (post.platform === 'LINKEDIN') {
      return (
        <div
          className={`manychat-node overflow-hidden flex flex-col text-left ${cardWidth}`}
        >
          {isCompactInGraph && <div className="manychat-port manychat-port-top" title="Input Port" />}

          {/* ManyChat Step Top Bar */}
          <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200/90 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-[#0a66c2] flex items-center justify-center text-white shrink-0 shadow-2xs">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M4.98 3.5a2.5 2.5 0 11-.02 5 2.5 2.5 0 01.02-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-.95 1.83-1.95 3.75-1.95C20.4 8.75 21 11 21 14.1V21h-4v-6.1c0-1.45-.03-3.3-2.02-3.3-2.02 0-2.33 1.57-2.33 3.2V21H9z" />
                </svg>
              </div>
              <div className="min-w-0">
                <span className="text-xs font-bold text-slate-800 block leading-tight">LinkedIn Step</span>
                <span className="text-[10px] text-slate-500 font-mono">Thought Leadership B2B</span>
              </div>
            </div>
            <div>{renderStatusBadge(post.status)}</div>
          </div>

          {/* Native Post Body */}
          <div className="bg-[#1b1f23] p-3.5 flex flex-col gap-2">
            {/* Author Row */}
            <div className="flex items-start gap-2.5">
              <div className="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-800 flex items-center justify-center font-bold text-xs text-white shrink-0 shadow-xs">
                {authorInfo.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 leading-tight">
                  <span className="text-xs font-bold text-zinc-100 hover:text-blue-400 cursor-pointer">
                    {authorInfo.name}
                  </span>
                  <BadgeCheck size={13} className="text-blue-400" />
                  <span className="text-[9px] text-zinc-400 font-mono">· 1st</span>
                </div>
                <div className="text-[10px] text-zinc-400 truncate mt-0.5 leading-tight">
                  {authorInfo.headline}
                </div>
                <div className="text-[9px] text-zinc-500 flex items-center gap-1 mt-0.5">
                  <span>2h</span> · <span>Edited</span> · <Globe size={10} />
                </div>
              </div>
              <MoreHorizontal size={14} className="text-zinc-500 hover:text-zinc-300 cursor-pointer ml-auto" />
            </div>

            {/* LinkedIn Copy with '...see more' fold */}
            <div className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed mt-1 select-text">
              {renderStyledText(
                post.content.length > 210 ? post.content.slice(0, 210) : post.content,
                'LINKEDIN'
              )}
              {post.content.length > 210 && (
                <span
                  onClick={() => onOpenEditor(post, dayIndex)}
                  className="text-zinc-400 hover:text-blue-400 cursor-pointer font-semibold ml-1"
                >
                  …see more
                </span>
              )}
            </div>

            {/* Media Preview */}
            {post.mediaUrl ? (
              <div
                onClick={() =>
                  setPreviewImage({
                    url: post.mediaUrl!,
                    title: `LinkedIn Visual (Day ${dayIndex})`,
                    prompt: post.mediaPrompt || undefined,
                  })
                }
                className="relative group/media overflow-hidden rounded-lg border border-zinc-700 bg-black aspect-video max-h-44 w-full cursor-pointer mt-1"
              >
                <img
                  src={post.mediaUrl}
                  alt="LinkedIn Visual"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover/media:scale-105"
                />
                <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                  <Eye size={14} />
                  <span>Zoom Media</span>
                </div>
              </div>
            ) : post.mediaPrompt ? (
              <div className="p-2.5 rounded-lg bg-zinc-800/80 border border-dashed border-zinc-700 flex items-center justify-between gap-2 text-[10px] mt-1">
                <span className="text-zinc-400 truncate flex items-center gap-1.5">
                  <ImageIcon size={12} className="text-blue-400 shrink-0" />
                  <span className="italic truncate">&quot;{post.mediaPrompt}&quot;</span>
                </span>
                <button
                  type="button"
                  onClick={() => onOpenEditor(post, dayIndex)}
                  className="text-blue-400 hover:text-blue-300 font-semibold shrink-0 hover:underline"
                >
                  Generate
                </button>
              </div>
            ) : null}

            {/* Reactions Stats */}
            <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-2 border-b border-zinc-700/60 pb-1.5 mt-0.5">
              <div className="flex items-center gap-1">
                <span className="flex items-center -space-x-1">
                  <span className="w-4 h-4 rounded-full bg-blue-600 flex items-center justify-center text-white text-[8px] z-10">
                    👍
                  </span>
                  <span className="w-4 h-4 rounded-full bg-emerald-600 flex items-center justify-center text-white text-[8px]">
                    💡
                  </span>
                </span>
                <span className="font-medium ml-1">164</span>
              </div>
              <div className="space-x-1.5 font-medium">
                <span>32 comments</span> · <span>8 reposts</span>
              </div>
            </div>

            {/* Native Actions: Like, Comment, Repost, Send */}
            <div className="flex items-center justify-between text-[10px] text-zinc-400 pt-1 px-1">
              <span className="flex items-center gap-1 hover:text-zinc-200 cursor-pointer">
                <ThumbsUp size={12} /> Like
              </span>
              <span className="flex items-center gap-1 hover:text-zinc-200 cursor-pointer">
                <MessageCircle size={12} /> Comment
              </span>
              <span className="flex items-center gap-1 hover:text-zinc-200 cursor-pointer">
                <Repeat2 size={12} /> Repost
              </span>
              <span className="flex items-center gap-1 hover:text-zinc-200 cursor-pointer">
                <Send size={12} /> Send
              </span>
            </div>
          </div>

          {/* Workflow Action Controls */}
          {renderCardActionBar(post, dayIndex, 3000)}

          {isCompactInGraph && <div className="manychat-port manychat-port-bottom" title="Output Port" />}
        </div>
      );
    }

    // ──────────────────────────────────────────────────────────
    // 3. INSTAGRAM AUTHENTIC NATIVE CARD (Hero 1:1 image on top)
    // ──────────────────────────────────────────────────────────
    return (
      <div
        className={`manychat-node overflow-hidden flex flex-col text-left ${cardWidth}`}
      >
        {isCompactInGraph && <div className="manychat-port manychat-port-top" title="Input Port" />}

        {/* ManyChat Step Top Bar */}
        <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200/90 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 flex items-center justify-center text-white shrink-0 shadow-2xs">
              <Instagram size={13} />
            </div>
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-800 block leading-tight">Instagram Step</span>
              <span className="text-[10px] text-slate-500 font-mono">1:1 Hero Media & Reels</span>
            </div>
          </div>
          <div>{renderStatusBadge(post.status)}</div>
        </div>

        {/* Native Instagram Post Body */}
        <div className="bg-black flex flex-col">
          {/* Native Instagram Header */}
          <div className="px-3 py-2 flex items-center gap-2.5">
            {/* Story Ring */}
            <div className="p-[2px] rounded-full bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600 shrink-0">
              <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center font-bold text-[10px] text-white">
                {authorInfo.name.split(' ').map((n) => n[0]).join('').slice(0, 2)}
              </div>
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="flex items-center gap-1">
                <span className="text-xs font-bold text-zinc-100 truncate">{authorInfo.handle}</span>
                <BadgeCheck size={11} className="text-sky-400" />
              </div>
              <span className="text-[9px] text-zinc-500 truncate block">Original audio</span>
            </div>
            <MoreHorizontal size={14} className="text-zinc-400 ml-auto cursor-pointer" />
          </div>

          {/* HERO IMAGE ON TOP */}
          {post.mediaUrl ? (
            <div
              onClick={() =>
                setPreviewImage({
                  url: post.mediaUrl!,
                  title: `Instagram Visual (Day ${dayIndex})`,
                  prompt: post.mediaPrompt || undefined,
                })
              }
              className="relative group/media overflow-hidden bg-zinc-900 aspect-square w-full cursor-pointer"
            >
              <img
                src={post.mediaUrl}
                alt="Instagram Visual"
                className="w-full h-full object-cover transition-transform duration-300 group-hover/media:scale-105"
              />
              <div className="absolute inset-0 bg-black/40 backdrop-blur-2xs opacity-0 group-hover/media:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-semibold">
                <Eye size={14} />
                <span>Zoom Media</span>
              </div>
            </div>
          ) : post.mediaPrompt ? (
            <div className="p-4 bg-zinc-950 border-y border-zinc-900 flex flex-col items-center justify-center gap-2 aspect-video text-center">
              <ImageIcon size={22} className="text-pink-500/70" />
              <span className="text-zinc-400 italic text-[11px] line-clamp-2 px-3">
                &quot;{post.mediaPrompt}&quot;
              </span>
              <button
                type="button"
                onClick={() => onOpenEditor(post, dayIndex)}
                className="text-[11px] font-bold text-pink-400 hover:text-pink-300 hover:underline"
              >
                Generate Post Visual
              </button>
            </div>
          ) : (
            <div className="p-6 bg-zinc-950 border-y border-zinc-900 flex items-center justify-center text-zinc-600 text-[11px] font-mono">
              no visual generated yet
            </div>
          )}

          {/* Native Action Row: Heart, Comment, Send, Bookmark */}
          <div className="px-3 pt-2.5 pb-1 flex items-center justify-between text-zinc-200">
            <div className="flex items-center gap-3.5">
              <Heart size={16} className="hover:text-pink-500 cursor-pointer transition-colors" />
              <MessageCircle size={16} className="hover:text-zinc-400 cursor-pointer transition-colors" />
              <Send size={16} className="hover:text-zinc-400 cursor-pointer transition-colors" />
            </div>
            <Bookmark size={16} className="hover:text-zinc-400 cursor-pointer transition-colors" />
          </div>

          {/* Likes & Caption */}
          <div className="px-3 pb-3 space-y-1 text-left">
            <div className="text-[11px] font-bold text-zinc-100">
              Liked by <span className="font-extrabold">alex_founder</span> and{' '}
              <span className="font-extrabold">348 others</span>
            </div>

            <div className="text-xs text-zinc-200 whitespace-pre-wrap leading-relaxed select-text">
              <span className="font-bold text-white mr-1.5">{authorInfo.handle}</span>
              {renderStyledText(
                post.content.length > 140 ? post.content.slice(0, 140) : post.content,
                'INSTAGRAM'
              )}
              {post.content.length > 140 && (
                <span
                  onClick={() => onOpenEditor(post, dayIndex)}
                  className="text-zinc-500 hover:text-pink-400 cursor-pointer font-medium ml-1"
                >
                  … more
                </span>
              )}
            </div>

            <div
              onClick={() => onOpenEditor(post, dayIndex)}
              className="text-[10px] text-zinc-500 hover:text-zinc-400 cursor-pointer pt-0.5"
            >
              View all 24 comments
            </div>
            <div className="text-[9px] text-zinc-600 font-mono uppercase tracking-wide">
              2 hours ago
            </div>
          </div>
        </div>

        {/* Workflow Action Controls */}
        {renderCardActionBar(post, dayIndex, 2200)}

        {isCompactInGraph && <div className="manychat-port manychat-port-bottom" title="Output Port" />}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full min-h-[580px] canvas-dot-grid flex flex-col items-center justify-start p-3 sm:p-6 overflow-auto select-none">
      {/* ── Top Bar Controls: Day Selector, Layout Mode, Zoom (ManyChat Floating Dock) ─── */}
      <div className="w-full max-w-5xl mb-4 flex items-center justify-between flex-wrap gap-2.5 z-20 sticky top-0 bg-white/95 backdrop-blur-md p-2 rounded-2xl border border-slate-200 shadow-xs">
        {/* Left: View Mode Toggle */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/70">
          <button
            type="button"
            onClick={() => setViewMode('graph')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'graph' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Flow Builder Canvas (ManyChat Graph)"
          >
            <LayoutGrid size={13} className="text-[#0084ff]" />
            <span className="hidden sm:inline">Flow</span> Canvas
          </button>
          <button
            type="button"
            onClick={() => setViewMode('pipeline')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
              viewMode === 'pipeline' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Mobile-Friendly Vertical Pipeline"
          >
            <Smartphone size={13} className="text-emerald-600" />
            <span>Pipeline Feed</span>
          </button>
        </div>

        {/* Center: Day Selector Pills */}
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-xl p-1 shadow-2xs overflow-x-auto">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono px-1 hidden md:inline">
            Day:
          </span>
          {[1, 2, 3].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setSelectedDayIndex(d)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedDayIndex === d
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              Day {d}
            </button>
          ))}
          {viewMode === 'pipeline' && (
            <button
              type="button"
              onClick={() => setSelectedDayIndex('all')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                selectedDayIndex === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              All Days
            </button>
          )}
        </div>

        {/* Right: Quick Zoom & Fit to Screen */}
        <div className="flex items-center gap-1.5">
          {viewMode === 'graph' && (
            <div className="flex items-center gap-1 bg-slate-50 border border-slate-200/80 rounded-xl p-1 shadow-2xs">
              <button
                type="button"
                onClick={fitToScreen}
                className="px-2 py-1 text-[11px] font-semibold text-[#0084ff] hover:bg-blue-50 rounded-lg flex items-center gap-1 transition-colors"
                title="Fit diagram to viewport width"
              >
                <Maximize2 size={12} />
                <span className="hidden sm:inline">Fit</span>
              </button>
              <button
                type="button"
                onClick={() => handleZoom(10)}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-200/60 text-slate-600 text-sm font-bold transition-colors"
                title="Zoom in"
              >
                <Plus size={13} />
              </button>
              <button
                type="button"
                onClick={() => setZoomLevel(100)}
                className="text-[11px] font-mono text-slate-500 px-1 hover:text-slate-900"
                title="Reset to 100%"
              >
                {zoomLevel}%
              </button>
              <button
                type="button"
                onClick={() => handleZoom(-10)}
                className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-slate-200/60 text-slate-600 text-sm font-bold transition-colors"
                title="Zoom out"
              >
                <Minus size={13} />
              </button>
            </div>
          )}
        </div>
      </div>

            {/* ──────────────────────────────────────────────────────── */}
      {/* MODE 1: MANYCHAT FLOW BUILDER CANVAS                    */}
      {/* ──────────────────────────────────────────────────────── */}
      {viewMode === 'graph' && (
        <div
          className="flex flex-col items-center gap-3 transition-transform duration-150 ease-out pb-24 w-full"
          style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}
        >
          {/* ── Starting Step: Campaign Strategy Trigger ────────── */}
          <div className="flex flex-col items-center relative">
            <div
              onClick={() => onOpenConfigModal?.('niche')}
              className="manychat-node w-[350px] cursor-pointer group"
              title="Click to edit Niche Strategy & Schedule"
            >
              {/* ManyChat Starting Step Pill */}
              <div className="px-3.5 pt-2.5 pb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider font-mono">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Starting Step
                </span>
                <span className="text-[10px] font-mono text-slate-400">Trigger #1</span>
              </div>

              <div className="p-3.5 pt-1.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <Zap size={20} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    Campaign Strategy Trigger
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                    {calendar?.niche || 'AI Productivity & Automation Tools'}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-slate-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Configure Strategy"
                >
                  <SlidersHorizontal size={14} />
                </button>
              </div>

              {/* ManyChat Output Socket Port */}
              <div className="manychat-port manychat-port-bottom" />
            </div>
          </div>

          {/* Connector Cable 1 */}
          <div className="flex flex-col items-center -my-1 z-10">
            <div className="w-0.5 h-6 bg-slate-300" />
            <button
              type="button"
              onClick={() => setShowAddStepModal(true)}
              className="workflow-connector-dot my-[-4px] hover:scale-125 transition-transform hover:bg-blue-50 text-slate-500 hover:text-[#0084ff]"
              title="Add step to workflow"
            >
              <Plus size={12} />
            </button>
            <div className="w-0.5 h-6 bg-slate-300" />
          </div>

          {/* ── Step 2: AI Audience & Persona Filter ────────────── */}
          <div className="flex flex-col items-center relative">
            <div
              onClick={() => onOpenConfigModal?.('llm')}
              className="manychat-node w-[350px] cursor-pointer group"
              title="Click to edit AI Model & Segmentation"
            >
              <div className="manychat-port manychat-port-top" />

              <div className="px-3.5 pt-2.5 pb-1 flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider font-mono">
                  Step 2 · AI Logic
                </span>
                <span className="text-[10px] font-mono text-slate-400">Gemini 1.5</span>
              </div>

              <div className="p-3.5 pt-1.5 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-xs group-hover:scale-105 transition-transform">
                  <UserCheck size={20} />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    Audience & Persona Filter
                  </div>
                  <div className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                    {calendar?.audience || 'Tech Founders, Solopreneurs, Creators'}
                  </div>
                </div>
                <button
                  type="button"
                  className="text-slate-400 hover:text-emerald-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                  title="Configure Persona"
                >
                  <SlidersHorizontal size={14} />
                </button>
              </div>

              <div className="manychat-port manychat-port-bottom" />
            </div>
          </div>

          {/* Connector Cable 2 */}
          <div className="flex flex-col items-center -my-1 z-10">
            <div className="w-0.5 h-6 bg-slate-300" />
            <button
              type="button"
              onClick={() => setShowAddStepModal(true)}
              className="workflow-connector-dot my-[-4px] hover:scale-125 transition-transform hover:bg-blue-50 text-slate-500 hover:text-[#0084ff]"
              title="Add campaign step"
            >
              <Plus size={12} />
            </button>
            <div className="w-0.5 h-6 bg-slate-300" />
          </div>

          {/* ── Step 3: Omni-Channel Campaign Splitter ──────────── */}
          <div className="w-full max-w-2xl manychat-node p-4 shadow-sm relative z-10">
            <div className="manychat-port manychat-port-top" />

            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600 shrink-0 shadow-2xs">
                  <Sparkles size={18} />
                </div>
                <div className="min-w-0 text-left">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 px-2.5 py-0.5 rounded-full border border-indigo-200">
                      Day {activeDayNum} Theme Splitter
                    </span>
                    <span className="text-xs font-bold text-slate-900 truncate max-w-[340px]">
                      {activeTheme}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                    1 Core Idea ➔ 3 Distinct Platform Formats (Twitter, Instagram, LinkedIn)
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex items-center gap-1.5 shrink-0 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200 text-[10px] font-mono text-slate-600">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>3 Channels Active</span>
              </div>
            </div>

            {/* Splitter Output Ports Bar */}
            <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] font-mono text-slate-600 px-2">
              <span className="flex items-center gap-1.5 text-slate-800 font-semibold">
                <span className="w-2 h-2 rounded-full bg-slate-900" /> 𝕏 Twitter Socket
              </span>
              <span className="flex items-center gap-1.5 text-pink-700 font-semibold">
                <span className="w-2 h-2 rounded-full bg-pink-500" /> 📸 Instagram Socket
              </span>
              <span className="flex items-center gap-1.5 text-[#0a66c2] font-semibold">
                <span className="w-2 h-2 rounded-full bg-[#0a66c2]" /> 💼 LinkedIn Socket
              </span>
            </div>
          </div>

          {/* ── 3-Way SVG Bezier Fan-Out Cables ─────────────────── */}
          <div className="relative w-full max-w-[1080px] h-12 flex justify-between items-center -my-1 pointer-events-none">
            <svg className="w-full h-full overflow-visible" viewBox="0 0 1080 48" fill="none">
              {/* Left cable: Splitter to Twitter */}
              <path
                d="M 540,0 C 540,24 180,12 180,48"
                stroke="#64748b"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Center cable: Splitter to Instagram */}
              <path
                d="M 540,0 C 540,18 540,30 540,48"
                stroke="#ec4899"
                strokeWidth="2"
                strokeLinecap="round"
              />
              {/* Right cable: Splitter to LinkedIn */}
              <path
                d="M 540,0 C 540,24 900,12 900,48"
                stroke="#0a66c2"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </div>

          {/* ── 3-Channel Side-by-Side Flow Matrix ──────────────── */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1140px] w-full items-start">
            {/* ── Column 1: 𝕏 (Twitter) Channel ── */}
            <div className="flex flex-col items-center gap-3">
              <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-800 shadow-2xs">
                𝕏 Consumer & Viral
              </span>

              {renderNativeSocialCard(activeTwitter, activeDayNum, true)}

              {/* Cable down to downstream node */}
              <div className="flex flex-col items-center -my-1 z-10">
                <div className="w-0.5 h-5 bg-slate-300" />
                <button
                  type="button"
                  onClick={() => setShowAddStepModal(true)}
                  className="workflow-connector-dot my-[-3px] hover:scale-125 transition-transform"
                  title="Add action"
                >
                  <Plus size={11} />
                </button>
                <div className="w-0.5 h-5 bg-slate-300" />
              </div>

              {/* Downstream Node 1: A/B Hook Optimization */}
              <div
                onClick={() => setShowAbModal(true)}
                className="manychat-node w-full p-3 shadow-xs flex items-center justify-between gap-3 cursor-pointer group"
                title="Click to view A/B testing variants"
              >
                <div className="manychat-port manychat-port-top" />
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center group-hover:scale-110 transition-transform">
                    A/B
                  </span>
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-800 block">Hook Optimization</span>
                    <span className="text-[10px] text-slate-400">Variant #2 Split Testing</span>
                  </div>
                </div>
                <span className="text-[10px] text-purple-700 font-mono font-bold bg-purple-50 px-2 py-0.5 rounded-full border border-purple-200">
                  +29% CTR
                </span>
              </div>
            </div>

            {/* ── Column 2: Instagram Channel ── */}
            <div className="flex flex-col items-center gap-3">
              <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-white border border-slate-200 text-pink-700 shadow-2xs">
                📸 Visual & Carousel
              </span>

              {renderNativeSocialCard(activeInstagram, activeDayNum, true)}

              {/* Cable down to downstream node */}
              <div className="flex flex-col items-center -my-1 z-10">
                <div className="w-0.5 h-5 bg-pink-300" />
                <button
                  type="button"
                  onClick={() => setShowAddStepModal(true)}
                  className="workflow-connector-dot my-[-3px] hover:scale-125 transition-transform hover:border-pink-500 hover:text-pink-600"
                  title="Add action"
                >
                  <Plus size={11} />
                </button>
                <div className="w-0.5 h-5 bg-pink-300" />
              </div>

              {/* Downstream Node 2: Visual Studio & S3 Media Sync */}
              <div
                onClick={() => onOpenEditor(activeInstagram, activeDayNum)}
                className="manychat-node w-full p-3 shadow-xs flex items-center justify-between gap-3 cursor-pointer group"
                title="Click to manage Instagram Visual & S3 assets"
              >
                <div className="manychat-port manychat-port-top" />
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-600 to-purple-600 text-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <ImageIcon size={14} />
                  </div>
                  <div className="text-left">
                    <span className="text-xs font-bold text-slate-800 block">Visual Studio & S3</span>
                    <span className="text-[10px] text-slate-400">1080×1080 · Synced</span>
                  </div>
                </div>
                <span className="text-[10px] text-emerald-700 font-mono font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  Ready
                </span>
              </div>
            </div>

            {/* ── Column 3: LinkedIn Channel ── */}
            <div className="flex flex-col items-center gap-3">
              <span className="px-3.5 py-1 rounded-full text-xs font-bold bg-white border border-slate-200 text-blue-700 shadow-2xs">
                💼 Professional B2B
              </span>

              {renderNativeSocialCard(activeLinkedin, activeDayNum, true)}

              {/* Cable down to downstream node */}
              <div className="flex flex-col items-center -my-1 z-10">
                <div className="w-0.5 h-5 bg-blue-300" />
                <button
                  type="button"
                  onClick={() => setShowAddStepModal(true)}
                  className="workflow-connector-dot my-[-3px] hover:scale-125 transition-transform hover:border-blue-500 hover:text-blue-600"
                  title="Add action"
                >
                  <Plus size={11} />
                </button>
                <div className="w-0.5 h-5 bg-blue-300" />
              </div>

              {/* Downstream Node 3: BullMQ Live Webhook Dispatcher */}
              <div
                onClick={() => setShowEventModal(true)}
                className="manychat-node w-full p-3 shadow-xs flex items-center gap-2.5 cursor-pointer group text-left"
                title="Click to view Live External Dispatch & Webhooks"
              >
                <div className="manychat-port manychat-port-top" />
                <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#0a66c2] border border-blue-200 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                  <ExternalLink size={14} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-bold text-slate-900 block leading-tight">Live Webhook Dispatcher</div>
                  <div className="text-[10px] text-[#0a66c2] font-mono">BullMQ Redis · Queue Ready</div>
                </div>
                <span className="text-[9px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-mono font-bold">
                  Active
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

{/* ──────────────────────────────────────────────────────── */}
      {/* MODE 2: PIPELINE FEED (Mobile-First Touch Ergonomics)    */}
      {/* ──────────────────────────────────────────────────────── */}
      {viewMode === 'pipeline' && (
        <div className="w-full max-w-2xl mx-auto flex flex-col items-center gap-4 pb-24">
          {/* Step 1: Strategy Trigger Card */}
          <div className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <Zap size={20} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Starting Step: Campaign Trigger</span>
                <span className="text-xs text-slate-500 font-medium">
                  {calendar?.niche || 'AI Productivity & Automation Tools'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenConfigModal?.('niche')}
              className="btn btn-sm btn-secondary text-xs"
            >
              Configure
            </button>
          </div>

          <div className="w-0.5 h-6 bg-slate-300 -my-2" />

          {/* Step 2: AI Synthesis Card */}
          <div className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                <UserCheck size={20} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Step 2: AI Audience Filter</span>
                <span className="text-xs text-slate-500 font-medium">
                  {calendar?.audience || 'Tech Founders, Solopreneurs, Creators'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onOpenConfigModal?.('llm')}
              className="btn btn-sm btn-secondary text-xs"
            >
              Model
            </button>
          </div>

          <div className="w-0.5 h-6 bg-slate-300 -my-2" />

          {/* Step 3: Multi-Channel Post Cards Feed */}
          <div className="w-full space-y-4">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider font-mono">
                Step 3: Multi-Platform Posts {selectedDayIndex === 'all' ? '(All 3 Days)' : `(Day ${selectedDayIndex})`}
              </h3>
              {onApproveBatch && (
                <button
                  type="button"
                  onClick={onApproveBatch}
                  className="text-xs font-semibold text-emerald-600 hover:underline flex items-center gap-1"
                >
                  <CheckCircle2 size={12} />
                  <span>Approve All</span>
                </button>
              )}
            </div>

            {/* List all days or selected day */}
            {(selectedDayIndex === 'all' ? [1, 2, 3] : [activeDayNum]).map((dNum) => {
              const dayNum = Number(dNum);
              const dayObj = calendar?.days?.find((d) => Number(d.dayIndex) === dayNum);
              const fb = getFallbackPosts(dayNum);
              const theme = dayObj?.theme || fb.theme;
              const tw = dayObj?.posts?.find((p) => p.platform === 'TWITTER') || fb.twitter;
              const li = dayObj?.posts?.find((p) => p.platform === 'LINKEDIN') || fb.linkedin;
              const ig = dayObj?.posts?.find((p) => p.platform === 'INSTAGRAM') || fb.instagram;

              return (
                <div key={dayNum} className="space-y-4 pt-1 w-full">
                  {/* Campaign Theme Banner */}
                  <div className="w-full bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-3.5 border border-indigo-500/30 shadow-xs flex items-center justify-between gap-3 text-left">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 font-mono shrink-0">
                        Day {dayNum}
                      </span>
                      <span className="text-xs font-semibold text-white truncate">{theme}</span>
                    </div>
                    <span className="text-[10px] font-mono text-indigo-300 shrink-0 hidden sm:inline">
                      1 Theme · 3 Native Formats
                    </span>
                  </div>

                  {/* 1. Twitter Post Card */}
                  {renderNativeSocialCard(tw, dayNum, false)}

                  {/* 2. LinkedIn Post Card */}
                  {renderNativeSocialCard(li, dayNum, false)}

                  {/* 3. Instagram Post Card */}
                  {renderNativeSocialCard(ig, dayNum, false)}
                </div>
              );
            })}
          </div>

          <div className="w-0.5 h-6 bg-slate-300 -my-2" />

          {/* Step 4: Dispatch & Webhook Monitor */}
          <div
            onClick={() => setShowEventModal(true)}
            className="w-full bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex items-center justify-between gap-3 cursor-pointer hover:border-pink-300 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-pink-50 border border-pink-200 flex items-center justify-center text-pink-500 shrink-0">
                <ExternalLink size={20} />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-800 block">Step 4: Live Execution Webhooks</span>
                <span className="text-xs text-emerald-600 font-mono font-medium">
                  BullMQ Queue: Online · Dispatches Ready
                </span>
              </div>
            </div>
            <span className="text-xs font-bold text-sky-600 flex items-center gap-1">
              Details <ChevronRight size={13} />
            </span>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────── */}
      {/* MODALS & LIGHTBOXES                                      */}
      {/* ──────────────────────────────────────────────────────── */}

      {/* 1. Image Preview Lightbox */}
      {previewImage && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl overflow-hidden max-w-xl w-full shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-3 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <span className="text-xs font-bold text-slate-800">{previewImage.title}</span>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 flex flex-col items-center gap-3">
              <img
                src={previewImage.url}
                alt="Enlarged Visual"
                className="w-full max-h-[70vh] object-contain rounded-xl border border-slate-200 shadow-sm"
              />
              {previewImage.prompt && (
                <div className="w-full text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="font-bold text-slate-800">Visual Prompt: </span>
                  {previewImage.prompt}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 2. Add Step Modal */}
      {showAddStepModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-sm w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <h4 className="text-sm font-bold text-slate-900">Add Step to Journey</h4>
              <button
                type="button"
                onClick={() => setShowAddStepModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Select an action or trigger to insert into your multi-channel automation:
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddStepModal(false);
                  onQuickGenerate();
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:border-sky-400 hover:bg-sky-50/50 text-left transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold text-xs">
                  AI
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">AI Content Synthesizer</div>
                  <div className="text-[10px] text-slate-500">Generate fresh post copy for current theme</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAddStepModal(false);
                  setShowAbModal(true);
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:border-purple-400 hover:bg-purple-50/50 text-left transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold text-xs">
                  A/B
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">A/B Test Variant Branch</div>
                  <div className="text-[10px] text-slate-500">Split test headline and hook variants</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowAddStepModal(false);
                  onSelectView?.('board');
                }}
                className="flex items-center gap-2.5 p-2.5 rounded-lg border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/50 text-left transition-all"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold text-xs">
                  CAL
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-800">Schedule in Calendar Studio</div>
                  <div className="text-[10px] text-slate-500">Add custom date, time and platform slot</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. A/B Test Modal */}
      {showAbModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-purple-100 text-purple-700 font-bold text-xs flex items-center justify-center">
                  A/B
                </span>
                <h4 className="text-sm font-bold text-slate-900">A/B Test Optimization</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowAbModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-purple-50/60 border border-purple-200 rounded-xl">
                <div className="font-bold text-purple-900 mb-1">Variant A (Control):</div>
                <p className="text-slate-700 italic">
                  &quot;Stop using 10 AI tools. Pick 3 that talk to each other: Make, ChatGPT, and Notion automate 80% of busywork.&quot;
                </p>
                <div className="text-[10px] text-purple-700 font-mono mt-2 font-medium">
                  CTR: 4.8% · Likes: 84
                </div>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="font-bold text-slate-900 mb-1">Variant B (Active Test):</div>
                <p className="text-slate-700 italic">
                  &quot;Are you drowning in 10+ AI subscriptions? The 3-tool stack every solopreneur actually needs in 2026.&quot;
                </p>
                <div className="text-[10px] text-slate-500 font-mono mt-2 font-medium">
                  CTR: 6.2% · Likes: 112 (Winning by +29%)
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowAbModal(false);
                  showToast('Variant B promoted to primary publish candidate');
                }}
                className="btn btn-primary w-full py-2 text-xs"
              >
                <Check size={13} />
                <span>Promote Variant B as Final Copy</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. External Webhook Modal */}
      {showEventModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <ExternalLink size={16} className="text-pink-500" />
                <h4 className="text-sm font-bold text-slate-900">External Dispatch Status</h4>
              </div>
              <button
                type="button"
                onClick={() => setShowEventModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 font-mono text-[11px] space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Scheduler Queue:</span>
                  <span className="text-emerald-600 font-bold">BullMQ Redis: ONLINE</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Target Webhooks:</span>
                  <span className="text-slate-800">Twitter v2, LinkedIn REST</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Next Scheduled Trigger:</span>
                  <span className="text-sky-600 font-semibold">{new Date(Date.now() + 3600000).toLocaleTimeString()}</span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowEventModal(false);
                  showToast('Test event webhook dispatched successfully');
                }}
                className="btn btn-primary w-full py-2 text-xs"
              >
                <Zap size={13} />
                <span>Send Test Webhook Ping</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Canvas Toast */}
      {toastMsg && (
        <div className="toast-float">
          <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
          <span className="font-mono text-xs">{toastMsg}</span>
        </div>
      )}
    </div>
  );
}
