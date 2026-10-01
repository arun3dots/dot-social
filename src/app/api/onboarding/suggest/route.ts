import { NextRequest, NextResponse } from 'next/server';

type Domain = { match: RegExp; niches: string[]; pillars: string[]; goals: string[] };

// Curated, deterministic suggestions. Swappable for an LLM call later, but this
// keeps onboarding instant, free and testable.
const DOMAINS: Domain[] = [
  { match: /ai|automation|saas|software|dev|engineer|tech|data|cloud/i,
    niches: ['AI & Automation', 'SaaS & Startups', 'Developer Tools', 'Productivity Systems'],
    pillars: ['Educational / how-to', 'Authority / POV', 'Product & offer', 'Tips & tools', 'Myth-busting'],
    goals: ['Authority / thought leadership', 'Leads / demand generation', 'Followers / audience growth'] },
  { match: /coffee|food|bakery|restaurant|chef|culinary|barista|cafe/i,
    niches: ['Food & Beverage Craft', 'Local Business Growth', 'Behind-the-Counter Stories'],
    pillars: ['Behind-the-scenes', 'Educational / how-to', 'Social proof / testimonials', 'Community / UGC & Q&A'],
    goals: ['Engagement', 'Community building', 'Sales / conversions'] },
  { match: /fit|health|gym|yoga|nutrition|wellness|coach/i,
    niches: ['Health & Fitness Coaching', 'Habit & Mindset Systems', 'Nutrition Simplified'],
    pillars: ['Educational / how-to', 'Social proof / results', 'Myth-busting', 'Personal story'],
    goals: ['Followers / audience growth', 'Leads / demand generation', 'Engagement'] },
  { match: /finance|invest|money|account|tax|wealth|fintech/i,
    niches: ['Personal Finance', 'Small-Business Finance Ops', 'Investing Basics'],
    pillars: ['Educational / how-to', 'Authority / POV', 'Industry news & commentary', 'Myth-busting'],
    goals: ['Authority / thought leadership', 'Leads / demand generation', 'Website traffic'] },
  { match: /design|ux|ui|brand|creative|art|photo/i,
    niches: ['Design Craft & Process', 'Brand Systems', 'Creative Portfolio Building'],
    pillars: ['Behind-the-scenes', 'Case study', 'Educational / how-to', 'Product & offer'],
    goals: ['Followers / audience growth', 'Engagement', 'Leads / demand generation'] },
  { match: /real estate|property|rent|broker|construction/i,
    niches: ['Local Real Estate', 'Property Investing Basics', 'Home Buying Education'],
    pillars: ['Educational / how-to', 'Social proof / testimonials', 'Industry news & commentary', 'Community / Q&A'],
    goals: ['Leads / demand generation', 'Sales / conversions', 'Website traffic'] },
  { match: /travel|tourism|hotel|hospitality|destination/i,
    niches: ['Travel Planning', 'Destination Guides', 'Hospitality Operations'],
    pillars: ['Behind-the-scenes', 'Social proof / testimonials', 'Community / Q&A', 'Entertainment'],
    goals: ['Followers / audience growth', 'Engagement', 'Sales / conversions'] },
  { match: /market|agency|growth|consult|sales|b2b/i,
    niches: ['B2B Growth & Demand Gen', 'Marketing Systems', 'Consulting & Advisory'],
    pillars: ['Authority / POV', 'Case study', 'Educational / how-to', 'Industry news & commentary'],
    goals: ['Leads / demand generation', 'Authority / thought leadership', 'Sales / conversions'] },
];

const FALLBACK: Omit<Domain, 'match'> = {
  niches: ['Personal Brand Building', 'Audience Growth', 'Content Systems'],
  pillars: ['Educational / how-to', 'Personal story', 'Social proof / testimonials', 'Tips & tools'],
  goals: ['Followers / audience growth', 'Engagement', 'Authority / thought leadership'],
};

const ALL_GOALS = [
  'Followers / audience growth', 'Engagement', 'Authority / thought leadership',
  'Leads / demand generation', 'Sales / conversions', 'Website traffic',
  'Community building', 'Loyalty / retention', 'Brand awareness / recall', 'Hiring / employer brand',
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const text = `${body.screenName || ''} ${body.persona || ''} ${body.niche || ''} ${(body.niches || []).join(' ')}`;
    const hit = DOMAINS.find((d) => d.match.test(text)) || null;
    const base = hit || FALLBACK;

    return NextResponse.json({
      matched: !!hit,
      recommendedNiches: base.niches,
      suggestedPillars: base.pillars,
      suggestedGoals: base.goals,
      allGoals: ALL_GOALS,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
