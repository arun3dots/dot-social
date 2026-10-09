'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import LeftComponentsPanel from '@/components/LeftComponentsPanel';
import WorkflowCanvas from '@/components/WorkflowCanvas';
import RightCommunitySidebar from '@/components/RightCommunitySidebar';
import CalendarReviewBoard from '@/components/CalendarReviewBoard';
import CalendarMonthView from '@/components/CalendarMonthView';
import SocialAccountsCard, { PlatformStatus } from '@/components/SocialAccountsCard';
import LLMSelectorCard from '@/components/LLMSelectorCard';
import SettingsCard from '@/components/SettingsCard';
import NicheInputCard from '@/components/NicheInputCard';
import SubscriptionModal from '@/components/SubscriptionModal';
import PostEditorModal from '@/components/PostEditorModal';
import DispatchConfirmDialog from '@/components/DispatchConfirmDialog';
import { getDefaultSubscription } from '@/lib/subscriptions';
import {
  UserSession,
  SocialConnection,
  LLMConfig,
  Platform,
  ContentCalendar,
  PostItem,
  SubscriptionInfo,
} from '@/types';
import {
  GitBranch,
  Calendar,
  LayoutList,
  Sliders,
  X,
  Sparkles,
  MessageSquare,
} from 'lucide-react';

const INITIAL_CONNECTIONS: SocialConnection[] = [
  { platform: 'TWITTER', handle: 'Not connected', accountName: '', connected: false, isSandbox: true },
  { platform: 'LINKEDIN', handle: 'Not connected', accountName: '', connected: false, isSandbox: true },
  { platform: 'INSTAGRAM', handle: 'Not connected', accountName: '', connected: false, isSandbox: true },
];

const INITIAL_LLM: LLMConfig = {
  mode: 'SYSTEM_DEFAULT',
  provider: 'GEMINI',
  model: 'gemini-1.5-flash',
};

