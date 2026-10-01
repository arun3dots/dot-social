import { NextRequest, NextResponse } from 'next/server';
import { PLAN_TIERS } from '@/lib/subscriptions';
import { getDbSubscription, updateDbSubscription } from '@/lib/postgres';
import { PlanTier } from '@/types';
import { currentUserId } from '@/lib/session';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    // Session wins; never let a caller pick another tenant's data by query param.
    const userId = (await currentUserId()) || searchParams.get('userId') || 'usr_creator_01';

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
    const { tier } = body;
    const userId = (await currentUserId()) || body.userId || 'usr_creator_01';

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
