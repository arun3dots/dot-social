'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import SocialAccountsCard, { PlatformStatus } from '@/components/SocialAccountsCard';
import LLMSelectorCard from '@/components/LLMSelectorCard';
import NicheInputCard from '@/components/NicheInputCard';
import CalendarReviewBoard from '@/components/CalendarReviewBoard';
import CalendarMonthView from '@/components/CalendarMonthView';
import SettingsCard from '@/components/SettingsCard';
import LogsViewer from '@/components/LogsViewer';
import SubscriptionModal from '@/components/SubscriptionModal';
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

export default function CreatorHomePage() {
  // Identity comes from the signed session - never a hardcoded placeholder.
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
  // Board (day by day) or the month calendar.
  const [view, setView] = useState<'board' | 'calendar'>('board');

  // The saved calendar comes from the server, where the posts table is the source of truth.
  const restoreCalendar = async (opts?: { silent?: boolean }) => {
    try {
      const r = await fetch('/api/calendar/latest');
      const data = r.ok ? await r.json() : null;
      const c = data?.calendar;
      if (!c) return;
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
        setNotification('Restored your last saved content calendar.');
        setTimeout(() => setNotification(null), 4000);
      }
    } catch (e) {
      console.error(e);
    }
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

    // First run: send the user through onboarding before the studio is usable.
    fetch('/api/onboarding')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.profile && d.profile.onboardingCompleted === false) {
          window.location.href = '/onboarding';
        }
      })
      .catch(console.error);

    // Restore the last SAVED calendar, so a page reload does not wipe the work.
    restoreCalendar();
  }, []);

  // Reflect the OAuth handoff result.
  //   success: /?connected=LINKEDIN&mode=live&handle=<real handle>
  //   failure: /?oauth_error=<why>   (missing config, state mismatch, provider refusal)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);

    const oauthError = qs.get('oauth_error');
    if (oauthError) {
      setNotification(oauthError);
      setTimeout(() => setNotification(null), 9000);
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
    setNotification(
      mode === 'sandbox'
        ? `${platform} connected in SANDBOX mode — no real credentials configured, this is not a live connection.`
        : `${platform} connected as ${handle}.`
    );
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleToggleConnect = async (platform: Platform) => {
    const conn = connections.find((c) => c.platform === platform);
    if (conn?.connected) {
      // Revoke it for real. This used to only flip local state, so the channel reappeared as
      // connected after a reload.
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
        showToast(
          data.wasConnected ? `Disconnected ${platform} and revoked its token.` : `${platform} was not connected.`
        );
      } catch (e: any) {
        showToast(`Could NOT disconnect ${platform}: ${e.message}`);
      }
      return;
    }
    // Real OAuth handoff: the server route builds the provider authorization URL.
    showToast(`Starting ${platform} authorization...`);
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
      const imgs = data.imageSummary;
      const imgNote = imgs
        ? ` · images ${imgs.generated}/${imgs.attempted}${imgs.skipped ? ` (${imgs.skipped} over the per-request cap)` : ''}`
        : '';
      showToast(`${dayCount}-day batch generated with ${data.providerUsed || 'a model'}${imgNote}.`);
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

    // Fields the database owns must be written to it, or a reload silently undoes the review.
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
      // Reflect the SERVER's state, not what we hoped for.
      applyLocally(dayIndex, postId, {
        ...updatedFields,
        status: (data.post?.status as PostItem['status']) || (updatedFields.status as PostItem['status']),
      });
      showToast(
        updatedFields.status
          ? `Post ${data.post.status} - persisted`
          : 'Changes saved - persisted'
      );
    } catch (e: any) {
      showToast(`NOT saved: ${e.message}`);
    }
  };

  /**
   * Add one extra post to a particular day. The server decides the id and the scheduled slot; we
   * reload the calendar from it afterwards so the day, the board and the calendar all agree.
   */
  const handleAddPost = async (args: {
    dayIndex?: number;
    date: string;
    platform: Platform;
    generateContent: boolean;
    content?: string;
  }): Promise<{ ok: boolean; note: string; post?: PostItem; dayIndex?: number }> => {
    try {
      const res = await fetch('/api/calendar/posts/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: calendar?.calendarId,
          dayIndex: args.dayIndex,
          date: args.date,
          platform: args.platform,
          generateContent: args.generateContent,
          content: args.content,
          provider: String(llmConfig.provider || '').toLowerCase(),
          apiKey: llmConfig.apiKey,
        }),
      });
      const data = await res.json();
      if (!res.ok) return { ok: false, note: data.error || 'could not add the post' };

      await restoreCalendar({ silent: true });
      const post: PostItem | undefined = data.post;
      return {
        ok: true,
        note: data.note || `Added a ${args.platform} post on ${args.date}.`,
        post,
        dayIndex: data.dayIndex,
      };
    } catch (e: any) {
      return { ok: false, note: `could not add the post: ${e.message}` };
    }
  };

  const handleDeletePost = async (postId: string): Promise<{ ok: boolean; note: string }> => {
    try {
      const res = await fetch(`/api/calendar/posts?postId=${encodeURIComponent(postId)}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) return { ok: false, note: data.error || 'could not remove the post' };
      await restoreCalendar({ silent: true });
      return { ok: true, note: `Removed ${postId}.` };
    } catch (e: any) {
      return { ok: false, note: `could not remove the post: ${e.message}` };
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

      // Report the real number that changed, and what the database now holds.
      const counts = (data.counts || []).map((c: any) => `${c.count} ${c.status}`).join(', ');
      showToast(
        `${data.updatedPosts} post(s) approved and persisted${counts ? ' — database now holds: ' + counts : ''}.`
      );
    } catch (e: any) {
      showToast(`Approval NOT saved: ${e.message}`);
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
        const result = data.results?.[0] || {};
        if (result.status !== 'PUBLISHED' || !result.externalUrl) {
          // Nothing was published. Say so, with the server's reason - do not invent a URL.
          showToast(`${post.platform}: NOT published — ${result.reason || 'no reason returned'}`);
          setCalendar((prev) =>
            prev
              ? {
                  ...prev,
                  days: prev.days.map((d) => ({
                    ...d,
                    posts: d.posts.map((p) =>
                      p.id === post.id ? { ...p, status: (result.statusAfter || p.status) as PostItem['status'] } : p
                    ),
                  })),
                }
              : prev
          );
          return;
        }
        const publishedUrl = result.externalUrl;
        // The server decides the status: a manual dispatch that keeps the schedule leaves the post
        // APPROVED (so it still fires at its scheduled time) and records the manual post separately.
        const manual = data.manual || {};
        const keepsSchedule = manual.keepScheduled !== false;
        if (calendar) {
          const updatedDays = calendar.days.map((day) => ({
            ...day,
            posts: day.posts.map((p) =>
              p.id === post.id
                ? {
                    ...p,
                    status: (manual.statusAfter || p.status) as PostItem['status'],
                    manualExternalUrl: manual.accepted ? publishedUrl : p.manualExternalUrl,
                    manualPublishedAt: manual.accepted
                      ? manual.manualPublishedAt || new Date().toISOString()
                      : p.manualPublishedAt,
                    externalUrl: keepsSchedule ? p.externalUrl : publishedUrl,
                    publishedAt: keepsSchedule ? p.publishedAt : new Date().toISOString(),
                  }
                : p
            ),
          }));
          setCalendar({ ...calendar, days: updatedDays });
        }
        showToast(data.note || `Dispatched to ${post.platform}!`);
      } else {
        throw new Error(data.details || 'Publishing failed');
      }
    } catch (e: any) {
      showToast(`Publish error: ${e.message}`);
    } finally {
      setPublishingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-[#f1f5f9] flex flex-col font-sans">
      <Header
        user={user}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        subscription={subscription}
        onOpenSubscriptionModal={() => setIsSubModalOpen(true)}
      />

      <SubscriptionModal
        isOpen={isSubModalOpen}
        onClose={() => setIsSubModalOpen(false)}
        currentSubscription={subscription}
        onPlanUpdated={(newSub) => {
          setSubscription(newSub);
          showToast(`Plan successfully updated to ${newSub.tier}!`);
        }}
      />

      {notification && (
        <div className="fixed bottom-6 right-6 bg-[#141a26] border border-cyan-500/80 text-white py-3 px-5 rounded-md font-mono text-xs z-50 shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
          <span className="text-cyan-400 font-bold">›</span>
          <span>{notification}</span>
        </div>
      )}

      <main className="max-w-7xl mx-auto w-full p-6">
        {activeTab === 'creator' && (
          <div className="flex flex-col gap-5">
            {/* Top configuration row */}
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
              <SettingsCard />
            </div>

            {/* Niche onboarding & generator */}
            <NicheInputCard
              onGenerate={handleGenerateCalendar}
              isGenerating={isGenerating}
            />

            {/* Batch review: day-by-day board, or the month calendar */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono text-zinc-500">View:</span>
              {(
                [
                  { id: 'board', label: 'Day board' },
                  { id: 'calendar', label: 'Calendar' },
                ] as const
              ).map((v) => (
                <button
                  key={v.id}
                  onClick={() => setView(v.id)}
                  className={`px-3 py-1.5 rounded text-[10px] font-mono border ${
                    view === v.id
                      ? 'bg-cyan-600 text-black border-cyan-500 font-semibold'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {calendar && view === 'board' && (
              <CalendarReviewBoard
                calendar={calendar}
                onUpdatePost={handleUpdatePost}
                onApproveBatch={handleApproveBatch}
                onPublishSinglePost={handlePublishSinglePost}
                publishingId={publishingId}
                connections={connections}
                platformStatus={platformStatus}
                llm={{
                  provider: String(llmConfig.provider || '').toLowerCase(),
                  apiKey: llmConfig.apiKey,
                  imageQuality,
                }}
              />
            )}

            {calendar && view === 'calendar' && (
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
            )}
          </div>
        )}

        {activeTab === 'logs' && <LogsViewer />}
      </main>
    </div>
  );
}
