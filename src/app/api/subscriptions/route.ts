import { NextRequest, NextResponse } from 'next/server';
import { PLAN_TIERS } from '@/lib/subscriptions';
import { getDbSubscription, updateDbSubscription } from '@/lib/postgres';
import { PlanTier } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId') || 'usr_creator_01';

    const sub = await getDbSubscription(userId);
    return NextResponse.json({
      subscription: sub,
      plans: Object.values(PLAN_TIERS),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { tier, userId = 'usr_creator_01' } = body;

    if (!tier || !PLAN_TIERS[tier as PlanTier]) {
      return NextResponse.json({ error: 'Invalid plan tier' }, { status: 400 });
    }

    const updatedSub = await updateDbSubscription(userId, tier as PlanTier);

    return NextResponse.json({
      success: true,
      message: `Successfully upgraded to ${PLAN_TIERS[tier as PlanTier].name}!`,
      subscription: updatedSub,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
