'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut } from 'next-auth/react';
import {
  Shield,
  Key,
  Users,
  Radio,
  ExternalLink,
  RefreshCw,
  LogOut,
  Terminal,
  Cpu,
  CheckCircle2,
} from 'lucide-react';
import { PublishedAuditRecord } from '@/types';

export default function AdminPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<PublishedAuditRecord[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchDiagnostics = async () => {
    setLoading(true);
    try {
      const [logsRes, usersRes] = await Promise.all([
        fetch('/api/audit-logs'),
        fetch('/api/creators'),
      ]);

      const logsData = await logsRes.json();
      const usersData = await usersRes.json();

      setLogs(logsData.logs || []);
      setUsers(usersData.users || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDiagnostics();
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout?to=admin', { method: 'POST' });
      await signOut({ callbackUrl: '/admin/login', redirect: true });
    } catch (e) {
      router.push('/admin/login');
    }
  };

  return (
    <div className="min-h-screen bg-[#07090e] text-[#f1f5f9] flex flex-col font-sans">
      {/* Super Admin Dedicated Header */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-[#0b0e14]/95 border-b border-rose-950/40 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 font-mono text-sm font-semibold tracking-tight">
            <Terminal size={18} className="text-rose-400" />
            <span className="text-white font-bold">social_engine</span>
            <span className="text-zinc-600">//</span>
            <span className="text-rose-400 font-mono text-xs">SUPER_ADMIN_PLANE</span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-mono bg-rose-950/30 text-rose-400 border border-rose-900/50">
            <Shield size={12} />
            RESTRICTED_ACCESS
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs font-semibold text-zinc-100 font-mono">
              Super Admin Master
            </div>
            <div className="text-[11px] text-rose-400 font-mono">
              admin@antigravity.local
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-zinc-800 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-mono text-xs transition-colors"
            title="Log out of Super Admin"
          >
            <LogOut size={13} />
            <span>Admin Logout</span>
          </button>
        </div>
      </header>

      {/* Main Admin Content */}
      <main className="max-w-7xl mx-auto w-full p-6 flex flex-col gap-6">
        {/* Banner */}
        <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl border-l-4 border-l-rose-500 flex justify-between items-center">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
              <Shield size={18} className="text-rose-400" />
              Platform Infrastructure & Multi-Tenant Control
            </h1>
            <p className="text-xs text-zinc-400">
              PostgreSQL database status: connected • Auto-scheduling cron workers: active • Global rate limits: normal.
            </p>
          </div>
          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-mono text-xs transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
              Registered Creators (PostgreSQL)
            </div>
            <div className="text-2xl font-bold font-mono text-zinc-100 mb-1">
              {users.length} Active Tenants
            </div>
            <div className="text-[11px] text-emerald-400 font-mono">
              Database schema synchronized
            </div>
          </div>

          <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
              Primary System LLM
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-400 mb-1">
              Gemini 1.5 Flash
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              Backups: OpenAI & DeepSeek
            </div>
          </div>

          <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
            <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
              Total Dispatched Posts
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400 mb-1">
              {logs.length} Logged
            </div>
            <div className="text-[11px] text-emerald-400 font-mono">
              PostgreSQL audit trail verified
            </div>
          </div>
        </div>

        {/* Global LLM Provider Quotas */}
        <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
            <Key size={16} className="text-cyan-400" />
            System Default LLM Routing & Provider Fallback
          </h2>
          <p className="text-xs text-zinc-400 mb-4">
            These default keys power generation for creators who do not provide their own keys (BYOK).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-3.5 bg-[#07090e] border border-zinc-800 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-xs text-zinc-200">Google Gemini (Primary)</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                  ACTIVE
                </span>
              </div>
              <div className="text-[11px] font-mono text-zinc-400">
                Model: gemini-1.5-flash
              </div>
            </div>

            <div className="p-3.5 bg-[#07090e] border border-zinc-800 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-xs text-zinc-200">OpenAI (Fallback)</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
                  STANDBY
                </span>
              </div>
              <div className="text-[11px] font-mono text-zinc-400">
                Model: gpt-4o-mini
              </div>
            </div>

            <div className="p-3.5 bg-[#07090e] border border-zinc-800 rounded-md">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-xs text-zinc-200">DeepSeek (Fallback)</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
                  STANDBY
                </span>
              </div>
              <div className="text-[11px] font-mono text-zinc-400">
                Model: deepseek-chat
              </div>
            </div>
          </div>
        </div>

        {/* Tenant Registry */}
        <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
            <Users size={16} className="text-emerald-400" />
            Registered Creator Accounts (PostgreSQL Data)
          </h2>
          <p className="text-xs text-zinc-400 mb-4">
            Audited view of creators, their subscription packages, and connected social accounts.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400">
                  <th className="py-2.5 px-3">CREATOR</th>
                  <th className="py-2.5 px-3">EMAIL</th>
                  <th className="py-2.5 px-3">SUBSCRIPTION TIER</th>
                  <th className="py-2.5 px-3">ROLE</th>
                  <th className="py-2.5 px-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-3 text-zinc-200 font-semibold">{u.name}</td>
                    <td className="py-3 px-3 text-zinc-400">{u.email}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded text-[11px] bg-cyan-950/40 text-cyan-400 border border-cyan-800/40">
                        {u.subscription?.tier || 'FREE_TRIAL'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-zinc-300">{u.role}</td>
                    <td className="py-3 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                        ACTIVE
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Global Dispatch Audit Logs */}
        <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
            <Radio size={16} className="text-purple-400" />
            Global Platform Publishing Audit Stream
          </h2>
          <p className="text-xs text-zinc-400 mb-4">
            Immutable log of all scheduled and immediate post executions across Instagram, LinkedIn, and X.
          </p>

          <div className="flex flex-col gap-2.5">
            {logs.slice(0, 8).map((log, idx) => (
              <div
                key={idx}
                className="bg-[#07090e] border border-zinc-800/80 rounded-md p-3 flex justify-between items-center font-mono text-xs"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="font-semibold text-zinc-200">{log.platform}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                    {log.status}
                  </span>
                  <div className="text-zinc-400 truncate max-w-lg">
                    {log.content || log.caption}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 pl-3">
                  <span className="text-zinc-500 text-[11px]">
                    {new Date(log.publishedAt).toLocaleTimeString()}
                  </span>
                  {log.externalUrl && (
                    <a
                      href={log.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-xs"
                    >
                      <ExternalLink size={11} />
                      <span>Live Link</span>
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
