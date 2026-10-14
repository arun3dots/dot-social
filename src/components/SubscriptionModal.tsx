'use client';

import React, { useState } from 'react';
import { PlanTier, SubscriptionInfo } from '@/types';
import { PLAN_TIERS } from '@/lib/subscriptions';
import { Check, Zap, X, ArrowRight } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentSubscription: SubscriptionInfo;
  onPlanUpdated: (newSub: SubscriptionInfo) => void;
}

export default function SubscriptionModal({
  isOpen,
  onClose,
  currentSubscription,
  onPlanUpdated,
}: Props) {
  const [loadingTier, setLoadingTier] = useState<PlanTier | null>(null);

  if (!isOpen) return null;

  const handleSelectTier = async (tier: PlanTier) => {
    if (tier === currentSubscription.tier) return;
    setLoadingTier(tier);
    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const data = await res.json();
      if (res.ok && data.subscription) {
        onPlanUpdated(data.subscription);
        onClose();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingTier(null);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      background: 'rgba(0,0,0,.5)',
      backdropFilter: 'blur(6px)',
      animation: 'toast-in 0.15s ease',
    }}>
      <div style={{
        background: 'hsl(var(--bg-surface))',
        border: '1px solid hsl(var(--border))',
        borderRadius: 'var(--radius-lg)',
        maxWidth: 860, width: '100%',
        padding: '32px 28px 28px',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
      }}>
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 16, right: 16,
            width: 30, height: 30, borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'hsl(var(--bg-surface-2))',
            border: '1px solid hsl(var(--border))',
            cursor: 'pointer', color: 'hsl(var(--text-secondary))',
          }}
        >
          <X size={14} />
        </button>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 12px', borderRadius: 20,
            background: 'hsl(221 83% 53% / .1)',
            color: 'hsl(221 83% 45%)',
            border: '1px solid hsl(221 83% 53% / .2)',
            fontSize: 11, fontWeight: 600, marginBottom: 14,
          }}>
            <Zap size={12} />
            Publishing Plans
          </span>
          <h2 style={{ fontSize: 22, fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.03em', marginBottom: 6 }}>
            Choose your plan
          </h2>
          <p style={{ fontSize: 13, color: 'hsl(var(--text-secondary))' }}>
            Scale your multi-platform presence with AI-powered automated scheduling.
          </p>
        </div>

        {/* Plan cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {(Object.keys(PLAN_TIERS) as PlanTier[]).map((tierKey) => {
            const plan = PLAN_TIERS[tierKey];
            const isCurrent = currentSubscription.tier === tierKey;
            const isPro = tierKey === 'PRO_CREATOR';

            return (
              <div
                key={tierKey}
                style={{
                  position: 'relative',
                  display: 'flex', flexDirection: 'column',
                  borderRadius: 'var(--radius)',
                  padding: '20px 18px',
                  border: isPro ? '2px solid hsl(221 83% 53%)' : '1px solid hsl(var(--border))',
                  background: isPro ? 'hsl(221 83% 53% / .04)' : 'hsl(var(--bg-surface))',
                  boxShadow: isPro ? 'var(--shadow-md)' : 'none',
                }}
              >
                {isPro && (
                  <span style={{
                    position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)',
                    background: 'hsl(221 83% 53%)', color: 'white',
                    fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                    whiteSpace: 'nowrap',
                  }}>
                    {plan.badge}
                  </span>
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: 'hsl(var(--text-primary))' }}>
                      {plan.name}
                    </h3>
                    {isCurrent && (
                      <span className="badge badge-approved">Current</span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 10 }}>
                    <span style={{ fontSize: 26, fontWeight: 800, color: 'hsl(var(--text-primary))', letterSpacing: '-0.04em' }}>
                      {plan.price}
                    </span>
                    <span style={{ fontSize: 12, color: 'hsl(var(--text-tertiary))' }}>
                      {plan.billingPeriod}
                    </span>
                  </div>

                  <p style={{ fontSize: 12, color: 'hsl(var(--text-secondary))', marginBottom: 14, lineHeight: 1.5, minHeight: 36 }}>
                    {plan.description}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid hsl(var(--border))', paddingTop: 14, marginBottom: 18 }}>
                    {plan.features.map((f, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'hsl(var(--text-secondary))' }}>
                        <Check size={13} style={{ color: 'hsl(221 83% 53%)', flexShrink: 0, marginTop: 1 }} />
                        {f}
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSelectTier(tierKey)}
                  disabled={isCurrent || loadingTier !== null}
                  className={`btn ${isCurrent ? 'btn-secondary' : isPro ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {isCurrent ? 'Active Plan' : loadingTier === tierKey ? 'Upgrading…' : (
                    <>{`Select ${plan.name}`} <ArrowRight size={12} /></>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
