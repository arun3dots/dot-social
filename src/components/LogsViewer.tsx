'use client';

import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, ExternalLink, Twitter, Linkedin, Instagram } from 'lucide-react';
import { PublishedAuditRecord, Platform } from '@/types';

export default function LogsViewer() {
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

  const getPlatformIcon = (platform: Platform) => {
    switch (platform) {
      case 'TWITTER':
        return <Twitter size={14} className="text-sky-400" />;
      case 'LINKEDIN':
        return <Linkedin size={14} className="text-blue-500" />;
      case 'INSTAGRAM':
        return <Instagram size={14} className="text-pink-500" />;
    }
  };

  return (
    <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
            <Radio size={16} className="text-cyan-400" />
            Automated Publishing Dispatch Stream
          </h2>
          <p className="text-xs text-zinc-400">
            Audit log of all scheduled and immediate post executions across Instagram, LinkedIn, and X.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 font-mono text-xs transition-colors"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>Refresh Stream</span>
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="py-12 text-center text-zinc-500 font-mono text-xs">
          No dispatches recorded yet. Generate a batch and click "Approve & Schedule" or "Dispatch Now".
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {logs.map((log, idx) => (
            <div
              key={idx}
              className="bg-[#07090e] border border-zinc-800/80 rounded-md p-3 flex justify-between items-center font-mono text-xs hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="flex items-center gap-1.5 shrink-0">
                  {getPlatformIcon(log.platform)}
                  <span className="font-semibold text-zinc-200">{log.platform}</span>
                </div>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-emerald-950/40 text-emerald-400 border border-emerald-800/40 shrink-0">
                  {log.status}
                </span>
                {log.isSandbox && (
                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-zinc-900 text-zinc-400 border border-zinc-800 shrink-0">
                    SANDBOX
                  </span>
                )}
                <div className="text-zinc-400 truncate max-w-lg">
                  {log.content || log.caption}
                </div>
              </div>

              <div className="flex items-center gap-4 shrink-0 pl-3">
                <span className="text-zinc-500 text-[11px]">
                  {new Date(log.publishedAt).toLocaleTimeString()}
                </span>
                <a
                  href={log.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2.5 py-1 rounded bg-zinc-800 border border-zinc-700 text-cyan-400 hover:text-cyan-300 flex items-center gap-1.5 text-xs transition-colors"
                >
                  <ExternalLink size={12} />
                  <span>Live Link</span>
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
