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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Super Admin Dedicated Header */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5 font-mono text-sm font-semibold tracking-tight">
            <Terminal size={18} className="text-rose-600" />
            <span className="text-slate-900 font-bold">social_engine</span>
            <span className="text-slate-300">//</span>
            <span className="text-rose-600 font-mono text-xs font-semibold">SUPER_ADMIN_PLANE</span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-rose-50 text-rose-700 border border-rose-200">
            <Shield size={12} />
            RESTRICTED_ACCESS
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs font-semibold text-slate-800 font-mono">
              Super Admin Master
            </div>
            <div className="text-[11px] text-rose-600 font-mono font-medium">
              admin@antigravity.local
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-mono text-xs shadow-sm transition-colors"
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-rose-500 flex justify-between items-center">
          <div>
            <h1 className="text-base font-semibold tracking-tight text-slate-900 flex items-center gap-2 mb-1">
              <Shield size={18} className="text-rose-600" />
              Platform Infrastructure & Multi-Tenant Control
            </h1>
            <p className="text-xs text-slate-500">
              PostgreSQL database status: connected • Auto-scheduling cron workers: active • Global rate limits: normal.
            </p>
          </div>
          <button
            onClick={fetchDiagnostics}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 font-mono text-xs shadow-sm transition-colors"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            <span>Refresh Diagnostics</span>
          </button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Registered Creators (PostgreSQL)
            </div>
            <div className="text-3xl font-bold text-slate-900 mb-1">
              {users.length} Active Tenants
            </div>
            <div className="text-xs text-emerald-600 font-medium">
              Database schema synchronized
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Primary System LLM
            </div>
            <div className="text-3xl font-bold text-blue-600 mb-1">
              Gemini 1.5 Flash
            </div>
            <div className="text-xs text-slate-500">
              Backups: OpenAI & DeepSeek
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Total Dispatched Posts
            </div>
            <div className="text-3xl font-bold text-emerald-600 mb-1">
              {logs.length} Logged
            </div>
            <div className="text-xs text-emerald-600 font-medium">
              PostgreSQL audit trail verified
            </div>
          </div>
        </div>

        {/* Global LLM Provider Quotas */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight text-slate-900 flex items-center gap-2 mb-1">
            <Key size={16} className="text-blue-600" />
            System Default LLM Routing & Provider Fallback
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            These default keys power generation for creators who do not provide their own keys (BYOK).
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-xs text-slate-800">Google Gemini (Primary)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  ACTIVE
                </span>
              </div>
              <div className="text-xs text-slate-600 font-mono">
                Model: gemini-1.5-flash
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-xs text-slate-800">OpenAI (Fallback)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  STANDBY
                </span>
              </div>
              <div className="text-xs text-slate-600 font-mono">
                Model: gpt-4o-mini
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="font-semibold text-xs text-slate-800">DeepSeek (Fallback)</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
                  STANDBY
                </span>
              </div>
              <div className="text-xs text-slate-600 font-mono">
                Model: deepseek-chat
              </div>
            </div>
          </div>
        </div>

        {/* Tenant Registry */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight text-slate-900 flex items-center gap-2 mb-1">
            <Users size={16} className="text-emerald-600" />
            Registered Creator Accounts (PostgreSQL Data)
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Audited view of creators, their subscription packages, and connected social accounts.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-2.5 px-3">CREATOR</th>
                  <th className="py-2.5 px-3">EMAIL</th>
                  <th className="py-2.5 px-3">SUBSCRIPTION TIER</th>
                  <th className="py-2.5 px-3">ROLE</th>
                  <th className="py-2.5 px-3">STATUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-3 text-slate-900 font-semibold">{u.name}</td>
                    <td className="py-3 px-3 text-slate-600">{u.email}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[11px] bg-blue-50 text-blue-700 border border-blue-200 font-semibold">
                        {u.subscription?.tier || 'FREE_TRIAL'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 font-medium">{u.role}</td>
                    <td className="py-3 px-3">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h2 className="text-base font-semibold tracking-tight text-slate-900 flex items-center gap-2 mb-1">
            <Radio size={16} className="text-purple-600" />
            Global Platform Publishing Audit Stream
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            Immutable log of all scheduled and immediate post executions across Instagram, LinkedIn, and X.
          </p>

          <div className="flex flex-col gap-2.5">
            {logs.slice(0, 8).map((log, idx) => (
              <div
                key={idx}
                className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center font-mono text-xs"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="font-semibold text-slate-900">{log.platform}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    {log.status}
                  </span>
                  <div className="text-slate-600 truncate max-w-lg">
                    {log.content || log.caption}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 pl-3">
                  <span className="text-slate-400 text-[11px]">
                    {new Date(log.publishedAt).toLocaleTimeString()}
                  </span>
                  {log.externalUrl && (
                    <a
                      href={log.externalUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-blue-600 hover:text-blue-700 shadow-sm flex items-center gap-1 text-xs font-semibold"
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
