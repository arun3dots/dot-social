'use client';

import React, { useState } from 'react';
import { PlanTier, SubscriptionInfo } from '@/types';
import { PLAN_TIERS } from '@/lib/subscriptions';
import { Check, Zap, X, Shield, ArrowRight } from 'lucide-react';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
      <div className="bg-[#0f1219] border border-zinc-800 rounded-xl max-w-4xl w-full p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-zinc-400 hover:text-zinc-100 p-1 rounded-md transition-colors"
        >
          <X size={18} />
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-800/40 text-cyan-400 text-xs font-mono mb-3">
            <Zap size={13} />
            <span>SUBSCRIPTION_TIERS</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">
            Select Your Publishing Plan
          </h2>
          <p className="text-xs text-zinc-400 max-w-md mx-auto">
            Scale your multi-platform social presence across Instagram, LinkedIn, and X with automated AI scheduling.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(Object.keys(PLAN_TIERS) as PlanTier[]).map((tierKey) => {
            const plan = PLAN_TIERS[tierKey];
            const isCurrent = currentSubscription.tier === tierKey;
            const isPro = tierKey === 'PRO_CREATOR';

            return (
              <div
                key={tierKey}
                className={`relative flex flex-col justify-between rounded-lg p-5 border transition-all ${
                  isPro
                    ? 'border-cyan-500/60 bg-[#121722] shadow-lg shadow-cyan-950/20'
                    : 'border-zinc-800 bg-[#0a0c10]'
                }`}
              >
                {isPro && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-cyan-500 text-black font-mono text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                    {plan.badge}
                  </span>
                )}

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-semibold text-sm text-zinc-200">{plan.name}</h3>
                    {isCurrent && (
                      <span className="badge badge-emerald text-[10px] font-mono">
                        CURRENT_PLAN
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline gap-1 mb-4">
                    <span className="text-2xl font-bold text-white font-mono">{plan.price}</span>
                    <span className="text-xs text-zinc-500">{plan.billingPeriod}</span>
                  </div>

                  <p className="text-xs text-zinc-400 mb-4 min-h-[32px]">{plan.description}</p>

                  <div className="space-y-2 border-t border-zinc-800/80 pt-4 mb-6">
                    {plan.features.map((f, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs text-zinc-300">
                        <Check size={12} className="text-cyan-400 shrink-0" />
                        <span>{f}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => handleSelectTier(tierKey)}
                  disabled={isCurrent || loadingTier !== null}
                  className={`w-full py-2 px-3 rounded font-mono text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                    isCurrent
                      ? 'bg-zinc-800 text-zinc-500 cursor-default'
                      : isPro
                      ? 'bg-cyan-500 hover:bg-cyan-400 text-black'
                      : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                  }`}
                >
                  {isCurrent ? (
                    'Active Plan'
                  ) : loadingTier === tierKey ? (
                    'Upgrading...'
                  ) : (
                    <>
                      <span>Select {plan.name}</span>
                      <ArrowRight size={12} />
                    </>
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
