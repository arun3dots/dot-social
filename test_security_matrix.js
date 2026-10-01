/**
 * Security regression suite for the current auth design.
 *
 * Replaces test_auth_matrix.js, which asserted the OLD design as correct: that
 * POST /api/auth/admin/login returns 200 with {"secretKey":"admin123"}, that the session is
 * an unsigned `social_engine_session` cookie, and that the creator login route mints a
 * session from an email string. Those routes and that cookie were removed as
 * vulnerabilities, so a suite that certifies them is worse than no suite.
 *
 * Run with the app listening: node test_security_matrix.js
 */
const http = require('http');

const HOST = process.env.HOST || 'localhost';
const PORT = parseInt(process.env.PORT || '3000', 10);

let passed = 0;
let failed = 0;
const failures = [];

function assert(title, ok, detail = '') {
  if (ok) {
    console.log(`  [PASS] ${title}`);
    passed++;
  } else {
    console.log(`  [FAIL] ${title}${detail ? ' -> ' + detail : ''}`);
    failed++;
    failures.push(title);
  }
}

function req(method, path, { cookie, json, form, headers } = {}) {
  return new Promise((resolve, reject) => {
    const h = { ...(headers || {}) };
    let body;
    if (json !== undefined) {
      body = JSON.stringify(json);
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = Buffer.byteLength(body);
    } else if (form !== undefined) {
      body = new URLSearchParams(form).toString();
      h['Content-Type'] = 'application/x-www-form-urlencoded';
      h['Content-Length'] = Buffer.byteLength(body);
    }
    if (cookie) h['Cookie'] = cookie;

    const r = http.request({ hostname: HOST, port: PORT, path, method, headers: h }, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch { /* html */ }
        resolve({ status: res.statusCode, headers: res.headers, body: data, data: parsed });
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

function cookiesOf(res) {
  const raw = res.headers['set-cookie'] || [];
  return raw.map((c) => c.split(';')[0]);
}

(async () => {
  console.log('===============================================================');
  console.log('  SECURITY REGRESSION SUITE (current NextAuth design)');
  console.log('===============================================================');

  // ---------- 1. unauthenticated access ----------
  console.log('\n--- 1. unauthenticated access ---');
  let r = await req('GET', '/');
  assert('GET / redirects to /login?error=auth_required (307)',
    r.status === 307 && String(r.headers.location || '').includes('/login?error=auth_required'),
    `status=${r.status} location=${r.headers.location}`);

  r = await req('GET', '/admin');
  assert('GET /admin redirects to /admin/login?error=session_required (307)',
    r.status === 307 && String(r.headers.location || '').includes('/admin/login?error=session_required'),
    `status=${r.status} location=${r.headers.location}`);

  r = await req('GET', '/api/calendar/latest');
  assert('GET /api/calendar/latest is not readable unauthenticated',
    r.status === 307 || r.status === 401,
    `status=${r.status}`);

  r = await req('POST', '/api/scheduler/run');
  assert('POST /api/scheduler/run refuses anonymous callers (401)',
    r.status === 401, `status=${r.status} body=${String(r.body).slice(0, 90)}`);

  // ---------- 2. the removed backdoors ----------
  console.log('\n--- 2. the removed authentication backdoors stay removed ---');
  // These paths now fall through to NextAuth's catch-all (/api/auth/[...nextauth]), which
  // rejects them without issuing a session. The property under test is therefore
  // "no session and no admin identity", not a specific status code.
  const noSessionGranted = (res) => {
    const setCookies = res.headers['set-cookie'] || [];
    const gotSession = setCookies.some((c) => /session-token/i.test(c));
    const claimsAdmin = /SUPER_ADMIN/.test(String(res.body));
    return !gotSession && !claimsAdmin && res.status !== 200;
  };

  r = await req('POST', '/api/auth/admin/login', { json: { email: 'admin@antigravity.local', secretKey: 'admin123' } });
  assert('POST /api/auth/admin/login grants no session (shared password is dead)',
    noSessionGranted(r), `status=${r.status} set-cookie=${(r.headers['set-cookie'] || []).join('|')}`);

  r = await req('POST', '/api/auth/admin/login', { json: { isDemoAdmin: true } });
  assert('POST /api/auth/admin/login with isDemoAdmin grants no session',
    noSessionGranted(r), `status=${r.status} set-cookie=${(r.headers['set-cookie'] || []).join('|')}`);

  r = await req('POST', '/api/auth/creator/login', { json: { email: 'attacker@example.com', name: 'X' } });
  assert('POST /api/auth/creator/login grants no session (email alone is not a credential)',
    noSessionGranted(r), `status=${r.status} set-cookie=${(r.headers['set-cookie'] || []).join('|')}`);

  // ---------- 3. the unsigned cookie is no longer trusted ----------
  console.log('\n--- 3. unsigned cookie is not trusted ---');
  const forged = 'social_engine_session=' + encodeURIComponent(JSON.stringify({ role: 'SUPER_ADMIN', isAuthenticated: true }));
  r = await req('GET', '/admin', { cookie: forged });
  assert('forged social_engine_session cookie does NOT grant /admin',
    r.status !== 200, `status=${r.status}`);

  r = await req('GET', '/api/creators', { cookie: forged });
  assert('forged social_engine_session cookie does NOT grant /api/creators',
    r.status !== 200, `status=${r.status}`);

  // ---------- 4. a real creator session ----------
  console.log('\n--- 4. real creator session (NextAuth credentials) ---');
  const csrf = await req('GET', '/api/auth/csrf');
  const csrfCookie = cookiesOf(csrf)[0];
  const token = csrf.data && csrf.data.csrfToken;
  assert('CSRF token is issued', !!token, `data=${String(csrf.body).slice(0, 90)}`);

  const signin = await req('POST', '/api/auth/callback/creator-credentials', {
    cookie: csrfCookie,
    form: {
      csrfToken: token,
      email: 'security.suite@startupgrowth.com',
      name: 'Security Suite',
      isDemo: 'false',
      callbackUrl: `http://${HOST}:${PORT}/`,
    },
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });
  const setCookies = signin.headers['set-cookie'] || [];
  const sessionCookie = setCookies.map((c) => c.split(';')[0]).find((c) => c.includes('session-token'));
  assert('sign-in issues a session token', !!sessionCookie, `status=${signin.status} cookies=${setCookies.length}`);

  const sessionSetCookie = setCookies.find((c) => c.includes('session-token')) || '';
  assert('session cookie is HttpOnly', /HttpOnly/i.test(sessionSetCookie), sessionSetCookie);
  assert('session cookie is SameSite=Lax', /SameSite=Lax/i.test(sessionSetCookie), sessionSetCookie);
  assert('no unsigned social_engine_session cookie is issued',
    !setCookies.some((c) => c.includes('social_engine_session')),
    setCookies.join(' | '));

  const jar = [csrfCookie, sessionCookie].filter(Boolean).join('; ');

  r = await req('GET', '/', { cookie: jar });
  assert('signed-in creator can load the studio (200)', r.status === 200, `status=${r.status}`);

  r = await req('GET', '/api/calendar/latest', { cookie: jar });
  assert('signed-in creator can read their own calendar (200)', r.status === 200, `status=${r.status}`);

  r = await req('GET', '/admin', { cookie: jar });
  assert('creator is refused /admin (307 unauthorized_admin_only)',
    r.status === 307 && String(r.headers.location || '').includes('unauthorized_admin_only'),
    `status=${r.status} location=${r.headers.location}`);

  r = await req('GET', '/api/creators', { cookie: jar });
  assert('creator is refused /api/creators (403)', r.status === 403, `status=${r.status}`);

  // ---------- 5. self-authenticating endpoints ----------
  console.log('\n--- 5. media and scheduler authenticate themselves ---');
  r = await req('GET', '/api/media/generated/whatever/nope.png');
  assert('media route refuses anonymous reads (401)', r.status === 401, `status=${r.status}`);

  r = await req('GET', '/api/media/../../../.env', { cookie: jar });
  assert('media route blocks path traversal', r.status === 400 || r.status === 404, `status=${r.status}`);

  r = await req('GET', '/api/media/%2e%2e%2f%2e%2e%2f.env', { cookie: jar });
  assert('media route blocks encoded path traversal', r.status === 400 || r.status === 404, `status=${r.status}`);

  r = await req('POST', '/api/scheduler/run', { cookie: jar });
  assert('scheduler refuses a non-admin session (401)', r.status === 401, `status=${r.status}`);

  // ---------- 6. onboarding self-service route ----------
  console.log('\n--- 6. onboarding is scoped to the caller ---');
  r = await req('GET', '/api/onboarding', { cookie: jar });
  assert('GET /api/onboarding returns this user\'s own profile (200)', r.status === 200, `status=${r.status}`);

  r = await req('GET', '/api/onboarding');
  assert('GET /api/onboarding is not readable anonymously',
    r.status === 307 || r.status === 401, `status=${r.status}`);

  console.log('\n===============================================================');
  console.log(`  RESULT: ${passed} passed, ${failed} failed`);
  if (failed) console.log('  failed: ' + failures.join(' | '));
  console.log('===============================================================');
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error('suite crashed:', e.message);
  process.exit(1);
});
