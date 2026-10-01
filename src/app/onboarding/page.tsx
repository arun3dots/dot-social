'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 0 | 1 | 2 | 3 | 4 | 5;
const STEP_TITLES = [
  'What should we call you?',
  'How do you sound?',
  'Which niches do you target?',
  'Pick your content pillars',
  'What are you optimising for?',
  'How much content at a time?',
];

const CADENCE_OPTIONS = [
  { id: 'daily', label: 'Daily', detail: '1 day of content per batch' },
  { id: '3day', label: 'Every 3 days', detail: '3 days per batch' },
  { id: 'weekly', label: 'Weekly', detail: '7 days per batch (maximum)' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(0);
  const [screenName, setScreenName] = useState('');
  const [persona, setPersona] = useState('');
  const [niches, setNiches] = useState<string[]>([]);
  const [pillars, setPillars] = useState<string[]>([]);
  const [goals, setGoals] = useState<string[]>([]);
  const [cadence, setCadence] = useState('weekly');
  const [customNiche, setCustomNiche] = useState('');
  const [customPillar, setCustomPillar] = useState('');
  const [suggestedNiches, setSuggestedNiches] = useState<string[]>([]);
  const [suggestedPillars, setSuggestedPillars] = useState<string[]>([]);
  const [allGoals, setAllGoals] = useState<string[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/onboarding')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const p = d?.profile;
        if (p) {
          if (p.onboardingCompleted) { router.push('/'); return; }
          if (p.screenName) setScreenName(p.screenName);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [router]);

  const toggle = (list: string[], setList: (v: string[]) => void, value: string, max = 12) => {
    if (list.includes(value)) setList(list.filter((x) => x !== value));
    else if (list.length < max) setList([...list, value]);
  };

  const suggest = async () => {
    setSuggesting(true);
    try {
      const res = await fetch('/api/onboarding/suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenName, persona, niches }),
      });
      const d = await res.json();
      setSuggestedNiches(d.recommendedNiches || []);
      setSuggestedPillars(d.suggestedPillars || []);
      setAllGoals(d.allGoals || []);
      if (d.suggestedGoals && goals.length === 0) setGoals(d.suggestedGoals);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSuggesting(false);
    }
  };

  const canAdvance = () => {
    if (step === 0) return screenName.trim().length > 1;
    if (step === 2) return niches.length > 0;
    if (step === 3) return pillars.length > 0;
    if (step === 4) return goals.length > 0;
    return true;
  };

  const finish = async () => {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ screenName, persona, niches, pillars, goals, cadence }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Could not save your profile');
      router.push('/');
      router.refresh();
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  const chip = (active: boolean) =>
    `px-3 py-1.5 rounded border text-xs font-mono transition-colors cursor-pointer ${
      active
        ? 'bg-cyan-950/60 border-cyan-500 text-cyan-200'
        : 'bg-[#0b0e14] border-zinc-800 text-zinc-400 hover:border-zinc-600'
    }`;

  if (loading) {
    return <div className="min-h-screen bg-[#0a0c10] text-zinc-400 flex items-center justify-center font-mono text-sm">loading your profile…</div>;
  }

  return (
    <div className="min-h-screen bg-[#0a0c10] text-[#f1f5f9] p-6 flex flex-col">
      <div className="max-w-3xl w-full mx-auto">
        <div className="flex items-center justify-between py-4">
          <div className="font-mono text-sm font-semibold text-zinc-300">social_engine <span className="text-zinc-600">//</span> <span className="text-cyan-400">onboarding</span></div>
          <div className="font-mono text-xs text-zinc-500">step {step + 1} / 6</div>
        </div>

        <div className="flex gap-1 mb-8">
          {STEP_TITLES.map((_, i) => (
            <div key={i} className={`h-1 flex-1 rounded ${i <= step ? 'bg-cyan-500' : 'bg-zinc-800'}`} />
          ))}
        </div>

        <div className="bg-[#11141c] border border-zinc-800 rounded-lg p-8">
          <h1 className="text-lg font-bold text-white mb-1">{STEP_TITLES[step]}</h1>
          <p className="text-xs text-zinc-400 mb-6">
            {step === 0 && 'This is the name shown in your studio and used in generated content.'}
            {step === 1 && 'A short description of who you are and how you sound. We will write in this voice.'}
            {step === 2 && 'Pick as many as you want. We can suggest the best fit for you.'}
            {step === 3 && 'Recurring themes your content will rotate through. Add your own too.'}
            {step === 4 && 'What the content is for. Choose everything that applies.'}
            {step === 5 && 'Maximum one week per batch — you review it, then it schedules.'}
          </p>

          {error && <div className="mb-5 p-3 rounded bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs font-mono">{error}</div>}

          {step === 0 && (
            <input value={screenName} onChange={(e) => setScreenName(e.target.value)} placeholder="e.g. Sobin, or @growthops"
              className="w-full bg-[#07080b] border border-zinc-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500" />
          )}

          {step === 1 && (
            <textarea value={persona} onChange={(e) => setPersona(e.target.value)} rows={4}
              placeholder="e.g. Director of Engineering sharing what actually works when automating delivery pipelines. Blunt, practical, no hype."
              className="w-full bg-[#07080b] border border-zinc-800 rounded px-3 py-2 text-sm font-mono focus:outline-none focus:border-cyan-500" />
          )}

          {step === 2 && (
            <div className="space-y-4">
              <button onClick={suggest} disabled={suggesting}
                className="text-xs font-mono px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-semibold">
                {suggesting ? 'thinking…' : 'Suggest the best fit for me'}
              </button>
              {suggestedNiches.length > 0 && (
                <div>
                  <div className="text-xs font-mono text-zinc-500 mb-2">SUGGESTED FOR YOU</div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedNiches.map((n) => <span key={n} className={chip(niches.includes(n))} onClick={() => toggle(niches, setNiches, n)}>{n}</span>)}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs font-mono text-zinc-500 mb-2">SELECTED ({niches.length})</div>
                <div className="flex flex-wrap gap-2">
                  {niches.length === 0 && <span className="text-xs text-zinc-600 font-mono">nothing selected yet</span>}
                  {niches.map((n) => <span key={n} className={chip(true)} onClick={() => toggle(niches, setNiches, n)}>{n} ✕</span>)}
                </div>
              </div>
              <div className="flex gap-2">
                <input value={customNiche} onChange={(e) => setCustomNiche(e.target.value)} placeholder="add your own niche"
                  className="flex-1 bg-[#07080b] border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500" />
                <button onClick={() => { const v = customNiche.trim(); if (v) { toggle(niches, setNiches, v); setCustomNiche(''); } }}
                  className="px-3 py-2 rounded border border-zinc-700 text-xs font-mono text-zinc-300">Add</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              {suggestedPillars.length === 0 && (
                <button onClick={suggest} disabled={suggesting} className="text-xs font-mono px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 text-black font-semibold">
                  {suggesting ? 'thinking…' : 'Suggest pillars for my niches'}
                </button>
              )}
              {suggestedPillars.length > 0 && (
                <div>
                  <div className="text-xs font-mono text-zinc-500 mb-2">SUGGESTED</div>
                  <div className="flex flex-wrap gap-2">
                    {suggestedPillars.map((p) => <span key={p} className={chip(pillars.includes(p))} onClick={() => toggle(pillars, setPillars, p)}>{p}</span>)}
                  </div>
                </div>
              )}
              <div>
                <div className="text-xs font-mono text-zinc-500 mb-2">SELECTED ({pillars.length})</div>
                <div className="flex flex-wrap gap-2">
                  {pillars.length === 0 && <span className="text-xs text-zinc-600 font-mono">nothing selected yet</span>}
                  {pillars.map((p) => <span key={p} className={chip(true)} onClick={() => toggle(pillars, setPillars, p)}>{p} ✕</span>)}
                </div>
              </div>
              <div className="flex gap-2">
                <input value={customPillar} onChange={(e) => setCustomPillar(e.target.value)} placeholder="add your own pillar"
                  className="flex-1 bg-[#07080b] border border-zinc-800 rounded px-3 py-2 text-xs font-mono focus:outline-none focus:border-cyan-500" />
                <button onClick={() => { const v = customPillar.trim(); if (v) { toggle(pillars, setPillars, v); setCustomPillar(''); } }}
                  className="px-3 py-2 rounded border border-zinc-700 text-xs font-mono text-zinc-300">Add</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              {(allGoals.length ? allGoals : [
                'Followers / audience growth','Engagement','Authority / thought leadership','Leads / demand generation',
                'Sales / conversions','Website traffic','Community building','Loyalty / retention',
                'Brand awareness / recall','Hiring / employer brand',
              ]).map((g) => <span key={g} className={`${chip(goals.includes(g))} mr-2 mb-2 inline-block`} onClick={() => toggle(goals, setGoals, g)}>{g}</span>)}
              <div className="text-xs font-mono text-zinc-500 pt-2">SELECTED ({goals.length})</div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-3">
              {CADENCE_OPTIONS.map((o) => (
                <div key={o.id} onClick={() => setCadence(o.id)}
                  className={`p-3 rounded border cursor-pointer ${cadence === o.id ? 'border-cyan-500 bg-cyan-950/30' : 'border-zinc-800 bg-[#0b0e14]'}`}>
                  <div className="text-sm font-semibold text-zinc-100">{o.label}</div>
                  <div className="text-xs text-zinc-400 font-mono">{o.detail}</div>
                </div>
              ))}
              <div className="mt-6 p-4 rounded border border-zinc-800 bg-[#0b0e14] text-xs font-mono text-zinc-400 space-y-1">
                <div>screen name: <span className="text-zinc-200">{screenName || '—'}</span></div>
                <div>niches: <span className="text-zinc-200">{niches.join(', ') || '—'}</span></div>
                <div>pillars: <span className="text-zinc-200">{pillars.join(', ') || '—'}</span></div>
                <div>goals: <span className="text-zinc-200">{goals.join(', ') || '—'}</span></div>
                <div>cadence: <span className="text-cyan-300">{cadence}</span></div>
              </div>
            </div>
          )}

          <div className="flex justify-between mt-8">
            <button onClick={() => setStep((s) => Math.max(0, s - 1) as Step)} disabled={step === 0}
              className="px-4 py-2 rounded border border-zinc-800 text-xs font-mono text-zinc-400 disabled:opacity-40">Back</button>
            {step < 5 ? (
              <button onClick={() => setStep((s) => Math.min(5, s + 1) as Step)} disabled={!canAdvance()}
                className="px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-black text-xs font-mono font-semibold disabled:opacity-40">Continue</button>
            ) : (
              <button onClick={finish} disabled={saving}
                className="px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-black text-xs font-mono font-semibold disabled:opacity-40">
                {saving ? 'saving…' : 'Finish setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