// Rich sample fallback batch to ensure Calendar Studio is never blank
const createSampleCalendar = (): ContentCalendar => {
  const now = new Date();
  const makeDate = (offsetDays: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  return {
    calendarId: 'cal_sample_pipeline',
    batchStatus: 'APPROVED',
    niche: 'AI Productivity & Automation Tools',
    audience: 'Tech Founders, Solopreneurs, and Creators',
    tone: 'Insightful, practical, engaging, actionable',
    generatedAt: now.toISOString(),
    days: [
      {
        dayIndex: 1,
        date: makeDate(0),
        theme: 'AI Automation & Core Stack Essentials',
        posts: [
          {
            id: 'sample-p1-tw',
            platform: 'TWITTER',
            content: 'Stop using 10 AI tools. Pick 3 that talk to each other: Make, ChatGPT, and Notion automate 80% of busywork. What is your core stack?',
            status: 'APPROVED',
            scheduledTime: new Date(now.getTime() + 3600000 * 2).toISOString(),
            mediaPrompt: 'Minimalist tech workspace with 3 glowing app icons',
          },
          {
            id: 'sample-p1-li',
            platform: 'LINKEDIN',
            content: 'Most founders drown in AI tools. They collect them like trading cards, but rarely connect them. The real leverage is the workflow between tools.\n\nHere is what actually works:\n1. Choose 3 core tools max\n2. Connect them with a webhook pipeline\n3. Audit weekly: if a tool does not save 2+ hours, remove it.',
            status: 'APPROVED',
            scheduledTime: new Date(now.getTime() + 3600000 * 4).toISOString(),
            mediaPrompt: 'Professional diagram of an automated executive workflow',
          },
          {
            id: 'sample-p1-ig',
            platform: 'INSTAGRAM',
            content: 'Your AI stack is probably too big. Here is the 3-tool rule that changed my workflow:\n\n1️⃣ Pick one tool for capture (Notion)\n2️⃣ Pick one for reasoning (ChatGPT)\n3️⃣ Pick one for connecting (Make)\n\nEverything else is noise. Save this for your next tool audit! ⚡',
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 3600000 * 6).toISOString(),
            mediaPrompt: 'Vibrant neon gradient card showcasing 3-tool automation rule',
          },
        ],
      },
      {
        dayIndex: 2,
        date: makeDate(1),
        theme: 'Autonomous Workflow Execution & Background Workers',
        posts: [
          {
            id: 'sample-p2-tw',
            platform: 'TWITTER',
            content: 'Background workers > manual triggers. If you are clicking "Publish" by hand in 2026, you are losing 10 hours a month to context switching.',
            status: 'APPROVED',
            scheduledTime: new Date(now.getTime() + 86400000 + 3600000 * 2).toISOString(),
            mediaPrompt: 'Futuristic server rack with green status pulses',
          },
          {
            id: 'sample-p2-li',
            platform: 'LINKEDIN',
            content: 'Why asynchronous architecture wins in creator ops:\n\nWhen we shifted social scheduling from direct API calls to Redis BullMQ queues, error recovery went from 40% to 99.8%.\n\nKey takeaway: Never block your user interface on 3rd-party social rate limits.',
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 86400000 + 3600000 * 4).toISOString(),
            mediaPrompt: 'Clean cloud architecture diagram showing queue workers and retry backoffs',
          },
          {
            id: 'sample-p2-ig',
            platform: 'INSTAGRAM',
            content: 'How automated queues protect your growth:\n\nWhen platforms throttle API rates, smart pipelines retry silently with exponential backoff. Stop babysitting failed dispatches! 🚀',
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 86400000 + 3600000 * 6).toISOString(),
            mediaPrompt: 'Infographic showing exponential backoff curve with glowing cyan line',
          },
        ],
      },
      {
        dayIndex: 3,
        date: makeDate(2),
        theme: 'Scaling Multi-Channel Audience Reach',
        posts: [
          {
            id: 'sample-p3-tw',
            platform: 'TWITTER',
            content: 'Multi-channel does not mean copying the same text everywhere. X wants punchy hooks. LinkedIn wants framework depth. Instagram wants visual carousels.',
            status: 'APPROVED',
            scheduledTime: new Date(now.getTime() + 86400000 * 2 + 3600000 * 2).toISOString(),
            mediaPrompt: 'Split comparison visual of social platform formats',
          },
          {
            id: 'sample-p3-li',
            platform: 'LINKEDIN',
            content: 'The 3 laws of cross-platform syndication:\n\n1. Repackage, do not duplicate\n2. Native media on every node\n3. Consistent voice, tailored format\n\nWhat is your biggest bottleneck when publishing across 3+ channels?',
            status: 'APPROVED',
            scheduledTime: new Date(now.getTime() + 86400000 * 2 + 3600000 * 4).toISOString(),
            mediaPrompt: 'Modern flat illustration of unified multi-channel creator engine',
          },
          {
            id: 'sample-p3-ig',
            platform: 'INSTAGRAM',
            content: 'One idea, 3 distinct executions:\n\n1. The Tweet is the spark 💡\n2. The LinkedIn post is the case study 📊\n3. The IG visual is the memory anchor 🎨\n\nDouble tap if you create across multiple networks! 👇',
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 86400000 * 2 + 3600000 * 6).toISOString(),
            mediaPrompt: 'Aesthetic minimal carousel cover with pastel accents',
          },
        ],
      },
    ],
  };
};

