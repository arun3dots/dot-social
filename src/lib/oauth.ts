import crypto from 'crypto';

export type Platform = 'TWITTER' | 'LINKEDIN' | 'INSTAGRAM';

type OAuthConfig = {
  authorizeUrl: string;
  tokenUrl: string;
  scope: string;
  clientId?: string;
  clientSecret?: string;
  usesPkce: boolean;
  // how to read the account identity out of the provider's response
  identityUrl: (token: string) => string;
  identityHeaders: (token: string) => Record<string, string>;
  parseIdentity: (json: any) => { handle: string; name: string };
};

const G = 'https://graph.facebook.com/v21.0';

export function oauthConfig(platform: string): OAuthConfig | null {
  switch (String(platform).toUpperCase()) {
    case 'TWITTER':
      return {
        authorizeUrl: 'https://twitter.com/i/oauth2/authorize',
        tokenUrl: 'https://api.twitter.com/2/oauth2/token',
        scope: 'tweet.read tweet.write users.read offline.access',
        clientId: (process.env.TWITTER_CLIENT_ID || '').trim() || undefined,
        clientSecret: (process.env.TWITTER_CLIENT_SECRET || '').trim() || undefined,
        usesPkce: true,
        identityUrl: () => 'https://api.twitter.com/2/users/me',
        identityHeaders: (t) => ({ Authorization: `Bearer ${t}` }),
        parseIdentity: (j) => ({ handle: '@' + (j?.data?.username || 'unknown'), name: j?.data?.name || 'X account' }),
      };
    case 'LINKEDIN':
      return {
        authorizeUrl: 'https://www.linkedin.com/oauth/v2/authorization',
        tokenUrl: 'https://www.linkedin.com/oauth/v2/accessToken',
        scope: 'openid profile w_member_social',
        clientId: (process.env.LINKEDIN_CLIENT_ID || '').trim() || undefined,
        clientSecret: (process.env.LINKEDIN_CLIENT_SECRET || '').trim() || undefined,
        usesPkce: false,
        identityUrl: () => 'https://api.linkedin.com/v2/userinfo',
        identityHeaders: (t) => ({ Authorization: `Bearer ${t}` }),
        parseIdentity: (j) => ({ handle: j?.email || j?.sub || 'linkedin-member', name: j?.name || 'LinkedIn member' }),
      };
    case 'INSTAGRAM':
      return {
        authorizeUrl: `${G.replace('graph.facebook.com', 'www.facebook.com')}/dialog/oauth`,
        tokenUrl: `${G}/oauth/access_token`,
        scope: 'instagram_basic,instagram_content_publish,pages_show_list',
        clientId: (process.env.INSTAGRAM_APP_ID || '').trim() || undefined,
        clientSecret: (process.env.INSTAGRAM_APP_SECRET || '').trim() || undefined,
        usesPkce: false,
        identityUrl: (t) => `${G}/me?fields=id,name&access_token=${encodeURIComponent(t)}`,
        identityHeaders: () => ({}),
        parseIdentity: (j) => ({ handle: j?.name || j?.id || 'instagram-account', name: j?.name || 'Instagram account' }),
      };
    default:
      return null;
  }
}

export function isConfigured(platform: string): boolean {
  const c = oauthConfig(platform);
  return !!c?.clientId && !!c?.clientSecret;
}

export function randomState(): string {
  return crypto.randomBytes(16).toString('hex');
}

/** PKCE S256 pair. The verifier is stored in an HttpOnly cookie, never in the URL. */
export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function callbackUrl(platform: string, baseUrl: string): string {
  return `${baseUrl}/api/social/oauth/${String(platform).toLowerCase()}/callback`;
}

export function stateCookieName(platform: string): string {
  return `oauth_state_${String(platform).toLowerCase()}`;
}
export function verifierCookieName(platform: string): string {
  return `oauth_verifier_${String(platform).toLowerCase()}`;
}

/**
 * Exchange an authorization code for a real access token. Returns an explicit failure
 * instead of a placeholder token - there is no code path here that invents credentials.
 */
export async function exchangeCode(
  platform: string,
  args: { code: string; baseUrl: string; verifier?: string }
): Promise<{ ok: true; token: string } | { ok: false; reason: string }> {
  const c = oauthConfig(platform);
  if (!c) return { ok: false, reason: 'unsupported platform' };
  if (!c.clientId || !c.clientSecret) {
    return { ok: false, reason: `${platform} app credentials are not configured` };
  }

  const redirectUri = callbackUrl(platform, args.baseUrl);
  try {
    let res: Response;

    if (c.tokenUrl.endsWith('/oauth/token')) {
      // X: confidential client, credentials in the Basic header
      const basic = Buffer.from(`${c.clientId}:${c.clientSecret}`).toString('base64');
      res = await fetch(c.tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${basic}`,
        },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: args.code,
          redirect_uri: redirectUri,
          ...(c.usesPkce && args.verifier ? { code_verifier: args.verifier } : {}),
        }).toString(),
      });
    } else if (String(platform).toUpperCase() === 'INSTAGRAM') {
      // Meta: token endpoint is a GET with query params
      const qs = new URLSearchParams({
        client_id: c.clientId,
        client_secret: c.clientSecret,
        redirect_uri: redirectUri,
        code: args.code,
      });
      res = await fetch(`${c.tokenUrl}?${qs.toString()}`, { method: 'GET' });
    } else {
      // LinkedIn: form POST with client credentials in the body
      res = await fetch(c.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: args.code,
          redirect_uri: redirectUri,
          client_id: c.clientId,
          client_secret: c.clientSecret,
        }).toString(),
      });
    }

    const text = await res.text();
    if (!res.ok) {
      return { ok: false, reason: `${platform} token endpoint returned HTTP ${res.status}: ${text.slice(0, 180)}` };
    }
    let json: any = {};
    try { json = JSON.parse(text); } catch { /* some providers reply form-encoded */ }
    const token = json.access_token || new URLSearchParams(text).get('access_token');
    if (!token) return { ok: false, reason: `${platform} token response carried no access_token` };
    return { ok: true, token };
  } catch (e: any) {
    return { ok: false, reason: `${platform} token exchange failed: ${e.message}` };
  }
}

/** Read the real account handle/name for the granted token. */
export async function fetchIdentity(
  platform: string,
  token: string
): Promise<{ ok: true; handle: string; name: string } | { ok: false; reason: string }> {
  const c = oauthConfig(platform);
  if (!c) return { ok: false, reason: 'unsupported platform' };
  try {
    const res = await fetch(c.identityUrl(token), { headers: c.identityHeaders(token) });
    if (!res.ok) return { ok: false, reason: `${platform} identity lookup returned HTTP ${res.status}` };
    const json = await res.json();
    return { ok: true, ...c.parseIdentity(json) };
  } catch (e: any) {
    return { ok: false, reason: `${platform} identity lookup failed: ${e.message}` };
  }
}
