import { NextRequest, NextResponse } from 'next/server';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import { CADENCES, MAX_HORIZON_DAYS, daysForCadence } from '@/lib/cadence';

const MAX_ITEMS = 12;

function asList(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string')
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
}

export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await initPostgresTables();
    const res = await pool.query(
      `SELECT id, email, name, screen_name, persona, niches, pillars, goals, cadence, onboarding_completed
       FROM users WHERE id = $1`,
      [userId]
    );
    if (res.rows.length === 0) return NextResponse.json({ profile: null });

    const r = res.rows[0];
    return NextResponse.json({
      profile: {
        id: r.id,
        email: r.email,
        name: r.name,
        screenName: r.screen_name,
        persona: r.persona,
        niches: r.niches || [],
        pillars: r.pillars || [],
        goals: r.goals || [],
        cadence: r.cadence || 'weekly',
        onboardingCompleted: !!r.onboarding_completed,
        horizonDays: daysForCadence(r.cadence),
      },
      limits: { maxHorizonDays: MAX_HORIZON_DAYS, cadences: CADENCES },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json();
    const screenName = String(body.screenName || '').trim().slice(0, 100);
    const persona = String(body.persona || '').trim().slice(0, 2000);
    const niches = asList(body.niches);
    const pillars = asList(body.pillars);
    const goals = asList(body.goals);
    const cadence = CADENCES.includes(body.cadence) ? body.cadence : 'weekly';

    const missing: string[] = [];
    if (!screenName) missing.push('screenName');
    if (niches.length === 0) missing.push('niches');
    if (pillars.length === 0) missing.push('pillars');
    if (goals.length === 0) missing.push('goals');
    if (missing.length) {
      return NextResponse.json({ error: 'Missing required fields', missing }, { status: 400 });
    }

    await initPostgresTables();
    await pool.query(
      `UPDATE users
         SET screen_name = $2, persona = $3, niches = $4, pillars = $5, goals = $6,
             cadence = $7, onboarding_completed = TRUE, name = COALESCE(NULLIF($8, ''), name)
       WHERE id = $1`,
      [userId, screenName, persona, niches, pillars, goals, cadence, screenName]
    );

    return NextResponse.json({
      success: true,
      profile: { id: userId, screenName, persona, niches, pillars, goals, cadence, onboardingCompleted: true },
      horizonDays: daysForCadence(cadence),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
