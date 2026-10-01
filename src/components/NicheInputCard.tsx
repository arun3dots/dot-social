'use client';

import React, { useState } from 'react';
import { Compass, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  onGenerate: (params: { niche: string; audience: string; tone: string }) => Promise<void>;
  isGenerating: boolean;
}

export default function NicheInputCard({ onGenerate, isGenerating }: Props) {
  const [niche, setNiche] = useState('AI Productivity & Automation Tools');
  const [audience, setAudience] = useState('Tech Founders, Solopreneurs, and Creators');
  const [tone, setTone] = useState('Insightful, practical, engaging, actionable');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!niche.trim()) return;
    onGenerate({ niche, audience, tone });
  };

  return (
    <div className="bg-[#0e121a] border border-zinc-800 rounded-lg p-5 shadow-xl transition-all hover:border-zinc-700">
      <div className="mb-4">
        <h2 className="text-sm font-semibold tracking-tight text-zinc-100 flex items-center gap-2 mb-1">
          <Compass size={16} className="text-emerald-400" />
          Creator Niche & Content Requirements
        </h2>
        <p className="text-xs text-zinc-400">
          Define your target market and voice. Our engine will synthesize an automated 3-day multi-platform calendar.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
        <div>
          <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
            Niche / Domain Focus
          </label>
          <input
            type="text"
            className="w-full bg-[#07090e] border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
            value={niche}
            onChange={(e) => setNiche(e.target.value)}
            placeholder="e.g. B2B SaaS, Health & Longevity, Personal Finance..."
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
              Target Audience
            </label>
            <input
              type="text"
              className="w-full bg-[#07090e] border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              placeholder="e.g. Solopreneurs, Devs, Marketers..."
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-mono text-zinc-400 uppercase tracking-wider mb-1.5">
              Brand Tone of Voice
            </label>
            <input
              type="text"
              className="w-full bg-[#07090e] border border-zinc-800 rounded px-3 py-2 text-xs text-zinc-100 focus:outline-none focus:border-cyan-500 transition-colors"
              value={tone}
              onChange={(e) => setTone(e.target.value)}
              placeholder="e.g. Insightful, Visionary, Direct..."
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={isGenerating}
          className="w-full flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-black font-semibold font-mono text-xs py-2.5 px-4 rounded transition-all mt-1 shadow-lg shadow-cyan-950/30"
        >
          {isGenerating ? (
            <>
              <Loader2 size={15} className="animate-spin" />
              <span>Synthesizing 3-Day Multi-Platform Batch...</span>
            </>
          ) : (
            <>
              <Sparkles size={15} />
              <span>Generate 3-Day Content Calendar (Twitter, LinkedIn, IG)</span>
            </>
          )}
        </button>
      </form>
    </div>
  );
}
