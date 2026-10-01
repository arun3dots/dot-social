'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import SocialAccountsCard from '@/components/SocialAccountsCard';
import LLMSelectorCard from '@/components/LLMSelectorCard';
import NicheInputCard from '@/components/NicheInputCard';
import CalendarReviewBoard from '@/components/CalendarReviewBoard';
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

const INITIAL_USER: UserSession = {
  id: 'usr_creator_01',
  name: 'Jane Creator',
  email: 'jane@creatorstudio.dev',
  role: 'CREATOR',
  avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
};

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
  const [user, setUser] = useState<UserSession>(INITIAL_USER);
  const [activeTab, setActiveTab] = useState<'creator' | 'logs'>('creator');
  const [connections, setConnections] = useState<SocialConnection[]>(INITIAL_CONNECTIONS);
  const [llmConfig, setLlmConfig] = useState<LLMConfig>(INITIAL_LLM);
  const [calendar, setCalendar] = useState<ContentCalendar | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [notification, setNotification] = useState<string | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionInfo>(getDefaultSubscription('PRO_CREATOR'));
  const [isSubModalOpen, setIsSubModalOpen] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

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
    fetch('/api/calendar/latest')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
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
        setNotification('Restored your last saved content calendar.');
        setTimeout(() => setNotification(null), 4000);
      })
      .catch(console.error);
  }, []);

  // Reflect the OAuth callback result: /?connected=LINKEDIN&mode=live|sandbox
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const qs = new URLSearchParams(window.location.search);
    const platform = qs.get('connected');
    if (!platform) return;
    const mode = qs.get('mode') || 'live';
    setConnections((prev) =>
      prev.map((c) =>
        c.platform === platform
          ? {
              ...c,
              connected: true,
              isSandbox: mode === 'sandbox',
              handle: mode === 'sandbox' ? `${platform} (sandbox)` : `${platform} connected`,
            }
          : c
      )
    );
    setNotification(
      mode === 'sandbox'
        ? `${platform} connected in SANDBOX mode — no real credentials configured, this is not a live connection.`
        : `${platform} connected successfully.`
    );
    window.history.replaceState({}, '', window.location.pathname);
  }, []);

  const showToast = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 4000);
  };

  const handleToggleConnect = (platform: Platform) => {
    const conn = connections.find((c) => c.platform === platform);
    if (conn?.connected) {
      setConnections(
        connections.map((c) =>
          c.platform === platform ? { ...c, connected: false, handle: 'Not connected' } : c
        )
      );
      showToast(`Disconnected ${platform}`);
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
      showToast('3-Day Content Calendar batch synthesized successfully!');
    } catch (e: any) {
      showToast(`Generation error: ${e.message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdatePost = (dayIndex: number, postId: string, updatedFields: Partial<PostItem>) => {
    if (!calendar) return;

    const newDays = calendar.days.map((day) => {
      if (day.dayIndex !== dayIndex) return day;
      return {
        ...day,
        posts: day.posts.map((p) => (p.id === postId ? { ...p, ...updatedFields } : p)),
      };
    });

    setCalendar({ ...calendar, days: newDays });
    showToast('Post updated');
  };

  const handleApproveBatch = () => {
    if (!calendar) return;

    const newDays = calendar.days.map((day) => ({
      ...day,
      posts: day.posts.map((p) => ({
        ...p,
        status: 'SCHEDULED' as const,
      })),
    }));

    setCalendar({
      ...calendar,
      batchStatus: 'SCHEDULED',
      days: newDays,
    });

    showToast('All 9 posts approved & queued for scheduled automated publishing!');
  };

  const handlePublishSinglePost = async (post: PostItem) => {
    setPublishingId(post.id);
    try {
      const res = await fetch('/api/calendar/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post,
          isSandbox: true,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        const publishedUrl = data.results?.[0]?.externalUrl || `https://${post.platform.toLowerCase()}.com/mock_post`;
        if (calendar) {
          const updatedDays = calendar.days.map((day) => ({
            ...day,
            posts: day.posts.map((p) =>
              p.id === post.id
                ? { ...p, status: 'PUBLISHED' as const, externalUrl: publishedUrl, publishedAt: new Date().toISOString() }
                : p
            ),
          }));
          setCalendar({ ...calendar, days: updatedDays });
        }
        showToast(`Dispatched to ${post.platform}!`);
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
              />
              <LLMSelectorCard
                config={llmConfig}
                onChangeConfig={setLlmConfig}
              />
            </div>

            {/* Niche onboarding & generator */}
            <NicheInputCard
              onGenerate={handleGenerateCalendar}
              isGenerating={isGenerating}
            />

            {/* 3-Day Batch Review & Approval Board */}
            {calendar && (
              <CalendarReviewBoard
                calendar={calendar}
                onUpdatePost={handleUpdatePost}
                onApproveBatch={handleApproveBatch}
                onPublishSinglePost={handlePublishSinglePost}
                publishingId={publishingId}
              />
            )}
          </div>
        )}

        {activeTab === 'logs' && <LogsViewer />}
      </main>
    </div>
  );
}
