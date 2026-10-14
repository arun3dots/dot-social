'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
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
  Bot,
  Loader2,
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

// Dynamically synthesize a fresh 3-day multi-channel batch tailored to creator preferences
const createPreferenceBasedCalendar = (opts?: {
  niche?: string;
  audience?: string;
  authorName?: string;
  handle?: string;
}): ContentCalendar => {
  const now = new Date();
  const makeDate = (offsetDays: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().split('T')[0];
  };

  const niche = opts?.niche?.trim() || 'Content Strategy & Growth';
  const audience = opts?.audience?.trim() || 'Community & Audience';

  return {
    calendarId: `cal_${Date.now().toString(36)}`,
    batchStatus: 'PENDING_APPROVAL',
    niche,
    audience,
    tone: 'Engaging, insightful, authentic',
    generatedAt: now.toISOString(),
    days: [
      {
        dayIndex: 1,
        date: makeDate(0),
        theme: `${niche}: Foundational Principles & Core Value`,
        posts: [
          {
            id: `post-d1-tw-${Date.now()}`,
            platform: 'TWITTER',
            content: `The biggest mistake in ${niche} is overcomplicating the fundamentals.\n\nMaster the core framework first:\n1. Clarity of purpose\n2. Consistent execution\n3. Value-first delivery\n\nWhat is your #1 priority this week?`,
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 3600000 * 2).toISOString(),
            mediaPrompt: `Clean, modern visual illustrating ${niche} essentials`,
          },
          {
            id: `post-d1-li-${Date.now()}`,
            platform: 'LINKEDIN',
            content: `In ${niche}, true leverage comes from systemized consistency.\n\nMost practitioners spread themselves too thin instead of doubling down on what drives measurable results.\n\n3 principles that make the difference for ${audience}:\n• Focus on solving real bottlenecks\n• Establish repeatable processes before scaling\n• Measure outcomes, not just activity\n\nHow is your team approaching this right now?`,
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 3600000 * 4).toISOString(),
            mediaPrompt: `Executive diagram depicting strategic clarity and execution in ${niche}`,
          },
          {
            id: `post-d1-ig-${Date.now()}`,
            platform: 'INSTAGRAM',
            content: `Simplify your approach to ${niche} ⚡\n\nHere is what you actually need to focus on today:\n\n1️⃣ Clear vision\n2️⃣ Daily habits\n3️⃣ Continuous feedback\n\nSave this post to revisit during your next planning session! 📌`,
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 3600000 * 6).toISOString(),
            mediaPrompt: `Aesthetic gradient visual card highlighting 3 foundational pillars of ${niche}`,
          },
        ],
      },
      {
        dayIndex: 2,
        date: makeDate(1),
        theme: `${niche}: Actionable Frameworks & Execution`,
        posts: [
          {
            id: `post-d2-tw-${Date.now()}`,
            platform: 'TWITTER',
            content: `Actionable insight for ${audience}:\n\nStop waiting for perfect conditions. Test small hypotheses, evaluate data, and iterate quickly.\n\nSmall daily compounding beats occasional intensity every time.`,
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 86400000 + 3600000 * 2).toISOString(),
            mediaPrompt: `Minimalist graphic showing compounding progression curve in ${niche}`,
          },
          {
            id: `post-d2-li-${Date.now()}`,
            platform: 'LINKEDIN',
            content: `The difference between theory and execution in ${niche}:\n\nTheory discusses what might work. Execution measures what actually delivers value for ${audience}.\n\nWhen you build structured feedback loops into your process, you reduce friction and accelerate growth.\n\nWhat is your biggest execution win so far this quarter?`,
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 86400000 + 3600000 * 4).toISOString(),
            mediaPrompt: `Professional presentation slide summarizing the execution roadmap in ${niche}`,
          },
          {
            id: `post-d2-ig-${Date.now()}`,
            platform: 'INSTAGRAM',
            content: `Framework breakdown for ${niche} 📊\n\nSwipe through for actionable steps you can apply immediately:\n\n✨ Define the target outcome\n🛠️ Streamline the process\n📈 Track the impact\n\nDouble tap if this resonates with your journey! 👇`,
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 86400000 + 3600000 * 6).toISOString(),
            mediaPrompt: `Modern carousel cover slide with sleek typography for ${niche}`,
          },
        ],
      },
      {
        dayIndex: 3,
        date: makeDate(2),
        theme: `${niche}: Scaling Growth & Consistency`,
        posts: [
          {
            id: `post-d3-tw-${Date.now()}`,
            platform: 'TWITTER',
            content: `Scalability in ${niche} isn't about doing more things.\n\nIt's about removing bottlenecks and doing high-impact actions with relentless quality.`,
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 86400000 * 2 + 3600000 * 2).toISOString(),
            mediaPrompt: `High-contrast infographic showing scalable growth loops in ${niche}`,
          },
          {
            id: `post-d3-li-${Date.now()}`,
            platform: 'LINKEDIN',
            content: `Reflecting on sustainable growth in ${niche}:\n\nAs our industry evolves, the creators and teams who stand out are those who pair authenticity with disciplined systems.\n\nFor ${audience}, that means delivering genuine value at every touchpoint.\n\nWhat is your key priority for the coming month?`,
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 86400000 * 2 + 3600000 * 4).toISOString(),
            mediaPrompt: `Clean modern conceptual artwork of future growth in ${niche}`,
          },
          {
            id: `post-d3-ig-${Date.now()}`,
            platform: 'INSTAGRAM',
            content: `Growth mindset in ${niche} 💡\n\nRemember: Quality > Quantity, every single time.\n\nBuild for long-term trust, and the results will compound.\n\nShare this with a fellow creator who needs some motivation today! 🚀`,
            status: 'PENDING_APPROVAL',
            scheduledTime: new Date(now.getTime() + 86400000 * 2 + 3600000 * 6).toISOString(),
            mediaPrompt: `Warm aesthetic visual quote card on personal growth in ${niche}`,
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
  const [calendar, setCalendar] = useState<ContentCalendar | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo>(getDefaultSubscription('PRO_CREATOR'));
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);
  const [platformStatus, setPlatformStatus] = useState<PlatformStatus[]>([]);
  const [imageQuality, setImageQuality] = useState('low');

  // Canvas View Switcher: 'calendar' (Month View) | 'board' (Calendar Studio) | 'canvas' (Visual Workflow) | 'config'
  const [view, setView] = useState<'canvas' | 'board' | 'calendar' | 'config'>('calendar');

  // Modal editors & confirm dispatch
  const [editor, setEditor] = useState<{ post: PostItem; dayIndex: number } | null>(null);
  const [confirmDispatch, setConfirmDispatch] = useState<PostItem | null>(null);
  const [configModal, setConfigModal] = useState<'niche' | 'llm' | 'settings' | 'channels' | null>(null);

  // Mobile & Desktop drawers state
  const [isMobileToolsOpen, setIsMobileToolsOpen] = useState(false);
  const [isMobileCommunityOpen, setIsMobileCommunityOpen] = useState(false);
  const [isLeftDrawerOpen, setIsLeftDrawerOpen] = useState(true);
  const [isRightDrawerOpen, setIsRightDrawerOpen] = useState(true);

  // Responsive Drawer Toggles
  const handleToggleLeftDrawer = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMobileToolsOpen((v) => !v);
    } else {
      setIsLeftDrawerOpen((v) => !v);
    }
  };

  const handleToggleRightDrawer = () => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsMobileCommunityOpen((v) => !v);
    } else {
      setIsRightDrawerOpen((v) => !v);
    }
  };

  // Onboarding profile ref for preference generation
  const userProfileRef = useRef<{ niche?: string; targetAudience?: string; name?: string }>({});

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const restoreCalendar = async (opts?: { silent?: boolean }) => {
    try {
      const r = await fetch('/api/calendar/latest');
      const data = r.ok ? await r.json() : null;
      const c = data?.calendar;
      if (c && Array.isArray(c.days) && c.days.length > 0) {
        setCalendar({
          calendarId: c.calendarId,
          batchStatus: c.batchStatus || 'PENDING_APPROVAL',
          niche: c.niche || '',
          audience: c.audience || '',
          tone: c.tone || '',
          generatedAt: c.savedAt || new Date().toISOString(),
          days: c.days,
        });
        if (!opts?.silent) {
          showToast('Restored your last saved content calendar.');
        }
        return;
      }
    } catch (e) {
      console.error(e);
    }

    // Do NOT auto-fill fake or pre-defined posts for new users.
    // Keep calendar as null so the empty state with the generation button is shown!
    setCalendar(null);
  };

  const handleGenerateFirstPosts = async () => {
    setIsGenerating(true);
    showToast('Synthesizing your first post contents…');
    try {
      const niche = userProfileRef.current.niche?.trim() || 'Content Strategy & Growth';
      const audience = userProfileRef.current.targetAudience?.trim() || 'Community & Audience';
      const tone = 'Insightful, engaging, actionable';

      const res = await fetch('/api/calendar/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          niche,
          audience,
          tone,
          provider: (llmConfig.provider || 'openai').toLowerCase(),
          apiKey: llmConfig.apiKey || '',
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.days) && data.days.length > 0) {
          setCalendar(data);
          showToast(`Generated ${data.days.length}-day content calendar!`);
          return;
        }
      }

      // Fallback: create fresh tailored preference-based calendar
      const cal = createPreferenceBasedCalendar({
        niche,
        audience,
        authorName: user.name,
      });
      setCalendar(cal);
      showToast('Generated 3-day content calendar tailored to your preferences!');
    } catch (err: any) {
      console.error(err);
      const cal = createPreferenceBasedCalendar({
        authorName: user.name,
      });
      setCalendar(cal);
      showToast('Generated 3-day content calendar!');
    } finally {
      setIsGenerating(false);
    }
  };

  const isCalendarEmpty =
    !calendar ||
    !Array.isArray(calendar.days) ||
    calendar.days.length === 0 ||
    calendar.days.every((d) => !Array.isArray(d.posts) || d.posts.length === 0);

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
          setUser((prev) => ({
            ...prev,
            id: s.user.id || prev.id || '',
            name: s.user.name || (s.user.email ? s.user.email.split('@')[0] : 'Creator'),
            email: s.user.email || prev.email || '',
            role: (s.user.role || prev.role || 'CREATOR') as any,
            avatar: s.user.image || prev.avatar || '',
          }));
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
        if (d?.profile) {
          if (d.profile.onboardingCompleted === false) {
            window.location.href = '/onboarding';
          }
          userProfileRef.current = {
            niche: d.profile.niche,
            targetAudience: d.profile.targetAudience,
            name: d.profile.name,
          };
          setUser((prev) => ({
            ...prev,
            name: d.profile.name || prev.name || (d.profile.email ? d.profile.email.split('@')[0] : 'Creator'),
            screenName: d.profile.screenName || prev.screenName || '',
          }));
        }
        restoreCalendar({ silent: true });
      })
      .catch((err) => {
        console.error(err);
        restoreCalendar({ silent: true });
      });
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
    generateImage?: boolean;
    imagePrompt?: string;
    imagePerPlatform?: boolean;
    mediaUrl?: string;
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

  const handleDuplicatePost = async (
    sourcePost: PostItem,
    targetDate: string,
    targetTime: string,
    autoSchedule: boolean
  ) => {
    try {
      const scheduledIso = `${targetDate}T${targetTime}:00`;
      const res = await fetch('/api/calendar/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: calendar?.calendarId,
          date: targetDate,
          platforms: [sourcePost.platform],
          generateContent: false,
          content: sourcePost.content,
          generateImage: false,
          mediaUrl: sourcePost.mediaUrl || undefined,
          provider: String(llmConfig.provider || '').toLowerCase(),
          apiKey: llmConfig.apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not duplicate post');
      const newPost = (data.posts && data.posts[0]) || data.post;
      if (newPost) {
        await fetch('/api/calendar/posts', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            postId: newPost.id,
            scheduledTime: scheduledIso,
            status: autoSchedule ? 'APPROVED' : 'PENDING_APPROVAL',
          }),
        });
      }
      await restoreCalendar({ silent: true });
      showToast(autoSchedule ? `Duplicated & armed for auto-publish on ${targetDate}!` : `Duplicated to ${targetDate}!`);
    } catch (e: any) {
      showToast(`Duplicate failed: ${e.message}`);
      throw e;
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

  const availableImages = useMemo(() => {
    const images = new Set<string>();
    for (const d of calendar?.days || []) {
      for (const p of d.posts || []) {
        if (p.mediaUrl && typeof p.mediaUrl === 'string') {
          images.add(p.mediaUrl);
        }
      }
    }
    return Array.from(images);
  }, [calendar]);

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
        isLeftDrawerOpen={isLeftDrawerOpen}
        onToggleLeftDrawer={handleToggleLeftDrawer}
        isRightDrawerOpen={isRightDrawerOpen}
        onToggleRightDrawer={handleToggleRightDrawer}
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
          isDesktopOpen={isLeftDrawerOpen}
          onToggleDesktop={() => setIsLeftDrawerOpen((v) => !v)}
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
          <div className="h-10 bg-white border-b border-slate-200 px-4 flex items-center justify-between text-xs select-none shrink-0 z-10 overflow-x-auto gap-2">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider font-mono hidden sm:inline">
                Workspace:
              </span>
              <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200">
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

            <div className="flex items-center gap-2.5 text-slate-400 text-[11px] font-mono shrink-0">
              <span className="hidden md:inline">Auto-Publish Engine Active</span>
              {!isRightDrawerOpen && (
                <button
                  type="button"
                  onClick={() => setIsRightDrawerOpen(true)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors shrink-0 font-sans"
                  title="Open AI Agent drawer"
                >
                  <Bot size={13} className="text-sky-600" />
                  <span>AI Agent</span>
                </button>
              )}
            </div>
          </div>

          {/* ── Active Canvas Content ────────────────────────── */}
          <div className="flex-1 overflow-auto relative">
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

            {/* Empty State for New Users (Prompt to generate first post contents) */}
            {isCalendarEmpty && view !== 'config' && (
              <div className="flex flex-col items-center justify-center min-h-[calc(100vh-140px)] p-6 sm:p-12 text-center max-w-xl mx-auto animate-in fade-in duration-200">
                <div className="w-full bg-white rounded-3xl border border-slate-200/90 shadow-xl p-8 sm:p-10 flex flex-col items-center relative overflow-hidden">
                  {/* Top gradient highlight rail */}
                  <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-sky-400 via-indigo-500 to-purple-500" />
                  
                  {/* Icon badge */}
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-50 to-blue-50 border border-sky-100 flex items-center justify-center text-sky-600 shadow-xs mb-5">
                    <Sparkles size={30} className="text-sky-600" />
                  </div>

                  <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-sky-600 bg-sky-50 px-3 py-1 rounded-full border border-sky-200 mb-3">
                    Content Automation Studio
                  </span>

                  <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 tracking-tight">
                    Welcome to Your Content Studio
                  </h2>

                  <p className="text-xs sm:text-sm text-slate-500 max-w-md mb-8 leading-relaxed">
                    You haven&apos;t generated any posts yet. Start by generating your first 3-day multi-channel batch tailored to your audience across Twitter (X), LinkedIn, and Instagram.
                  </p>

                  {/* Primary CTA Button */}
                  <button
                    type="button"
                    onClick={handleGenerateFirstPosts}
                    disabled={isGenerating}
                    className="w-full sm:w-auto px-7 py-3.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={16} className="animate-spin shrink-0" />
                        <span>Generating your first post contents…</span>
                      </>
                    ) : (
                      <>
                        <Sparkles size={16} className="text-sky-200 shrink-0" />
                        <span>Click here to generate your first post contents</span>
                      </>
                    )}
                  </button>

                  {/* Secondary links */}
                  <div className="flex flex-wrap items-center justify-center gap-4 mt-6 text-xs text-slate-500">
                    <button
                      type="button"
                      onClick={() => setConfigModal('niche')}
                      className="hover:text-slate-900 font-medium underline underline-offset-4 transition-colors"
                    >
                      Customize niche & strategy first
                    </button>
                    <span className="hidden sm:inline">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        const cal = createPreferenceBasedCalendar({ authorName: user.name });
                        setCalendar(cal);
                        showToast('Loaded 3-day starter template.');
                      }}
                      className="hover:text-slate-900 font-medium transition-colors"
                    >
                      Load starter template
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* When Calendar has content, render the active view */}
            {!isCalendarEmpty && (
              <>
                {/* Visual Workflow Canvas View */}
                {view === 'canvas' && (
                  <WorkflowCanvas
                    user={user}
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
                      availableImages={availableImages}
                      onDuplicatePost={handleDuplicatePost}
                      publishingId={publishingId}
                      user={user}
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
                      availableImages={availableImages}
                      onDuplicatePost={handleDuplicatePost}
                      publishingId={publishingId}
                      user={user}
                      connections={connections}
                      platformStatus={platformStatus}
                      llm={{
                        provider: String(llmConfig.provider || '').toLowerCase(),
                        apiKey: llmConfig.apiKey,
                        imageQuality,
                      }}
                      onGenerateFirstPosts={handleGenerateFirstPosts}
                    />
                  </div>
                )}
              </>
            )}
          </div>

        </div>

        {/* ── Right Community & AI Agent Drawer ─────────────── */}
        <RightCommunitySidebar
          isDesktopOpen={isRightDrawerOpen}
          onToggleDesktop={() => setIsRightDrawerOpen((v) => !v)}
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
          availableImages={availableImages}
          onDuplicatePost={handleDuplicatePost}
          llm={{
            provider: String(llmConfig.provider || '').toLowerCase(),
            apiKey: llmConfig.apiKey,
            imageQuality,
          }}
          user={user}
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
