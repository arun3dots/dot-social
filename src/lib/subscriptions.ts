import { PlanTier, SubscriptionInfo } from '@/types';

export interface PlanDetails {
  tier: PlanTier;
  name: string;
  price: string;
  billingPeriod: string;
  badge: string;
  description: string;
  features: string[];
  maxSocialAccounts: number;
  maxMonthlyPosts: number;
  byokAllowed: boolean;
  autoSchedulingEnabled: boolean;
}

export const PLAN_TIERS: Record<PlanTier, PlanDetails> = {
  FREE_TRIAL: {
    tier: 'FREE_TRIAL',
    name: 'Free Trial',
    price: '$0',
    billingPeriod: 'forever',
    badge: 'FREE',
    description: 'Perfect for exploring automated AI calendar generation.',
    features: [
      '1 Connected Social Account',
      '9 Posts / Month (1 Full Batch)',
      'Google Gemini In-built Engine',
      'Manual Review & One-Click Approval',
      'Sandbox Dispatch Simulation',
    ],
    maxSocialAccounts: 1,
    maxMonthlyPosts: 9,
    byokAllowed: false,
    autoSchedulingEnabled: false,
  },
  PRO_CREATOR: {
    tier: 'PRO_CREATOR',
    name: 'Pro Creator',
    price: '$29',
    billingPeriod: '/month',
    badge: 'MOST POPULAR',
    description: 'For content creators & solo founders scaling multi-channel authority.',
    features: [
      'All 3 Platforms (Instagram, LinkedIn, X)',
      '100 Posts / Month',
      'Bring Your Own Key (OpenAI & DeepSeek)',
      'Automated Background Scheduling',
      'AI Image Visual Prompts & Banners',
      'Standard Live API + Sandbox',
    ],
    maxSocialAccounts: 3,
    maxMonthlyPosts: 100,
    byokAllowed: true,
    autoSchedulingEnabled: true,
  },
  AGENCY_SCALE: {
    tier: 'AGENCY_SCALE',
    name: 'Agency Scale',
    price: '$99',
    billingPeriod: '/month',
    badge: 'UNLIMITED',
    description: 'For agencies and business owners managing multiple brands.',
    features: [
      'Unlimited Social Accounts',
      'Unlimited Monthly Posts',
      'Priority LLM Generation Queue',
      'Multi-User & Creator Management',
      'Custom Webhooks & Analytics Stream',
      'Dedicated Dispatch Workers',
    ],
    maxSocialAccounts: 999,
    maxMonthlyPosts: 9999,
    byokAllowed: true,
    autoSchedulingEnabled: true,
  },
};

export function getDefaultSubscription(tier: PlanTier = 'FREE_TRIAL'): SubscriptionInfo {
  const plan = PLAN_TIERS[tier];
  return {
    tier,
    status: 'ACTIVE',
    maxSocialAccounts: plan.maxSocialAccounts,
    maxMonthlyPosts: plan.maxMonthlyPosts,
    currentPostUsage: 0,
    byokAllowed: plan.byokAllowed,
    autoSchedulingEnabled: plan.autoSchedulingEnabled,
    currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}
