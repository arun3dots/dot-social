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
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm border-l-4 border-l-purple-500 flex justify-between items-center">
        <div>
          <h2 className="text-base font-semibold tracking-tight text-slate-900 flex items-center gap-2 mb-1">
            <Shield size={18} className="text-purple-600" />
            Super Admin Control Plane
          </h2>
          <p className="text-xs text-slate-500">
            Global oversight across all registered content creators, system default LLM routing, and multi-platform publishing queues.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-medium shadow-sm transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Diagnostics</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Metric 1 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Registered Creators
          </div>
          <div className="text-3xl font-bold text-slate-900 mb-1">
            14 Active
          </div>
          <div className="text-xs text-emerald-600 font-medium">
            +3 onboarded today
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Primary LLM Provider
          </div>
          <div className="text-3xl font-bold text-blue-600 mb-1">
            Gemini 1.5 Flash
          </div>
          <div className="text-xs text-slate-500">
            Backups: OpenAI & DeepSeek
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Total Published Posts
          </div>
          <div className="text-3xl font-bold text-emerald-600 mb-1">
            {logs.length} Executed
          </div>
          <div className="text-xs text-emerald-600 font-medium">
            100% Delivery Success Rate
          </div>
        </div>
      </div>

      {/* Global LLM Configuration */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-semibold tracking-tight text-slate-900 flex items-center gap-2 mb-1">
          <Key size={16} className="text-blue-600" />
          System-Wide LLM Credentials & Quotas
        </h3>
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

      {/* Creator Customer Registry */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h3 className="text-base font-semibold tracking-tight text-slate-900 flex items-center gap-2 mb-1">
          <Users size={16} className="text-emerald-600" />
          Creator Accounts Management
        </h3>
        <p className="text-xs text-slate-500 mb-4">
          Audited view of registered businesses and creators using the platform.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-mono">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-2.5 px-3">CREATOR</th>
                <th className="py-2.5 px-3">EMAIL</th>
                <th className="py-2.5 px-3">CONNECTED ACCOUNTS</th>
                <th className="py-2.5 px-3">LLM MODE</th>
                <th className="py-2.5 px-3">STATUS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              <tr>
                <td className="py-3 px-3 text-slate-900 font-semibold">Jane Creator (Demo)</td>
                <td className="py-3 px-3 text-slate-600">jane@techstart.io</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-sky-50 text-sky-700 border border-sky-200 mr-1 font-semibold">
                    X
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-blue-50 text-blue-700 border border-blue-200 mr-1 font-semibold">
                    LINKEDIN
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-pink-50 text-pink-700 border border-pink-200 font-semibold">
                    INSTAGRAM
                  </span>
                </td>
                <td className="py-3 px-3 text-blue-600 font-medium">SYSTEM_DEFAULT</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ACTIVE
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 text-slate-900 font-semibold">Alex Growth Ops</td>
                <td className="py-3 px-3 text-slate-600">alex@saaslab.com</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-blue-50 text-blue-700 border border-blue-200 mr-1 font-semibold">
                    LINKEDIN
                  </span>
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-pink-50 text-pink-700 border border-pink-200 font-semibold">
                    INSTAGRAM
                  </span>
                </td>
                <td className="py-3 px-3 text-purple-600 font-medium">BYOK (OpenAI)</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    ACTIVE
                  </span>
                </td>
              </tr>
              <tr>
                <td className="py-3 px-3 text-slate-900 font-semibold">Marcus Media Agency</td>
                <td className="py-3 px-3 text-slate-600">agency@marcus.dev</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-md text-[10px] bg-sky-50 text-sky-700 border border-sky-200 mr-1 font-semibold">
                    X
                  </span>
                </td>
                <td className="py-3 px-3 text-blue-600 font-medium">SYSTEM_DEFAULT</td>
                <td className="py-3 px-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
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
