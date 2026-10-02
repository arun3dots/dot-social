import { NextRequest, NextResponse } from 'next/server';
import pool, { initPostgresTables } from '@/lib/postgres';
import { currentUserId } from '@/lib/session';
import { exchangeCode, fetchIdentity, stateCookieName, verifierCookieName } from '@/lib/oauth';

/**
 * Completes the OAuth handoff.
 *
 * Previously this minted `live_tok_<timestamp>`, hard-coded usr_creator_01, and stored the
 * row with is_sandbox = FALSE while reporting mode=live - a fabricated live connection.
 * Now the code is really exchanged, the real account handle is read from the provider, and
 * any failure is reported as a failure: no connection row is written unless a provider
 * actually issued a token.
 */
export async function GET(req: NextRequest, { params }: { params: { platform: string } }) {
  const platform = params.platform.toUpperCase();
  const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  const userId = await currentUserId();
  if (!userId) {
    return NextResponse.redirect(`${baseUrl}/login?error=auth_required`);
  }

  const fail = (reason: string) =>
    NextResponse.redirect(`${baseUrl}/?oauth_error=${encodeURIComponent(reason)}`);

  // Provider-side errors come back as ?error=access_denied etc.
  const providerError = searchParams.get('error');
  if (providerError) {
    return fail(`${platform} denied the request: ${providerError} ${searchParams.get('error_description') || ''}`.trim());
  }
  if (!code) return fail(`${platform} returned no authorization code`);

  // CSRF: the state we minted must match the cookie we set, and the verifier must exist.
  const expectedState = req.cookies.get(stateCookieName(platform))?.value;
  const verifier = req.cookies.get(verifierCookieName(platform))?.value;
  if (!expectedState || !state || state !== expectedState) {
    return fail(`${platform} OAuth state did not match - the handoff was rejected`);
  }

  const exchanged = await exchangeCode(platform, { code, baseUrl, verifier });
  if (!exchanged.ok) {
    return fail(exchanged.reason);
  }

  const identity = await fetchIdentity(platform, exchanged.token);
  if (!identity.ok) {
    return fail(identity.reason);
  }

  try {
    await initPostgresTables();
  } catch (e: any) {
    return fail(`database unavailable: ${e.message}`);
  }

  // Keyed to the signed-in user. is_sandbox is FALSE only because a real token was issued.
  try {
    await pool.query(
      `INSERT INTO social_connections (id, user_id, platform, account_handle, account_name, connected, is_sandbox, access_token)
       VALUES ($1, $2, $3, $4, $5, TRUE, FALSE, $6)
       ON CONFLICT (user_id, platform)
       DO UPDATE SET connected = TRUE, is_sandbox = FALSE,
                     access_token = EXCLUDED.access_token,
                     account_handle = EXCLUDED.account_handle,
                     account_name = EXCLUDED.account_name`,
      [`conn_${platform.toLowerCase()}_${userId.slice(4, 16)}`, userId, platform, identity.handle, identity.name, exchanged.token]
    );
  } catch (e: any) {
    return fail(`could not save the connection: ${e.message}`);
  }

  const res = NextResponse.redirect(`${baseUrl}/?connected=${platform}&mode=live&handle=${encodeURIComponent(identity.handle)}`);
  res.cookies.delete(stateCookieName(platform));
  res.cookies.delete(verifierCookieName(platform));
  return res;
}
