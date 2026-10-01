import { NextRequest, NextResponse } from 'next/server';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';

const QUALITIES = ['low', 'medium', 'high'];

export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    await initPostgresTables();
    const r = await pool.query('SELECT image_quality FROM users WHERE id = $1', [userId]);
    return NextResponse.json({
      settings: { imageQuality: r.rows[0]?.image_quality || 'low' },
      options: { imageQuality: QUALITIES },
      // Read-only indicator so the studio can state honestly whether the scheduler may post.
      publishing: {
        armed: (process.env.PUBLISHING_ENABLED || '').trim() === 'true',
        note: (process.env.PUBLISHING_ENABLED || '').trim() === 'true'
          ? 'Live publishing is armed: approved posts due now will be posted by the scheduler.'
          : 'Live publishing is OFF. Approved posts stay queued; Dispatch Now still posts a single post explicitly.',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    if (body.imageQuality !== undefined) {
      const q = String(body.imageQuality).toLowerCase();
      if (!QUALITIES.includes(q)) {
        return NextResponse.json({ error: `imageQuality must be one of ${QUALITIES.join(', ')}` }, { status: 400 });
      }
      await initPostgresTables();
      await pool.query('UPDATE users SET image_quality = $1 WHERE id = $2', [q, userId]);
    }

    const r = await pool.query('SELECT image_quality FROM users WHERE id = $1', [userId]);
    return NextResponse.json({ success: true, settings: { imageQuality: r.rows[0]?.image_quality || 'low' } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
