'use client';

import React from 'react';
import { SocialConnection, Platform } from '@/types';
import { Twitter, Linkedin, Instagram, Link2 } from 'lucide-react';

export type PlatformStatus = { platform: string; configured: boolean; requiredEnv: string };

interface Props {
  connections: SocialConnection[];
  onToggleConnect: (platform: Platform) => void;
  platformStatus?: PlatformStatus[];
}

const PLATFORM_META: Record<Platform, { label: string; color: string; bg: string }> = {
  TWITTER:   { label: 'X (Twitter)',  color: '#0f172a', bg: '#e0f2fe' },
  LINKEDIN:  { label: 'LinkedIn',     color: '#0a66c2', bg: '#dbeafe' },
  INSTAGRAM: { label: 'Instagram',    color: '#e1306c', bg: '#fce7f3' },
};

function PlatformIcon({ platform, size = 16 }: { platform: Platform; size?: number }) {
  if (platform === 'TWITTER')   return <Twitter   size={size} style={{ color: '#0f172a' }} />;
  if (platform === 'LINKEDIN')  return <Linkedin  size={size} style={{ color: '#0a66c2' }} />;
  return                               <Instagram size={size} style={{ color: '#e1306c' }} />;
}

export default function SocialAccountsCard({ connections, onToggleConnect, platformStatus = [] }: Props) {
  const statusFor = (platform: Platform) => platformStatus.find((p) => p.platform === platform);
  const configuredCount = platformStatus.filter((p) => p.configured).length;

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Link2 size={15} className="text-sky-600" />
          Connected Social Channels
        </div>
        <div className="card-desc">
          {platformStatus.length === 0
            ? 'Checking platform credentials…'
            : `${configuredCount} of ${platformStatus.length} platforms have live API credentials.`}
        </div>
      </div>

      <div className="card-body flex flex-col gap-2.5">
        {connections.map((c) => {
          const st = statusFor(c.platform);
          const configured = st ? st.configured : true;
          const meta = PLATFORM_META[c.platform];

          return (
            <div key={c.platform} className="connection-row">
              <div className="flex items-center gap-3 min-w-0">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border border-slate-200/80"
                  style={{ background: meta.bg }}
                >
                  <PlatformIcon platform={c.platform} size={16} />
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-xs text-slate-900">{meta.label}</span>
                    {c.connected ? (
                      <>
                        <span className="badge badge-connected">Connected</span>
                        <span className="badge badge-sandbox">
                          {c.isSandbox ? 'Sandbox' : 'Live'}
                        </span>
                      </>
                    ) : (
                      <span className="badge badge-disconnected">Not connected</span>
                    )}
                    {!configured && (
                      <span className="badge bg-amber-50 text-amber-700 border-amber-200">
                        Needs env key
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate font-mono mt-0.5">
                    {!configured && !c.connected
                      ? `Set ${st?.requiredEnv} in .env`
                      : c.handle}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onToggleConnect(c.platform)}
                className={`btn btn-sm shrink-0 font-medium ${
                  c.connected
                    ? 'btn-secondary text-slate-700 hover:text-rose-600 hover:border-rose-300'
                    : 'btn-primary'
                }`}
                title={
                  !configured && !c.connected
                    ? `Warning: ${st?.requiredEnv} not set. Click to configure.`
                    : c.connected
                    ? `Disconnect ${c.platform}`
                    : `Connect ${c.platform}`
                }
              >
                {c.connected ? 'Disconnect' : 'Connect'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
