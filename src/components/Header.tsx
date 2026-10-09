'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { UserSession, SubscriptionInfo } from '@/types';
import {
  Diamond,
  Gift,
  Bot,
  Bell,
  Sparkles,
  Send,
  Calendar,
  Loader2,
  LogOut,
  Menu,
  MessageSquare,
} from 'lucide-react';

interface HeaderProps {
  user: UserSession;
  activeTab: 'creator' | 'logs';
  onTabChange: (tab: 'creator' | 'logs') => void;
  subscription: SubscriptionInfo;
  onOpenSubscriptionModal: () => void;
  onQuickGenerate?: () => void;
  onGoLive?: () => void;
  onSelectView?: (view: 'canvas' | 'board' | 'calendar') => void;
  onOpenLlmModal?: () => void;
  onToggleMobileTools?: () => void;
  onToggleMobileCommunity?: () => void;
  isGenerating?: boolean;
}

export default function Header({
  user,
  activeTab,
  onTabChange,
  subscription,
  onOpenSubscriptionModal,
  onQuickGenerate,
  onGoLive,
  onSelectView,
  onOpenLlmModal,
  onToggleMobileTools,
  onToggleMobileCommunity,
  isGenerating = false,
}: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout?to=creator', { method: 'POST' });
      await signOut({ callbackUrl: '/login', redirect: true });
    } catch {
      router.push('/login');
    }
  };

  const initials = user.name
    ? user.name.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()
    : (user.email?.[0] || 'C').toUpperCase();

  return (
    <header className="h-[56px] sm:h-[60px] bg-white text-slate-900 px-3 sm:px-6 flex items-center justify-between border-b border-slate-200/90 shadow-2xs select-none shrink-0 z-30">
      {/* ── Left side: Logo, Breadcrumbs & Flow Status (ManyChat Style) ─ */}
      <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
        {/* Mobile Tools Menu Toggle */}
        {onToggleMobileTools && (
          <button
            type="button"
            onClick={onToggleMobileTools}
            className="lg:hidden p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
            title="Open Step Library"
          >
            <Menu size={18} />
          </button>
        )}

        {/* App Logo */}
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
          <Sparkles size={16} />
        </div>

        {/* Flow Title & Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5 leading-tight">
              <span className="text-[11px] font-medium text-slate-400 hidden sm:inline">Campaigns /</span>
              <span className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                Omni-Channel Flow #1
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-mono hidden md:inline">
              Multi-channel auto publishing engine
            </span>
          </div>

          {/* Saved Status Indicator Pill */}
          <div className="hidden sm:inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-[10px] font-semibold px-2.5 py-0.5 rounded-full ml-1">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>All changes saved</span>
          </div>
        </div>
      </div>

      {/* ── Right side: Quick Actions, Publish Button & User Profile ── */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Quick Batch Synthesize */}
        {onQuickGenerate && (
          <button
            type="button"
            onClick={onQuickGenerate}
            disabled={isGenerating}
            className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold transition-colors"
            title="Synthesize fresh AI content batch"
          >
            <Sparkles size={12} className="text-sky-500" />
            <span>New Batch</span>
          </button>
        )}

        {/* Primary CTA: Publish & Go Live (ManyChat Signature Blue) */}
        <button
          type="button"
          onClick={onGoLive || onQuickGenerate}
          disabled={isGenerating}
          className="bg-[#0084ff] hover:bg-[#0073e6] active:scale-95 disabled:opacity-50 text-white font-semibold text-xs px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl flex items-center gap-1.5 transition-all shadow-xs shadow-blue-500/25"
          title="Run live social media batch dispatch"
        >
          {isGenerating ? (
            <>
              <Loader2 size={13} className="animate-spin" />
              <span className="hidden sm:inline">Publishing…</span>
            </>
          ) : (
            <>
              <Send size={12} />
              <span>Publish & Go Live</span>
            </>
          )}
        </button>

        {/* Mobile Community Sheet Toggle */}
        {onToggleMobileCommunity && (
          <button
            type="button"
            onClick={onToggleMobileCommunity}
            className="lg:hidden p-1.5 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 relative transition-colors"
            title="Open Community Chat"
          >
            <MessageSquare size={17} />
            <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-sky-500" />
          </button>
        )}

        {/* Action icons (desktop & tablet) */}
        <div className="hidden sm:flex items-center gap-1 text-slate-500 border-l border-slate-200 pl-2 sm:pl-3">
          {/* Subscription / Billing Quotas */}
          <button
            type="button"
            onClick={onOpenSubscriptionModal}
            className="w-8 h-8 rounded-xl hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors relative"
            title={`${subscription.tier} Plan — Quotas & Billing`}
          >
            <Gift size={15} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-sky-500" />
          </button>

          {/* AI / Agent config */}
          <button
            type="button"
            onClick={onOpenLlmModal || (() => onTabChange('creator'))}
            className={`w-8 h-8 rounded-xl hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors ${
              activeTab === 'creator' ? 'text-sky-600 bg-sky-50' : ''
            }`}
            title="AI Model & Engine Settings"
          >
            <Bot size={15} />
          </button>

          {/* Notifications / Published stream */}
          <button
            type="button"
            onClick={() => onTabChange('logs')}
            className={`w-8 h-8 rounded-xl hover:bg-slate-100 hover:text-slate-900 flex items-center justify-center transition-colors relative ${
              activeTab === 'logs' ? 'text-sky-600 bg-sky-50' : ''
            }`}
            title="Execution Logs & Notifications"
          >
            <Bell size={15} />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-rose-500" />
          </button>
        </div>

        {/* User profile & Logout */}
        <div className="flex items-center gap-1.5 pl-1 sm:pl-2 border-l border-slate-200">
          <div
            className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-400 to-blue-600 border border-slate-200 text-white font-bold text-xs flex items-center justify-center overflow-hidden shrink-0 shadow-2xs"
            title={`${user.name || user.email || 'Creator'} (${user.role})`}
          >
            {user.avatar ? (
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            ) : (
              initials
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className="w-7 h-7 rounded-xl hover:bg-rose-50 hover:text-rose-600 text-slate-400 flex items-center justify-center transition-colors"
            title="Sign out"
          >
            <LogOut size={13} />
          </button>
        </div>
      </div>
    </header>
  );
}
