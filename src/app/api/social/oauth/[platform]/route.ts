import { NextRequest, NextResponse } from 'next/server';
import {
  callbackUrl,
  isConfigured,
  oauthConfig,
  pkcePair,
  randomState,
  stateCookieName,
  verifierCookieName,
} from '@/lib/oauth';
import { currentUserId } from '@/lib/session';

/**
 * Starts the OAuth handoff for a platform.
 *
 * Previously this redirected to "/?connected=LINKEDIN&mode=sandbox" whenever credentials
 * were missing (nothing was connected), used a hard-coded state, and sent a placeholder
 * PKCE challenge as "plain". Now: a real random state and a real S256 challenge are
 * stored in HttpOnly cookies, and missing credentials produce an explicit error.
 */
export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const platform = params.platform.toUpperCase();
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';

  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.redirect(`${baseUrl}/login?error=auth_required`);
  }

  const config = oauthConfig(platform);
  if (!config) {
    return NextResponse.redirect(`${baseUrl}/?oauth_error=${encodeURIComponent('unsupported platform ' + platform)}`);
  }

  if (!isConfigured(platform)) {
    // No pretending: say exactly which env vars are missing.
    const missing = platform === 'TWITTER' ? 'TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET'
      : platform === 'LINKEDIN' ? 'LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET'
      : 'INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET';
    return NextResponse.redirect(
      `${baseUrl}/?oauth_error=${encodeURIComponent(`${platform} is not configured yet - set ${missing} in .env`)}`
    );
  }

  const state = randomState();
  const redirectUri = callbackUrl(platform, baseUrl);

  const auth = new URL(config.authorizeUrl);
  auth.searchParams.set('response_type', 'code');
  auth.searchParams.set('client_id', config.clientId as string);
  auth.searchParams.set('redirect_uri', redirectUri);
  auth.searchParams.set('state', state);
  auth.searchParams.set('scope', config.scope);

  // PKCE: the challenge must be in the URL BEFORE the redirect is built, and the verifier cookie must
  // ride on the SAME response as the state cookie. The previous code built a second redirect and copied
  // `res.headers.get('Set-Cookie')` across, which collapses two Set-Cookie headers into one and drops
  // the verifier - the browser then reached the token endpoint with no code_verifier (HTTP 400).
  let verifier: string | undefined;
  if (config.usesPkce) {
    const pair = pkcePair();
    verifier = pair.verifier;
    auth.searchParams.set('code_challenge', pair.challenge);
    auth.searchParams.set('code_challenge_method', 'S256');
  }

  const res = NextResponse.redirect(auth.toString());

  const cookieOpts = {
    httpOnly: true as const,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 600,
  };
  res.cookies.set(stateCookieName(platform), state, cookieOpts);
  if (verifier) {
    res.cookies.set(verifierCookieName(platform), verifier, cookieOpts);
  }

  return res;
}
