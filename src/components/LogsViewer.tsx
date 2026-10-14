'use client';

import React, { useState, useEffect } from 'react';
import { Radio, RefreshCw, ExternalLink, Twitter, Linkedin, Instagram } from 'lucide-react';
import { PublishedAuditRecord, Platform } from '@/types';

function PlatformIcon({ platform }: { platform: Platform }) {
  if (platform === 'TWITTER')   return <Twitter   size={14} style={{ color: '#0f172a' }} />;
  if (platform === 'LINKEDIN')  return <Linkedin  size={14} style={{ color: '#0a66c2' }} />;
  return                               <Instagram size={14} style={{ color: '#e1306c' }} />;
}

const PLATFORM_BG: Record<string, string> = {
  TWITTER: '#e0f2fe', LINKEDIN: '#dbeafe', INSTAGRAM: '#fce7f3',
};

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

  useEffect(() => { fetchLogs(); }, []);

  return (
    <div className="card">
      <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="card-title">
            <Radio size={15} style={{ color: 'hsl(var(--accent))' }} />
            Dispatch Stream
          </div>
          <div className="card-desc">
            Audit log of all scheduled and manual post executions across Instagram, LinkedIn, and X.
          </div>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="btn btn-secondary btn-sm"
        >
          <RefreshCw size={12} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
          Refresh
        </button>
      </div>

      <div className="card-body">
        {logs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 32px' }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'hsl(var(--bg-surface-2))',
              border: '1px solid hsl(var(--border))',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', fontSize: 22,
            }}>
              📡
            </div>
            <p style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: 4 }}>
              No dispatches yet
            </p>
            <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
              Generate a batch, approve it, and click &ldquo;Dispatch Now&rdquo; or schedule posts to see the stream.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {logs.map((log, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 'var(--radius-sm)',
                  background: 'hsl(var(--bg-surface))',
                  transition: 'border-color 0.12s, box-shadow 0.12s',
                  gap: 12,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border-strong))';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'var(--shadow-sm)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'hsl(var(--border))';
                  (e.currentTarget as HTMLElement).style.boxShadow = 'none';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  {/* Platform chip */}
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '3px 8px', borderRadius: 6,
                    background: PLATFORM_BG[log.platform] ?? '#f1f5f9',
                    fontSize: 11, fontWeight: 600, flexShrink: 0,
                    color: 'hsl(var(--text-primary))',
                  }}>
                    <PlatformIcon platform={log.platform} />
                    {log.platform}
                  </span>

                  {/* Status */}
                  <span className="badge badge-published" style={{ flexShrink: 0 }}>
                    {log.status}
                  </span>

                  {/* Sandbox tag */}
                  {log.isSandbox && (
                    <span className="badge badge-sandbox" style={{ flexShrink: 0 }}>Sandbox</span>
                  )}

                  {/* Content preview */}
                  <span style={{
                    fontSize: 12, color: 'hsl(var(--text-secondary))',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {log.content || log.caption}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <span style={{ fontSize: 11, color: 'hsl(var(--text-tertiary))' }}>
                    {new Date(log.publishedAt).toLocaleTimeString()}
                  </span>
                  <a
                    href={log.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ textDecoration: 'none', color: 'hsl(var(--accent))' }}
                  >
                    <ExternalLink size={12} />
                    View
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
