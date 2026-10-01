import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  req: NextRequest,
  { params }: { params: { platform: string } }
) {
  const platform = params.platform.toUpperCase();
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  if (platform === 'TWITTER') {
    const clientId = process.env.TWITTER_CLIENT_ID;
    if (!clientId) {
      return NextResponse.redirect(`${baseUrl}/?connected=TWITTER&mode=sandbox`);
    }
    const redirectUri = encodeURIComponent(`${baseUrl}/api/social/oauth/twitter/callback`);
    const state = 'state_tw_sec';
    const codeChallenge = 'challenge_example';
    const authUrl = `https://twitter.com/i/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&scope=tweet.read%20tweet.write%20users.read%20offline.access&state=${state}&code_challenge=${codeChallenge}&code_challenge_method=plain`;
    return NextResponse.redirect(authUrl);
  }

  if (platform === 'LINKEDIN') {
    const clientId = process.env.LINKEDIN_CLIENT_ID;
    if (!clientId) {
      return NextResponse.redirect(`${baseUrl}/?connected=LINKEDIN&mode=sandbox`);
    }
    const redirectUri = encodeURIComponent(`${baseUrl}/api/social/oauth/linkedin/callback`);
    const state = 'state_li_sec';
    const authUrl = `https://www.linkedin.com/oauth/v2/authorization?response_type=code&client_id=${clientId}&redirect_uri=${redirectUri}&state=${state}&scope=openid%20profile%20w_member_social`;
    return NextResponse.redirect(authUrl);
  }

  if (platform === 'INSTAGRAM') {
    const appId = process.env.INSTAGRAM_APP_ID;
    if (!appId) {
      return NextResponse.redirect(`${baseUrl}/?connected=INSTAGRAM&mode=sandbox`);
    }
    const redirectUri = encodeURIComponent(`${baseUrl}/api/social/oauth/instagram/callback`);
    const authUrl = `https://www.facebook.com/v20.0/dialog/oauth?client_id=${appId}&redirect_uri=${redirectUri}&scope=instagram_basic,instagram_content_publish,pages_show_list&response_type=code`;
    return NextResponse.redirect(authUrl);
  }

  return NextResponse.json({ error: 'Unsupported platform' }, { status: 400 });
}
