'use client';

import React, { useState, useEffect } from 'react';
import { Shield, Key, Users, RefreshCw } from 'lucide-react';
import { PublishedAuditRecord } from '@/types';

export default function AdminDashboard() {
  const [logs, setLogs] = useState<PublishedAuditRecord[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/audit-logs');
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      {/* System Status Banner */}
      <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl border-l-4 border-l-purple-500 flex justify-between items-center">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
            <Shield size={18} className="text-purple-400" />
            Super Admin Control Plane
          </h2>
          <p className="text-xs text-zinc-400">
            Global oversight across all registered content creators, system default LLM routing, and multi-platform publishing queues.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-mono text-xs transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Metric 1 */}
        <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
          <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
            Registered Creators
          </div>
          <div className="text-2xl font-bold font-mono text-zinc-100 mb-1">
            14 Active
          </div>
          <div className="text-[11px] text-emerald-400 font-mono">
            +3 onboarded today
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
          <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
            Primary LLM Provider
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400 mb-1">
            Gemini 1.5 Flash
          </div>
          <div className="text-[11px] text-zinc-400 font-mono">
            Backups: OpenAI & DeepSeek
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
          <div className="text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-2">
            Total Published Posts
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400 mb-1">
            {logs.length} Executed
          </div>
          <div className="text-[11px] text-emerald-400 font-mono">
            100% Delivery Success Rate
          </div>
        </div>
      </div>

      {/* Global LLM Configuration */}
      <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
        <h3 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
          <Key size={16} className="text-cyan-400" />
          System-Wide LLM Credentials & Quotas
        </h3>
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

      {/* Creator Customer Registry */}
      <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
        <h3 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
          <Users size={16} className="text-emerald-400" />
          Creator Accounts Management
        </h3>
        <p className="text-xs text-zinc-400 mb-4">
          Audited view of registered businesses and creators using the platform.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-400">
                <th className="py-2.5 px-3">CREATOR</th>
                <th className="py-2.5 px-3">EMAIL</th>
                <th className="py-2.5 px-3">CONNECTED ACCOUNTS</th>
                <th className="py-2.5 px-3">LLM MODE</th>
                <th className="py-2.5 px-3">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              <tr>
                <td className="py-3 px-3 text-zinc-200 font-semibold">Jane Creator (Demo)</td>
                <td className="py-3 px-3 text-zinc-400">jane@techstart.io</td>
                <td className="py-3 px-3">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-950/40 text-sky-400 border border-sky-800/40 mr-1">
                    X
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-950/40 text-blue-400 border border-blue-800/40 mr-1">
                    LINKEDIN
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-pink-950/40 text-pink-400 border border-pink-800/40">
                    INSTAGRAM
                  </span>
                </td>
                <td className="py-3 px-3 text-cyan-400">SYSTEM_DEFAULT</td>
                <td className="py-3 px-3">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                    ACTIVE
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 text-zinc-200 font-semibold">Alex Growth Ops</td>
                <td className="py-3 px-3 text-zinc-400">alex@saaslab.com</td>
                <td className="py-3 px-3">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-blue-950/40 text-blue-400 border border-blue-800/40 mr-1">
                    LINKEDIN
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-pink-950/40 text-pink-400 border border-pink-800/40">
                    INSTAGRAM
                  </span>
                </td>
                <td className="py-3 px-3 text-purple-400">BYOK (OpenAI)</td>
                <td className="py-3 px-3">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                    ACTIVE
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 text-zinc-200 font-semibold">Marcus Media Agency</td>
                <td className="py-3 px-3 text-zinc-400">agency@marcus.dev</td>
                <td className="py-3 px-3">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-sky-950/40 text-sky-400 border border-sky-800/40 mr-1">
                    X
                  </span>
                </td>
                <td className="py-3 px-3 text-cyan-400">SYSTEM_DEFAULT</td>
                <td className="py-3 px-3">
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-800/40">
                    ACTIVE
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
