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
    if (!niche.trim() || isGenerating) return;
    onGenerate({ niche, audience, tone });
  };

  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">
          <Compass size={15} className="text-emerald-600" />
          Content Strategy & Generation
        </div>
        <div className="card-desc">
          Define your target market and voice. Synthesizes an automated multi-platform batch.
        </div>
      </div>

      <div className="card-body">
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="label">Niche / Domain Focus</label>
            <input
              type="text"
              className="input"
              value={niche}
              onChange={(e) => setNiche(e.target.value)}
              placeholder="e.g. B2B SaaS, Health & Longevity, Personal Finance…"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="label">Target Audience</label>
              <input
                type="text"
                className="input"
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="e.g. Solopreneurs, Devs, Marketers…"
                required
              />
            </div>

            <div>
              <label className="label">Brand Tone of Voice</label>
              <input
                type="text"
                className="input"
                value={tone}
                onChange={(e) => setTone(e.target.value)}
                placeholder="e.g. Insightful, Visionary, Direct…"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isGenerating}
            className="btn btn-primary w-full py-2.5 text-xs font-semibold shadow-sm mt-1"
          >
            {isGenerating ? (
              <>
                <Loader2 size={14} className="animate-spin shrink-0" />
                <span>Synthesizing Multi-Platform Batch…</span>
              </>
            ) : (
              <>
                <Sparkles size={14} className="shrink-0" />
                <span>Generate Content Calendar (Twitter, LinkedIn, IG)</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