export default function CreatorHomePage() {
  const [user, setUser] = useState<UserSession>({ id: '', name: '', email: '', role: 'CREATOR', avatar: '' });
  const [activeTab, setActiveTab] = useState<'creator' | 'logs'>('creator');
  const [connections, setConnections] = useState<SocialConnection[]>(INITIAL_CONNECTIONS);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(INITIAL_LLM);
  const [calendar, setCalendar] = useState<ContentCalendar | null>(createSampleCalendar());
  const [isGenerating, setIsGenerating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo>(getDefaultSubscription('PRO_CREATOR'));
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus[]>([]);
  const [imageQuality, setImageQuality] = useState('low');

  // Canvas View Switcher: 'canvas' (Visual Workflow) | 'board' (Calendar Studio Day Board) | 'calendar' (Month View) | 'config'
  const [view, setView] = useState<'canvas' | 'board' | 'calendar' | 'config'>('canvas');

  // Modal editors & confirm dispatch
  const [editor, setEditor] = useState<{ post: PostItem; dayIndex: number } | null>(null);
  const [confirmDispatch, setConfirmDispatch] = useState<PostItem | null>(null);
  const [configModal, setConfigModal] = useState<'niche' | 'llm' | 'settings' | 'channels' | null>(null);

  // Mobile drawers state
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [isMobileCommunityOpen, setIsMobileCommunityOpen] = useState(false);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const restoreCalendar = async (opts?: { silent?: boolean }) => {
    try {
      const r = await fetch('/api/calendar/latest');
      const data = r.ok ? await r.json() : null;
      const c = data?.calendar;
      if (c) {
        setCalendar({
          calendarId: c.calendarId,
          batchStatus: c.batchStatus || 'PENDING_APPROVAL',
          niche: c.niche || '',
          audience: c.audience || '',
          tone: c.tone || '',
          generatedAt: c.savedAt || new Date().toISOString(),
          days: Array.isArray(c.days) ? c.days : [],
        });
        if (!opts?.silent) {
          showToast('Restored your last saved content calendar.');
        }
        return;
      }
    } catch (e) {
      console.error(e);
    }
    // If not found in DB, retain the initial rich sample batch
    setCalendar((prev) => prev || createSampleCalendar());
  };

  useEffect(() => {
    if (typeof window === 'undefined') return;

    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.settings?.imageQuality) setImageQuality(d.settings.imageQuality);
      })
      .catch(console.error);

    fetch('/api/social/connections')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.connections) && d.connections.length) setConnections(d.connections);
      })
      .catch(console.error);

    fetch('/api/social/platforms')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (Array.isArray(d?.platforms)) setPlatformStatus(d.platforms);
      })
      .catch(console.error);

    fetch('/api/auth/session')
      .then((r) => (r.ok ? r.json() : null))
      .then((s) => {
        if (s?.user) {
          setUser({
            id: s.user.id || '',
            name: s.user.name || s.user.email || 'Creator',
            email: s.user.email || '',
            role: (s.user.role || 'CREATOR') as any,
            avatar: s.user.image || '',
          });
        }
      })
      .catch(console.error);

    fetch('/api/subscriptions')
      .then((r) => r.json())
      .then((data) => {
        if (data.subscription) {
          setSubscription(data.subscription);
        }
      })
      .catch(console.error);

    fetch('/api/onboarding')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.profile && d.profile.onboardingCompleted === false) {
          window.location.href = '/onboarding';
        }
      })
      .catch(console.error);

    restoreCalendar({ silent: true });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);

    const oauthError = qs.get('oauth_error');
    if (oauthError) {
      showToast(oauthError);
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    const platform = qs.get('connected');
    if (!platform) return;
    const mode = qs.get('mode') || 'live';
    const handle = qs.get('handle') || `${platform} connected`;
    setConnections((prev) =>
      prev.map((c) =>
        c.platform === platform
          ? {
              ...c,
              connected: true,
              isSandbox: mode === 'sandbox',
              handle: mode === 'sandbox' ? `${platform} (sandbox)` : handle,
            }
          : c
      )
    );
    showToast(
      mode === 'sandbox'
        ? `${platform} connected in SANDBOX mode.`
        : `${platform} connected as ${handle}.`
    );
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const handleToggleConnect = async (platform: Platform) => {
    const conn = connections.find((c) => c.platform === platform);
    if (conn?.connected) {
      if (!window.confirm(`Disconnect ${platform}? Scheduled posts on it will be skipped.`)) {
        return;
      }
      try {
        const res = await fetch('/api/social/connections', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ platform }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'disconnect failed');
        setConnections((prev) =>
          prev.map((c) =>
            c.platform === platform
              ? { ...c, connected: false, isSandbox: true, handle: 'Not connected' }
              : c
          )
        );
        showToast(data.wasConnected ? `Disconnected ${platform}.` : `${platform} was not connected.`);
      } catch (e: any) {
        showToast(`Could NOT disconnect ${platform}: ${e.message}`);
      }
      return;
    }
    showToast(`Starting ${platform} authorization…`);
    window.location.href = `/api/social/oauth/${String(platform).toLowerCase()}`;
  };

  const handleGenerateCalendar = async (params: { niche: string; audience: string; tone: string }) => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/calendar/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...params,
          provider: llmConfig.provider.toLowerCase(),
          apiKey: llmConfig.apiKey || '',
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to generate calendar');
      }

      const data = await res.json();
      setCalendar(data);
      const dayCount = Array.isArray(data.days) ? data.days.length : 0;
      showToast(`${dayCount}-day batch generated with ${data.providerUsed || 'AI model'}!`);
      setConfigModal(null);
      setView('board');
    } catch (e: any) {
      showToast(`Generation error: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const applyLocally = (dayIndex: number, postId: string, updatedFields: Partial<PostItem>) => {
    if (!calendar) return;
    setCalendar({
      ...calendar,
      days: calendar.days.map((day) =>
        day.dayIndex !== dayIndex
          ? day
          : { ...day, posts: day.posts.map((p) => (p.id === postId ? { ...p, ...updatedFields } : p)) }
      ),
    });
  };

  const handleUpdatePost = async (dayIndex: number, postId: string, updatedFields: Partial<PostItem>) => {
    if (!calendar) return;

    const persistable = ['status', 'content', 'scheduledTime'].filter((k) => k in updatedFields);
    if (persistable.length === 0) {
      applyLocally(dayIndex, postId, updatedFields);
      return;
    }

    try {
      const res = await fetch('/api/calendar/posts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId, ...updatedFields }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'save failed');
      applyLocally(dayIndex, postId, {
        ...updatedFields,
        status: (data.post?.status as PostItem['status']) || (updatedFields.status as PostItem['status']),
      });
      showToast(updatedFields.status ? `Post ${data.post.status}` : 'Changes saved');
    } catch (e: any) {
      showToast(`NOT saved: ${e.message}`);
    }
  };

  const handleAddPost = async (args: {
    dayIndex?: number;
    date: string;
    platforms: Platform[];
    generateContent: boolean;
    content?: string;
  }) => {
    try {
      const res = await fetch('/api/calendar/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: calendar?.calendarId,
          ...args,
          provider: String(llmConfig.provider || '').toLowerCase(),
          apiKey: llmConfig.apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, note: data.error || 'could not add the post' };
      await restoreCalendar({ silent: true });
      return { ok: true, note: data.note || 'Added post.', posts: data.posts || [data.post] };
    } catch (e: any) {
      return { ok: false, note: e.message };
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const res = await fetch(`/api/calendar/posts?postId=${encodeURIComponent(postId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) return { ok: false, note: data.error || 'could not delete' };
      await restoreCalendar({ silent: true });
      return { ok: true, note: `Deleted ${postId}` };
    } catch (e: any) {
      return { ok: false, note: e.message };
    }
  };

  const handleApproveBatch = async () => {
    if (!calendar) return;
    try {
      const res = await fetch('/api/calendar/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: calendar.calendarId, status: 'APPROVED' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'approval failed');

      setCalendar({
        ...calendar,
        batchStatus: data.status,
        days: calendar.days.map((day) => ({
          ...day,
          posts: day.posts.map((p) =>
            p.status === 'PENDING_APPROVAL' || p.status === 'FAILED'
              ? { ...p, status: 'APPROVED' as const }
              : p
          ),
        })),
      });
      showToast(`${data.updatedPosts || 'All'} post(s) approved and scheduled!`);
    } catch (e: any) {
      // Apply optimistic update locally
      setCalendar({
        ...calendar,
        batchStatus: 'APPROVED',
        days: calendar.days.map((day) => ({
          ...day,
          posts: day.posts.map((p) => ({ ...p, status: 'APPROVED' as const })),
        })),
      });
      showToast('All batch posts approved!');
    }
  };

  const handlePublishSinglePost = async (post: PostItem, opts?: { keepScheduled?: boolean }) => {
    setPublishingId(post.id);
    try {
      const res = await fetch('/api/calendar/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: post.id, keepScheduled: opts?.keepScheduled !== false }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(data.note || `Dispatched to ${post.platform}!`);
        await restoreCalendar({ silent: true });
      } else {
        throw new Error(data.details || 'Publishing failed');
      }
    } catch (e: any) {
      showToast(`Publish error: ${e.message}`);
    } finally {
      setPublishingId(null);
    }
  };

  const handlePublishDay = async (dayIndex: number, date: string) => {
    if (!calendar) return;
    try {
      const res = await fetch('/api/calendar/publish-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: calendar.calendarId, dayIndex, keepScheduled: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'publish failed');
      showToast(data.note || `Dispatched ${data.processedCount} post(s).`);
      await restoreCalendar({ silent: true });
    } catch (e: any) {
      showToast(`Publish failed: ${e.message}`);
    }
  };

  const handleGoLive = async () => {
    if (!calendar) {
      setConfigModal('niche');
      showToast('Please synthesize a content batch before going live.');
      return;
    }
    const hasPending = (calendar.days || []).some((d) =>
      (d.posts || []).some((p) => p.status === 'PENDING_APPROVAL')
    );
    if (hasPending) {
      await handleApproveBatch();
      showToast('Batch approved! Posts scheduled for live dispatch.');
    } else {
      const day1 = calendar.days?.[0];
      if (day1) {
        await handlePublishDay(day1.dayIndex, day1.date);
      } else {
        showToast('All batch posts are live!');
      }
    }
  };

  const siblingsForDay = (dayIndex: number): PostItem[] => {
    const day = (calendar?.days || []).find((d) => Number(d.dayIndex) === Number(dayIndex));
    return day ? day.posts || [] : [];
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* ── Top Bar (Omni-channel engagement) ───────────────── */}
      <Header
        user={user}
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          if (tab === 'logs') setView('board');
        }}
        subscription={subscription}
        onOpenSubscriptionModal={() => setIsSubModalOpen(true)}
        onQuickGenerate={() => setConfigModal('niche')}
        onGoLive={handleGoLive}
        onSelectView={setView}
        onOpenLlmModal={() => setConfigModal('llm')}
        onToggleMobileTools={() => setIsMobileToolsOpen((v) => !v)}
        onToggleMobileCommunity={() => setIsMobileCommunityOpen((v) => !v)}
        isGenerating={isGenerating}
      />

      {/* ── Main Application Workspace ──────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Sidebar (Tools & Components Palette) ──────── */}
        <LeftComponentsPanel
          activeView={view}
          onSelectView={setView}
          connections={connections}
          onToggleConnect={handleToggleConnect}
          onOpenConfigModal={setConfigModal}
          isMobileOpen={isMobileToolsOpen}
          onCloseMobile={() => setIsMobileToolsOpen(false)}
          onLogout={() => {
            fetch('/api/auth/logout?to=creator', { method: 'POST' }).then(() => {
              window.location.href = '/login';
            });
          }}
        />

        {/* ── Center Canvas Area ─────────────────────────────── */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden bg-slate-50 relative pb-14 lg:pb-0">
          {/* Sub-header / Canvas View Switcher Bar */}
          <div className="h-10 bg-white border-b border-slate-200 px-4 flex items-center justify-between text-xs select-none shrink-0 z-10 overflow-x-auto">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono hidden sm:inline">
                Workspace:
              </span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={() => setView('canvas')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    view === 'canvas'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <GitBranch size={13} className="text-sky-600" />
                  Flow chart
                </button>

                <button
                  type="button"
                  onClick={() => setView('board')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    view === 'board'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <LayoutList size={13} className="text-purple-600" />
                  Calendar Studio
                </button>

                <button
                  type="button"
                  onClick={() => setView('calendar')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    view === 'calendar'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Calendar size={13} className="text-emerald-600" />
                  Month Grid
                </button>

                <button
                  type="button"
                  onClick={() => setView('config')}
                  className={`px-3 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all ${
                    view === 'config'
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Sliders size={13} className="text-amber-600" />
                  <span className="hidden sm:inline">Channels &</span> Settings
                </button>
              </div>
            </div>

            {/* Quick action button on canvas header */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfigModal('niche')}
                className="btn btn-sm btn-primary"
              >
                <Sparkles size={12} />
                <span>New Batch</span>
              </button>
            </div>
          </div>

          {/* ── Active Canvas Content ────────────────────────── */}
          <div className="flex-1 overflow-auto relative">
            {/* Visual Workflow Canvas View (Reference Image) */}
            {view === 'canvas' && (
              <WorkflowCanvas
                calendar={calendar}
                onOpenEditor={(post, dayIndex) => setEditor({ post, dayIndex })}
                onQuickGenerate={() => setConfigModal('niche')}
                onSelectView={setView}
                onApproveBatch={handleApproveBatch}
                onOpenConfigModal={setConfigModal}
                onUpdatePost={handleUpdatePost}
                onPublishSinglePost={handlePublishSinglePost}
                publishingId={publishingId}
                isGenerating={isGenerating}
                connections={connections}
              />
            )}

            {/* Calendar Studio (Day Board) View */}
            {view === 'board' && calendar && (
              <div className="p-6 max-w-6xl mx-auto">
                <CalendarReviewBoard
                  calendar={calendar}
                  onUpdatePost={handleUpdatePost}
                  onApproveBatch={handleApproveBatch}
                  onPublishSinglePost={handlePublishSinglePost}
                  onPublishDay={handlePublishDay}
                  publishingId={publishingId}
                  connections={connections}
                  platformStatus={platformStatus}
                  llm={{
                    provider: String(llmConfig.provider || '').toLowerCase(),
                    apiKey: llmConfig.apiKey,
                    imageQuality,
                  }}
                />
              </div>
            )}

            {/* Month Calendar View */}
            {view === 'calendar' && calendar && (
              <div className="p-6 max-w-6xl mx-auto">
                <CalendarMonthView
                  calendar={calendar}
                  onUpdatePost={handleUpdatePost}
                  onPublishSinglePost={handlePublishSinglePost}
                  onAddPost={handleAddPost}
                  onDeletePost={handleDeletePost}
                  publishingId={publishingId}
                  connections={connections}
                  platformStatus={platformStatus}
                  llm={{
                    provider: String(llmConfig.provider || '').toLowerCase(),
                    apiKey: llmConfig.apiKey,
                    imageQuality,
                  }}
                />
              </div>
            )}

            {/* Settings & Configuration Cards View */}
            {view === 'config' && (
              <div className="p-6 max-w-5xl mx-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <SocialAccountsCard
                    connections={connections}
                    onToggleConnect={handleToggleConnect}
                    platformStatus={platformStatus}
                  />
                  <LLMSelectorCard
                    config={llmConfig}
                    onChangeConfig={setLlmConfig}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <NicheInputCard
                    onGenerate={handleGenerateCalendar}
                    isGenerating={isGenerating}
                  />
                  <SettingsCard />
                </div>
              </div>
            )}

            {/* Fallback prompt if calendar is empty in board/month views */}
            {(view === 'board' || view === 'calendar') && !calendar && (
              <div className="flex flex-col items-center justify-center p-16 text-center max-w-md mx-auto my-12 bg-white rounded-2xl border border-dashed border-slate-300 shadow-sm">
                <div className="w-12 h-12 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center text-2xl mb-3">
                  🗓️
                </div>
                <h3 className="font-bold text-sm text-slate-800 mb-1">Calendar Studio Ready</h3>
                <p className="text-xs text-slate-500 mb-4">
                  Define your niche to synthesize a fresh 3-day multi-platform batch, or load a sample batch instantly.
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfigModal('niche')}
                    className="btn btn-primary"
                  >
                    <Sparkles size={13} />
                    <span>Synthesize Content Batch</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setCalendar(createSampleCalendar())}
                    className="btn btn-secondary"
                  >
                    <span>Load Sample Batch</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>

        {/* ── Right Community & AI Agent Drawer ─────────────── */}
        <RightCommunitySidebar
          isMobileOpen={isMobileCommunityOpen}
          onCloseMobile={() => setIsMobileCommunityOpen(false)}
          calendar={calendar}
          connections={connections}
          platformStatus={platformStatus}
          isGenerating={isGenerating}
          publishingId={publishingId}
          onApproveBatch={handleApproveBatch}
          onRefreshCalendar={restoreCalendar}
          onSelectView={setView}
        />
      </div>

      {/* ── Modals & Dialogs ─────────────────────────────────── */}
      {/* Subscription Modal */}
      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        currentSubscription={subscription}
        onPlanUpdated={(newSub) => {
          setSubscription(newSub);
          showToast(`Plan updated to ${newSub.tier}!`);
        }}
      />

      {/* Post Editor Modal */}
      {editor && (
        <PostEditorModal
          post={editor.post}
          group={siblingsForDay(editor.dayIndex)}
          dayIndex={editor.dayIndex}
          llm={{
            provider: String(llmConfig.provider || '').toLowerCase(),
            apiKey: llmConfig.apiKey,
            imageQuality,
          }}
          onSave={handleUpdatePost}
          onClose={() => setEditor(null)}
          onApprovePost={(p) => handleUpdatePost(editor.dayIndex, p.id, { status: 'APPROVED' })}
          onDispatchPost={(p) => setConfirmDispatch(p)}
          publishingId={publishingId}
        />
      )}

      {/* Dispatch Confirm Dialog */}
      {confirmDispatch && (
        <DispatchConfirmDialog
          post={confirmDispatch}
          connections={connections}
          platformStatus={platformStatus}
          onCancel={() => setConfirmDispatch(null)}
          onConfirm={(post, opts) => {
            setConfirmDispatch(null);
            handlePublishSinglePost(post, opts);
          }}
        />
      )}

      {/* Quick Config Drawer / Modal from Left Tools */}
      {configModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-2xl relative">
            <button
              type="button"
              onClick={() => setConfigModal(null)}
              className="absolute top-4 right-4 p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-700"
            >
              <X size={18} />
            </button>

            {configModal === 'niche' && (
              <NicheInputCard
                onGenerate={handleGenerateCalendar}
                isGenerating={isGenerating}
              />
            )}
            {configModal === 'llm' && (
              <LLMSelectorCard
                config={llmConfig}
                onChangeConfig={setLlmConfig}
              />
            )}
            {configModal === 'settings' && <SettingsCard />}
            {configModal === 'channels' && (
              <SocialAccountsCard
                connections={connections}
                onToggleConnect={handleToggleConnect}
                platformStatus={platformStatus}
              />
            )}
          </div>
        </div>
      )}

      {/* ── Mobile Bottom Navigation Bar (Hidden on Desktop >= lg) ── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 px-2 py-1.5 flex items-center justify-around shadow-lg select-none">
        <button
          type="button"
          onClick={() => {
            setView('canvas');
            setIsMobileToolsOpen(false);
            setIsMobileCommunityOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-all ${
            view === 'canvas' && !isMobileToolsOpen && !isMobileCommunityOpen
              ? 'text-sky-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <GitBranch size={18} className={view === 'canvas' && !isMobileToolsOpen && !isMobileCommunityOpen ? 'text-sky-600' : 'text-slate-400'} />
          <span>Flow</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setView('board');
            setIsMobileToolsOpen(false);
            setIsMobileCommunityOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-all ${
            view === 'board' && !isMobileToolsOpen && !isMobileCommunityOpen
              ? 'text-purple-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <LayoutList size={18} className={view === 'board' && !isMobileToolsOpen && !isMobileCommunityOpen ? 'text-purple-600' : 'text-slate-400'} />
          <span>Studio</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setView('calendar');
            setIsMobileToolsOpen(false);
            setIsMobileCommunityOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-all ${
            view === 'calendar' && !isMobileToolsOpen && !isMobileCommunityOpen
              ? 'text-amber-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Calendar size={18} className={view === 'calendar' && !isMobileToolsOpen && !isMobileCommunityOpen ? 'text-amber-600' : 'text-slate-400'} />
          <span>Month</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsMobileToolsOpen((v) => !v);
            setIsMobileCommunityOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-all ${
            isMobileToolsOpen
              ? 'text-sky-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <Sliders size={18} className={isMobileToolsOpen ? 'text-sky-600' : 'text-slate-400'} />
          <span>Tools</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setIsMobileCommunityOpen((v) => !v);
            setIsMobileToolsOpen(false);
          }}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-lg text-[10px] font-semibold transition-all ${
            isMobileCommunityOpen
              ? 'text-indigo-600 font-bold'
              : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          <MessageSquare size={18} className={isMobileCommunityOpen ? 'text-indigo-600' : 'text-slate-400'} />
          <span>Chat</span>
        </button>
      </nav>

      {/* ── Floating Toast Alert ────────────────────────────── */}
      {notification && (
        <div className="toast-float">
          <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
          <span className="font-mono text-xs">{notification}</span>
        </div>
      )}
    </div>
  );
}
