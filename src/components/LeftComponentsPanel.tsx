'use client';

import React, { useState } from 'react';
import { SocialConnection, Platform } from '@/types';
import {
  Maximize2,
  LayoutGrid,
  Bot,
  Filter,
  FileText,
  Target,
  Wand2,
  HelpCircle,
  LogOut,
  Search,
  FolderGit2,
  Table,
  Database,
  Globe,
  Code2,
  GitBranch,
  HardDrive,
  Workflow,
  Send,
  MessageSquare,
  Twitter,
  Linkedin,
  Instagram,
  BarChart3,
  Activity,
  Layers,
  Server,
  X,
} from 'lucide-react';

interface Props {
  activeView: 'canvas' | 'board' | 'calendar' | 'config';
  onSelectView: (view: 'canvas' | 'board' | 'calendar' | 'config') => void;
  connections: SocialConnection[];
  onToggleConnect: (platform: Platform) => void;
  onOpenConfigModal: (modal: 'niche' | 'llm' | 'settings' | 'channels') => void;
  onLogout: () => void;
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export default function LeftComponentsPanel({
  activeView,
  onSelectView,
  connections,
  onToggleConnect,
  onOpenConfigModal,
  onLogout,
  isMobileOpen = false,
  onCloseMobile,
}: Props) {
  const [activeTab, setActiveTab] = useState<'channels' | 'automation' | 'cloud'>('channels');
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Social Channels & Workspaces (ManyChat Style Channel Blocks)
  const channelTools = [
    { id: 'flow-canvas', label: 'Flow Canvas', icon: GitBranch, active: activeView === 'canvas', action: () => { onSelectView('canvas'); onCloseMobile?.(); } },
    { id: 'day-board', label: 'Calendar Studio', icon: FileText, active: activeView === 'board', action: () => { onSelectView('board'); onCloseMobile?.(); } },
    { id: 'month-grid', label: 'Month Matrix', icon: Table, active: activeView === 'calendar', action: () => { onSelectView('calendar'); onCloseMobile?.(); } },
    { id: 'x-twitter', label: 'X (Twitter)', icon: Twitter, active: false, action: () => { onSelectView('canvas'); onCloseMobile?.(); } },
    { id: 'linkedin', label: 'LinkedIn', icon: Linkedin, active: false, action: () => { onSelectView('canvas'); onCloseMobile?.(); } },
    { id: 'instagram', label: 'Instagram', icon: Instagram, active: false, action: () => { onSelectView('canvas'); onCloseMobile?.(); } },
    { id: 'campaign-trigger', label: 'Trigger Node', icon: Target, active: false, action: () => { onOpenConfigModal('niche'); onCloseMobile?.(); } },
    { id: 'channels-config', label: 'Connections', icon: Globe, active: activeView === 'config', action: () => { onSelectView('config'); onCloseMobile?.(); } },
  ];

  // 2. AI Intelligence & Logic Steps
  const automationTools = [
    { id: 'ai-engine', label: 'AI Synthesizer', icon: Bot, active: false, action: () => { onOpenConfigModal('llm'); onCloseMobile?.(); } },
    { id: 'niche-persona', label: 'Audience Filter', icon: Filter, active: false, action: () => { onOpenConfigModal('niche'); onCloseMobile?.(); } },
    { id: 'batch-gen', label: 'Batch Synthesize', icon: Wand2, active: false, action: () => { onOpenConfigModal('niche'); onCloseMobile?.(); } },
    { id: 'ab-variants', label: 'A/B Test Split', icon: Layers, active: false, action: () => { onSelectView('canvas'); onCloseMobile?.(); } },
    { id: 'quality-gate', label: 'Approval Gate', icon: Target, active: false, action: () => { onSelectView('board'); onCloseMobile?.(); } },
    { id: 'prompt-engine', label: 'Visual Studio', icon: Code2, active: false, action: () => { onOpenConfigModal('settings'); onCloseMobile?.(); } },
  ];

  // 3. Cloud Storage & Dispatch Delivery
  const cloudTools = [
    { id: 'aws-s3', label: 'AWS S3 Bucket', icon: Database, active: false, action: () => { onOpenConfigModal('settings'); onCloseMobile?.(); } },
    { id: 'bullmq', label: 'BullMQ Queue', icon: Activity, active: false, action: () => { onSelectView('canvas'); onCloseMobile?.(); } },
    { id: 'webhooks', label: 'API Webhooks', icon: Server, active: false, action: () => { onOpenConfigModal('channels'); onCloseMobile?.(); } },
    { id: 'analytics', label: 'Analytics Hub', icon: BarChart3, active: false, action: () => { onSelectView('board'); onCloseMobile?.(); } },
  ];

  const currentTools =
    activeTab === 'channels' ? channelTools : activeTab === 'automation' ? automationTools : cloudTools;

  const filteredTools = currentTools.filter((t) =>
    t.label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const panelContent = (
    <div className="flex h-full shrink-0 select-none border-r border-slate-200 bg-white z-20">
      {/* ── Far-Left Vertical Icon Rail (Width ~52px) ───────── */}
      <div className="w-[52px] bg-white border-r border-slate-200 flex flex-col justify-between items-center py-3.5">
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
            title="Toggle fullscreen"
          >
            <Maximize2 size={16} />
          </button>

          <button
            type="button"
            onClick={() => { onSelectView('canvas'); onCloseMobile?.(); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              activeView === 'canvas'
                ? 'bg-slate-100 text-slate-900 shadow-sm font-bold'
                : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Flow chart canvas"
          >
            <LayoutGrid size={18} />
          </button>

          <button
            type="button"
            onClick={() => { onOpenConfigModal('llm'); onCloseMobile?.(); }}
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
            title="AI Engine"
          >
            <Bot size={18} />
          </button>

          <button
            type="button"
            onClick={() => { onOpenConfigModal('niche'); onCloseMobile?.(); }}
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
            title="Targeting & Niche"
          >
            <Filter size={18} />
          </button>

          <button
            type="button"
            onClick={() => { onSelectView('board'); onCloseMobile?.(); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              activeView === 'board'
                ? 'bg-slate-100 text-slate-900 shadow-sm'
                : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Calendar Studio (Day Board)"
          >
            <FileText size={18} />
          </button>

          <button
            type="button"
            onClick={() => { onSelectView('calendar'); onCloseMobile?.(); }}
            className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
              activeView === 'calendar'
                ? 'bg-slate-100 text-slate-900 shadow-sm'
                : 'hover:bg-slate-100 text-slate-500'
            }`}
            title="Calendar Month View"
          >
            <Table size={18} />
          </button>

          <button
            type="button"
            onClick={() => { onOpenConfigModal('settings'); onCloseMobile?.(); }}
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
            title="Settings & Quality"
          >
            <Target size={18} />
          </button>

          <button
            type="button"
            onClick={() => { onOpenConfigModal('niche'); onCloseMobile?.(); }}
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 transition-colors"
            title="Batch Generator"
          >
            <Wand2 size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => { onOpenConfigModal('settings'); onCloseMobile?.(); }}
            className="w-9 h-9 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors"
            title="Help & docs"
          >
            <HelpCircle size={16} />
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="w-9 h-9 rounded-lg hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-slate-400 transition-colors"
            title="Sign out"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>

      {/* ── Components Drawer (Width ~215px) ────────────────── */}
      <div className="w-[215px] bg-white flex flex-col justify-between p-3.5 h-full">
        <div className="flex flex-col gap-3">
          {/* Mobile close button header */}
          {onCloseMobile && (
            <div className="lg:hidden flex items-center justify-between pb-1 border-b border-slate-100">
              <span className="text-xs font-bold text-slate-700">Tools & Palette</span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Search box (Find components) */}
          <div className="relative">
            <input
              type="text"
              placeholder="Find components"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:bg-white transition-all"
            />
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>

          {/* Sub-tabs: Channels | Automation | Cloud */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-1 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab('channels')}
              className={`pb-1 border-b-2 transition-all ${
                activeTab === 'channels'
                  ? 'border-sky-600 text-sky-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Channels
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('automation')}
              className={`pb-1 border-b-2 transition-all ${
                activeTab === 'automation'
                  ? 'border-sky-600 text-sky-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Automation
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('cloud')}
              className={`pb-1 border-b-2 transition-all ${
                activeTab === 'cloud'
                  ? 'border-sky-600 text-sky-900 font-bold'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Cloud
            </button>
          </div>

          {/* 2-column tools grid */}
          <div className="grid grid-cols-2 gap-1.5">
            {filteredTools.map((t) => {
              const Icon = t.icon;
              const isSelected = t.active;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={t.action}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-lg border text-center transition-all cursor-pointer gap-1.5 ${
                    isSelected
                      ? 'bg-slate-100 border-slate-300 text-slate-900 shadow-sm font-semibold'
                      : 'border-transparent hover:bg-slate-50 hover:border-slate-200 text-slate-600'
                  }`}
                >
                  <Icon size={18} className={isSelected ? 'text-sky-600' : 'text-slate-500'} />
                  <span className="text-[11px] font-medium leading-tight">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Connected Social Accounts ─────────────────────── */}
        <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
          <div className="text-[11px] font-bold text-slate-800 flex items-center justify-between">
            <span>Social Accounts</span>
            <button
              type="button"
              onClick={() => { onOpenConfigModal('channels'); onCloseMobile?.(); }}
              className="text-[10px] text-sky-600 hover:underline font-normal"
            >
              Manage
            </button>
          </div>

          {/* Social Platforms Status Pills */}
          <div className="flex flex-col gap-1.5">
            {connections.map((c) => {
              const isTw = c.platform === 'TWITTER';
              const isLi = c.platform === 'LINKEDIN';
              const Icon = isTw ? Twitter : isLi ? Linkedin : Instagram;
              const iconBg = isTw ? 'bg-sky-500' : isLi ? 'bg-blue-600' : 'bg-pink-600';

              return (
                <div
                  key={c.platform}
                  onClick={() => { onOpenConfigModal('channels'); onCloseMobile?.(); }}
                  className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-50 cursor-pointer transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-6 h-6 rounded-md ${iconBg} text-white flex items-center justify-center shrink-0`}>
                      <Icon size={12} />
                    </div>
                    <span className="text-xs font-medium text-slate-700 truncate capitalize">
                      {c.platform.toLowerCase()}
                    </span>
                  </div>
                  <span
                    className={`text-[9px] font-mono px-1.5 py-0.5 rounded-full font-bold ${
                      c.connected
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {c.connected ? (c.isSandbox ? 'Sandbox' : 'Live') : 'Offline'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop permanent sidebar */}
      <div className="hidden lg:flex h-full shrink-0">
        {panelContent}
      </div>

      {/* Mobile slide-over drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in"
            onClick={onCloseMobile}
          />
          {/* Drawer content */}
          <div className="relative z-10 flex h-full shadow-2xl animate-in slide-in-from-left duration-200">
            {panelContent}
          </div>
        </div>
      )}
    </>
  );
}
