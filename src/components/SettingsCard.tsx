'use client';

import React, { useEffect, useState } from 'react';

type PlatformStatus = { platform: string; configured: boolean; requiredEnv: string };

const COST: Record<string, string> = {
  low: '~$0.01 per image',
  medium: '~$0.04 per image',
  high: '~$0.17 per image',
};

/**
 * Generation settings. Image quality is the owner's spend knob, so it is visible and changeable
 * here rather than buried in .env - it is persisted per user and used by the next generation.
 * The publishing indicator is read-only and reports whether the scheduler may post for real.
 */
export default function SettingsCard() {
  const [quality, setQuality] = useState<string>('low');
  const [options, setOptions] = useState<string[]>(['low', 'medium', 'high']);
  const [publishing, setPublishing] = useState<{ armed: boolean; note: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setQuality(d.settings?.imageQuality || 'low');
        if (Array.isArray(d.options?.imageQuality)) setOptions(d.options.imageQuality);
        if (d.publishing) setPublishing(d.publishing);
      })
      .catch(console.error);
  }, []);

  const save = async (q: string) => {
    if (q === quality) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageQuality: q }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'could not save');
      setQuality(d.settings.imageQuality);
      setMsg(`Saved - new content will use "${d.settings.imageQuality}" quality.`);
    } catch (e: any) {
      setMsg(`Not saved: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-[#11141c] border border-zinc-800 rounded-lg p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-bold text-white font-mono">Settings</h2>
        {saving && <span className="text-[10px] font-mono text-zinc-500">saving…</span>}
      </div>

      <div className="mb-2 text-xs font-mono text-zinc-400">Image generation quality</div>
      <div className="flex gap-2 mb-2">
        {options.map((q) => (
          <button
            key={q}
            onClick={() => save(q)}
            className={`flex-1 py-2 rounded border text-xs font-mono capitalize transition-colors ${
              quality === q
                ? 'border-cyan-500 bg-cyan-950/40 text-cyan-300'
                : 'border-zinc-800 bg-[#0b0e14] text-zinc-400 hover:border-zinc-600'
            }`}
          >
            {q}
          </button>
        ))}
      </div>
      <div className="text-[10px] font-mono text-zinc-500 mb-4">
        current: <span className="text-zinc-300">{quality}</span> · {COST[quality] || ''}
      </div>

      <div className="border-t border-zinc-800 pt-3">
        <div className="text-xs font-mono text-zinc-400 mb-1">Live publishing</div>
        <div className={`text-[11px] font-mono ${publishing?.armed ? 'text-emerald-400' : 'text-amber-400'}`}>
          {publishing ? (publishing.armed ? 'ARMED' : 'OFF') : 'unknown'}
        </div>
        {publishing?.note && <div className="text-[10px] font-mono text-zinc-500 mt-1 leading-relaxed">{publishing.note}</div>}
      </div>

      {msg && <div className="mt-3 text-[10px] font-mono text-zinc-400">{msg}</div>}
    </div>
  );
}
