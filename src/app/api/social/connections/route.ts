import { NextResponse } from 'next/server';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';

const PLATFORMS = ['TWITTER', 'LINKEDIN', 'INSTAGRAM'] as const;

/** The caller's real connection state, so the studio never shows a guessed one. */
export async function GET() {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    await initPostgresTables();
    const res = await pool.query(
      'SELECT platform, account_handle, account_name, connected, is_sandbox FROM social_connections WHERE user_id = $1',
      [userId]
    );
    const byPlatform = new Map<string, any>();
    for (const r of res.rows) byPlatform.set(r.platform, r);

    const connections = PLATFORMS.map((p) => {
      const r = byPlatform.get(p);
      return {
        platform: p,
        connected: r ? r.connected === true : false,
        isSandbox: r ? r.is_sandbox !== false : true,
        handle: r && r.connected ? r.account_handle : 'Not connected',
        accountName: r?.account_name || undefined,
      };
    });

    return NextResponse.json({ connections });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/** Disconnect: revoke the stored token so the UI cannot disagree with the database. */
export async function DELETE(request: Request) {
  try {
    const userId = await currentUserId();
    if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const platform = String(body.platform || '').toUpperCase();
    if (!PLATFORMS.includes(platform as any)) {
      return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });
    }

    await initPostgresTables();
    const res = await pool.query(
      `UPDATE social_connections
          SET connected = FALSE, is_sandbox = TRUE, access_token = NULL, account_handle = 'Not connected'
        WHERE user_id = $1 AND platform = $2
        RETURNING platform, account_handle, connected, is_sandbox`,
      [userId, platform]
    );

    if (res.rows.length === 0) {
      // Nothing was connected; say so rather than reporting a disconnect that never happened.
      return NextResponse.json({ platform, connected: false, wasConnected: false });
    }

    return NextResponse.json({
      platform: res.rows[0].platform,
      connected: res.rows[0].connected,
      isSandbox: res.rows[0].is_sandbox,
      handle: res.rows[0].account_handle,
      wasConnected: true,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
