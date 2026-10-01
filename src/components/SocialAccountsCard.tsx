'use client';

import React from 'react';
import { SocialConnection, Platform } from '@/types';
import { Twitter, Linkedin, Instagram, Link as LinkIcon } from 'lucide-react';

export type PlatformStatus = { platform: string; configured: boolean; requiredEnv: string };

interface Props {
  connections: SocialConnection[];
  onToggleConnect: (platform: Platform) => void;
  platformStatus?: PlatformStatus[];
}

export default function SocialAccountsCard({ connections, onToggleConnect, platformStatus = [] }: Props) {
  const getIcon = (platform: Platform) => {
    switch (platform) {
      case 'TWITTER':
        return <Twitter size={16} className="text-sky-400" />;
      case 'LINKEDIN':
        return <Linkedin size={16} className="text-blue-500" />;
      case 'INSTAGRAM':
        return <Instagram size={16} className="text-pink-500" />;
    }
  };

  const statusFor = (platform: Platform) => platformStatus.find((p) => p.platform === platform);

  const configuredCount = platformStatus.filter((p) => p.configured).length;

  return (
    <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl transition-all hover:border-zinc-700">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
          <LinkIcon size={16} className="text-cyan-400" />
          Connected Social Channels
        </h2>
        <p className="text-xs text-zinc-400">
          {platformStatus.length === 0
            ? 'Checking which platforms this instance is configured for…'
            : `${configuredCount} of ${platformStatus.length} platforms have app credentials. A channel can only be connected once its credentials exist.`}
        </p>
      </div>

      <div className="flex flex-col gap-2.5">
        {connections.map((c) => {
          const st = statusFor(c.platform);
          const configured = st ? st.configured : true;
          return (
            <div
              key={c.platform}
              className="flex items-center justify-between p-3 bg-[#07090e] border border-zinc-800/80 rounded-md hover:border-zinc-700/80 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                  {getIcon(c.platform)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-zinc-100">{c.platform}</span>

                    <span
                      className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono font-medium ${
                        c.connected
                          ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-800/40'
                          : 'bg-zinc-900 text-zinc-500 border border-zinc-800'
                      }`}
                    >
                      {c.connected ? 'CONNECTED' : 'DISCONNECTED'}
                    </span>

                    {/* Report the connection's real mode. This used to print a hardcoded
                        "SANDBOX" badge on every row, even for a live connection. */}
                    {c.connected && (
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono border ${
                          c.isSandbox
                            ? 'text-amber-400 bg-amber-950/30 border-amber-900/40'
                            : 'text-emerald-400 bg-emerald-950/30 border-emerald-900/40'
                        }`}
                      >
                        {c.isSandbox ? 'SANDBOX' : 'LIVE'}
                      </span>
                    )}

                    {!configured && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-700">
                        NOT CONFIGURED
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-zinc-400 font-mono mt-0.5">
                    {!configured
                      ? `set ${st?.requiredEnv} in .env to enable`
                      : c.handle}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onToggleConnect(c.platform)}
                disabled={!configured}
                title={!configured ? `Not available: ${st?.requiredEnv} is not set` : undefined}
                className={`px-3 py-1.5 rounded text-xs font-mono font-medium transition-all ${
                  !configured
                    ? 'bg-zinc-900 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                    : c.connected
                    ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-black font-semibold'
                }`}
              >
                {!configured ? 'Unavailable' : c.connected ? 'Disconnect' : 'Connect Account'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
