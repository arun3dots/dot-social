import { NextRequest, NextResponse } from 'next/server';
import pool, { initPostgresTables } from '@/lib/postgres';

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform.toUpperCase();
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  if (!code) {
    return NextResponse.redirect(`${baseUrl}/?error=no_auth_code`);
  }

  try {
    await initPostgresTables();

    // In production with live secret, exchange code with provider token endpoint:
    // e.g. POST https://api.twitter.com/2/oauth2/token or https://www.linkedin.com/oauth/v2/accessToken
    const mockToken = `live_tok_${Date.now()}`;
    const mockHandle = `@live_${platform.toLowerCase()}_creator`;

    await pool.query(
      `
      INSERT INTO social_connections (id, user_id, platform, account_handle, account_name, connected, is_sandbox, access_token)
      VALUES ($1, $2, $3, $4, $5, TRUE, FALSE, $6)
      ON CONFLICT (user_id, platform)
      DO UPDATE SET 
        connected = TRUE,
        is_sandbox = FALSE,
        access_token = EXCLUDED.access_token,
        account_handle = EXCLUDED.account_handle;
    `,
      [`conn_${Date.now()}`, 'usr_creator_01', platform, mockHandle, 'Connected Account', mockToken]
    );

    return NextResponse.redirect(`${baseUrl}/?connected=${platform}&mode=live`);
  } catch (err: any) {
    console.error('OAuth Callback error:', err.message);
    return NextResponse.redirect(`${baseUrl}/?error=${encodeURIComponent(err.message)}`);
  }
}
