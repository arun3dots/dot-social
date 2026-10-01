'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { UserSession, SubscriptionInfo } from '@/types';
import { Terminal, Calendar, Radio, Cpu, Zap, LogOut } from 'lucide-react';

interface HeaderProps {
  user: UserSession;
  activeTab: 'creator' | 'logs';
  onTabChange: (tab: 'creator' | 'logs') => void;
  subscription: SubscriptionInfo;
  onOpenSubscriptionModal: () => void;
}

import { signOut } from 'next-auth/react';

export default function Header({
  user,
  activeTab,
  onTabChange,
  subscription,
  onOpenSubscriptionModal,
}: HeaderProps) {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout?to=creator', { method: 'POST' });
      await signOut({ callbackUrl: '/login', redirect: true });
    } catch (e) {
      router.push('/login');
    }
  };

  return (
    <header className="flex items-center justify-between px-6 py-3 bg-[#0b0e14]/95 border-b border-zinc-800/80 sticky top-0 z-50 backdrop-blur-md">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2.5 font-mono text-sm font-semibold tracking-tight">
          <Terminal size={18} className="text-cyan-400" />
          <span className="text-white font-bold">social_engine</span>
          <span className="text-zinc-600">//</span>
          <span className="text-zinc-400 font-normal">creator_studio</span>
        </div>

        <nav className="flex items-center gap-1.5">
          <button
            onClick={() => onTabChange('creator')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-xs transition-all ${
              activeTab === 'creator'
                ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Calendar size={14} />
            calendar_studio
          </button>
          <button
            onClick={() => onTabChange('logs')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-mono text-xs transition-all ${
              activeTab === 'logs'
                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <Radio size={14} />
            published_history
          </button>
        </nav>
      </div>

      <div className="flex items-center gap-3">
        {/* Subscription Plan Badge */}
        <button
          onClick={onOpenSubscriptionModal}
          className="flex items-center gap-2 px-2.5 py-1 rounded-md border border-cyan-500/40 bg-cyan-950/20 hover:bg-cyan-950/40 transition-all font-mono text-xs"
          title="Manage Subscription & Quotas"
        >
          <Zap size={13} className="text-cyan-400" />
          <span className="text-cyan-300 font-semibold">{subscription.tier}</span>
          <span className="text-zinc-500 pl-1 border-l border-zinc-700 text-[10px]">
            Upgrade
          </span>
        </button>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-emerald-950/30 text-emerald-400 border border-emerald-800/40">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            SANDBOX_ACTIVE
          </span>
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-mono bg-cyan-950/30 text-cyan-400 border border-cyan-800/40">
            <Cpu size={12} />
            GEMINI_READY
          </span>
        </div>

        <div className="flex items-center gap-3 pl-3 border-l border-zinc-800">
          <div className="text-right">
            <div className="text-xs font-semibold text-zinc-100 font-mono">
              {user.name}
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              {user.email}
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors text-xs font-mono"
            title="Log out of Creator Studio"
          >
            <LogOut size={13} />
            <span>Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
