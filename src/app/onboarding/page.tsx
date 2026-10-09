'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, ArrowLeft, ArrowRight, Check } from 'lucide-react';

type Step = 0 | 1 | 2 | 3 | 4 | 5;

const STEP_TITLES = [
  'What should we call you?',
  'How do you sound?',
  'Which niches do you target?',
  'Pick your content pillars',
  'What are you optimising for?',
  'How much content at a time?',
];

const STEP_DESCS = [
  'This name appears in your studio and is used in generated content.',
  'A short description of who you are and how you communicate. We will write in this voice.',
  'Pick as many as you want. We can suggest the best fit for your profile.',
  'Recurring themes your content will rotate through. Add your own too.',
  'What the content is for — choose everything that applies.',
  'Maximum one week per batch — you review it before it schedules.',
];

const CADENCE_OPTIONS = [
  { id: 'daily',  label: 'Daily',          detail: '1 day of content per batch' },
  { id: '3day',   label: 'Every 3 days',   detail: '3 days per batch' },
  { id: 'weekly', label: 'Weekly',         detail: '7 days per batch (maximum)' },
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

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', background: 'hsl(var(--bg-page))',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'hsl(var(--text-secondary))', fontSize: 13,
      }}>
        Loading your profile…
      </div>
    );
  }

  /* ── Chip helper ──────────────────────────────────────────── */
  const Chip = ({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) => (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '6px 12px', borderRadius: 20,
        fontSize: 12, fontWeight: active ? 600 : 400,
        border: `1.5px solid ${active ? 'hsl(221 83% 53%)' : 'hsl(var(--border-strong))'}`,
        background: active ? 'hsl(221 83% 53% / .08)' : 'hsl(var(--bg-surface))',
        color: active ? 'hsl(221 83% 45%)' : 'hsl(var(--text-secondary))',
        cursor: 'pointer', transition: 'all 0.15s',
        fontFamily: 'inherit',
      }}
    >
      {active && <Check size={11} />}
      {label}
    </button>
  );

  return (
    <div style={{
      minHeight: '100vh',
      background: 'hsl(var(--bg-page))',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      padding: '0 24px 40px',
    }}>
      {/* Top bar */}
      <div style={{
        width: '100%', maxWidth: 680,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '20px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'hsl(var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles size={14} color="white" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>dot.social</span>
        </div>
        <span style={{ fontSize: 12, color: 'hsl(var(--text-tertiary))' }}>
          Step {step + 1} of 6
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '100%', maxWidth: 680,
        display: 'flex', gap: 4, marginBottom: 32,
      }}>
        {STEP_TITLES.map((_, i) => (
          <div key={i} style={{
            flex: 1, height: 4, borderRadius: 2,
            background: i <= step ? 'hsl(var(--accent))' : 'hsl(var(--border))',
            transition: 'background 0.3s',
          }} />
        ))}
      </div>

      {/* Main card */}
      <div style={{
        width: '100%', maxWidth: 680,
        background: 'hsl(var(--bg-surface))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--shadow-md)',
        padding: '32px',
      }}>
        <h1 style={{
          fontSize: 20, fontWeight: 800, color: 'hsl(var(--text-primary))',
          letterSpacing: '-0.03em', marginBottom: 6,
        }}>
          {STEP_TITLES[step]}
        </h1>
        <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))', marginBottom: 24 }}>
          {STEP_DESCS[step]}
        </p>

        {/* Error */}
        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: 16,
            borderRadius: 'var(--radius-sm)',
            background: 'hsl(0 72% 51% / .08)',
            border: '1px solid hsl(0 72% 51% / .25)',
            color: 'hsl(0 72% 45%)', fontSize: 12,
          }}>
            {error}
          </div>
        )}

        {/* ── Step 0: Screen name ──────────────────────────── */}
        {step === 0 && (
          <input
            className="input"
            value={screenName}
            onChange={(e) => setScreenName(e.target.value)}
            placeholder="e.g. Sobin, or @growthops"
            autoFocus
          />
        )}

        {/* ── Step 1: Persona ──────────────────────────────── */}
        {step === 1 && (
          <textarea
            className="textarea-input"
            style={{ minHeight: 100, resize: 'vertical' }}
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            rows={4}
            placeholder="e.g. Director of Engineering sharing what actually works when automating delivery pipelines. Blunt, practical, no hype."
          />
        )}

        {/* ── Step 2: Niches ───────────────────────────────── */}
        {step === 2 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <button
              onClick={suggest}
              disabled={suggesting}
              className="btn btn-primary btn-sm"
              style={{ alignSelf: 'flex-start' }}
            >
              <Sparkles size={12} />
              {suggesting ? 'Thinking…' : 'Suggest niches for me'}
            </button>

            {suggestedNiches.length > 0 && (
              <div>
                <p className="label" style={{ marginBottom: 8 }}>Suggested for you</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {suggestedNiches.map((n) => (
                    <Chip key={n} label={n} active={niches.includes(n)} onClick={() => toggle(niches, setNiches, n)} />
                  ))}
                </div>
              </div>
            )}

            <div>
              <p className="label" style={{ marginBottom: 8 }}>Selected ({niches.length})</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 28 }}>
                {niches.length === 0
                  ? <span style={{ fontSize: 12, color: 'hsl(var(--text-tertiary))' }}>Nothing selected yet</span>
                  : niches.map((n) => (
                    <Chip key={n} label={`${n} ✕`} active={true} onClick={() => toggle(niches, setNiches, n)} />
                  ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                value={customNiche}
                onChange={(e) => setCustomNiche(e.target.value)}
                placeholder="Add your own niche…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = customNiche.trim();
                    if (v) { toggle(niches, setNiches, v); setCustomNiche(''); }
                  }
                }}
              />
              <button
                onClick={() => { const v = customNiche.trim(); if (v) { toggle(niches, setNiches, v); setCustomNiche(''); } }}
                className="btn btn-secondary"
              >
                Add
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Pillars ──────────────────────────────── */}
        {step === 3 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {suggestedPillars.length === 0 && (
              <button onClick={suggest} disabled={suggesting} className="btn btn-primary btn-sm" style={{ alignSelf: 'flex-start' }}>
                <Sparkles size={12} />
                {suggesting ? 'Thinking…' : 'Suggest pillars for my niches'}
              </button>
            )}
            {suggestedPillars.length > 0 && (
              <div>
                <p className="label" style={{ marginBottom: 8 }}>Suggested</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {suggestedPillars.map((p) => (
                    <Chip key={p} label={p} active={pillars.includes(p)} onClick={() => toggle(pillars, setPillars, p)} />
                  ))}
                </div>
              </div>
            )}
            <div>
              <p className="label" style={{ marginBottom: 8 }}>Selected ({pillars.length})</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 28 }}>
                {pillars.length === 0
                  ? <span style={{ fontSize: 12, color: 'hsl(var(--text-tertiary))' }}>Nothing selected yet</span>
                  : pillars.map((p) => (
                    <Chip key={p} label={`${p} ✕`} active={true} onClick={() => toggle(pillars, setPillars, p)} />
                  ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="input"
                style={{ flex: 1 }}
                value={customPillar}
                onChange={(e) => setCustomPillar(e.target.value)}
                placeholder="Add your own pillar…"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const v = customPillar.trim();
                    if (v) { toggle(pillars, setPillars, v); setCustomPillar(''); }
                  }
                }}
              />
              <button onClick={() => { const v = customPillar.trim(); if (v) { toggle(pillars, setPillars, v); setCustomPillar(''); } }} className="btn btn-secondary">
                Add
              </button>
            </div>
          </div>
        )}

        {/* ── Step 4: Goals ────────────────────────────────── */}
        {step === 4 && (
          <div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {(allGoals.length ? allGoals : [
                'Followers / audience growth', 'Engagement', 'Authority / thought leadership',
                'Leads / demand generation', 'Sales / conversions', 'Website traffic',
                'Community building', 'Loyalty / retention', 'Brand awareness / recall', 'Hiring / employer brand',
              ]).map((g) => (
                <Chip key={g} label={g} active={goals.includes(g)} onClick={() => toggle(goals, setGoals, g)} />
              ))}
            </div>
            <p className="label">Selected ({goals.length})</p>
          </div>
        )}

        {/* ── Step 5: Cadence ──────────────────────────────── */}
        {step === 5 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {CADENCE_OPTIONS.map((o) => (
              <div
                key={o.id}
                onClick={() => setCadence(o.id)}
                style={{
                  padding: '14px 16px', borderRadius: 'var(--radius-sm)',
                  border: `1.5px solid ${cadence === o.id ? 'hsl(221 83% 53%)' : 'hsl(var(--border))'}`,
                  background: cadence === o.id ? 'hsl(221 83% 53% / .06)' : 'hsl(var(--bg-surface))',
                  cursor: 'pointer', transition: 'all 0.15s',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: `2px solid ${cadence === o.id ? 'hsl(221 83% 53%)' : 'hsl(var(--border-strong))'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {cadence === o.id && (
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'hsl(221 83% 53%)' }} />
                  )}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'hsl(var(--text-primary))', marginBottom: 2 }}>
                    {o.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'hsl(var(--text-tertiary))' }}>{o.detail}</div>
                </div>
              </div>
            ))}

            {/* Summary */}
            <div style={{
              marginTop: 8, padding: '14px 16px',
              borderRadius: 'var(--radius-sm)',
              background: 'hsl(var(--bg-surface-2))',
              border: '1px solid hsl(var(--border))',
              display: 'flex', flexDirection: 'column', gap: 5,
            }}>
              {[
                ['Name', screenName || '—'],
                ['Niches', niches.join(', ') || '—'],
                ['Pillars', pillars.join(', ') || '—'],
                ['Goals', goals.join(', ') || '—'],
                ['Cadence', cadence],
              ].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', gap: 8, fontSize: 12 }}>
                  <span style={{ color: 'hsl(var(--text-tertiary))', width: 60, flexShrink: 0 }}>{k}:</span>
                  <span style={{ color: 'hsl(var(--text-primary))' }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 28 }}>
          <button
            onClick={() => setStep((s) => Math.max(0, s - 1) as Step)}
            disabled={step === 0}
            className="btn btn-secondary"
          >
            <ArrowLeft size={13} />
            Back
          </button>

          {step < 5 ? (
            <button
              onClick={() => setStep((s) => Math.min(5, s + 1) as Step)}
              disabled={!canAdvance()}
              className="btn btn-primary"
            >
              Continue
              <ArrowRight size={13} />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="btn btn-success"
              style={{ background: 'hsl(142 71% 45%)', color: 'white', border: 'none' }}
            >
              {saving ? 'Saving…' : 'Finish setup'}
              {!saving && <Check size={13} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
