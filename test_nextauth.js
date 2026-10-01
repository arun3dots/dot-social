const http = require('http');

function request(options, data, headers = {}) {
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: 'localhost',
      port: 3000,
      ...options,
      headers: {
        ...(options.headers || {}),
        ...headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(body);
        } catch (e) {
          json = body;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: json,
        });
      });
    });
    req.on('error', reject);
    if (data) {
      if (typeof data === 'string') {
        req.write(data);
      } else {
        req.write(JSON.stringify(data));
      }
    }
    req.end();
  });
}

async function runNextAuthTests() {
  console.log('====================================================');
  console.log('   NEXTAUTH END-TO-END VALIDATION SUITE             ');
  console.log('====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(title, condition, detail = '') {
    if (condition) {
      console.log(`[PASS] ${title}`);
      passed++;
    } else {
      console.error(`[FAIL] ${title} -> ${detail}`);
      failed++;
    }
  }

  // 1. Check NextAuth Providers
  console.log('--- TEST GROUP 1: NEXTAUTH ENDPOINTS & PROVIDERS ---');
  let csrfToken = null;
  let csrfCookie = null;
  try {
    const res = await request({ path: '/api/auth/providers', method: 'GET' });
    assert(
      'Case 1.1: NextAuth /api/auth/providers responds HTTP 200',
      res.statusCode === 200,
      `Status: ${res.statusCode}`
    );
    assert(
      'Case 1.2: Providers include admin-credentials and creator-credentials',
      res.data['admin-credentials'] && res.data['creator-credentials'],
      `Providers: ${Object.keys(res.data || {}).join(', ')}`
    );
  } catch (e) {
    assert('Case 1.1/1.2 failed with exception', false, e.message);
  }

  // 2. Fetch CSRF token for NextAuth form POSTs
  try {
    const res = await request({ path: '/api/auth/csrf', method: 'GET' });
    csrfToken = res.data?.csrfToken;
    const cookies = res.headers['set-cookie'] || [];
    csrfCookie = cookies.map(c => c.split(';')[0]).join('; ');
    assert(
      'Case 1.3: NextAuth /api/auth/csrf returns valid csrfToken',
      res.statusCode === 200 && !!csrfToken,
      `CSRF: ${csrfToken}`
    );
  } catch (e) {
    assert('Case 1.3 failed with exception', false, e.message);
  }

  // 3. NextAuth Super Admin Sign-In: Wrong Credentials
  console.log('\n--- TEST GROUP 2: NEXTAUTH SUPER ADMIN (WRONG CREDENTIALS) ---');
  try {
    const postBody = new URLSearchParams({
      email: 'admin@antigravity.local',
      secretKey: 'wrongpassword999',
      isDemo: 'false',
      csrfToken: csrfToken || '',
      json: 'true',
    }).toString();

    const res = await request(
      {
        path: '/api/auth/callback/admin-credentials',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: csrfCookie || '',
        },
      },
      postBody
    );

    // NextAuth returns redirect to error url or 401 in json mode
    const location = res.headers.location || '';
    const hasError = (res.data && res.data.url && res.data.url.includes('error=')) || location.includes('error=') || res.statusCode === 401;
    assert(
      'Case 2.1: Super Admin wrong secretKey rejected by NextAuth',
      hasError,
      `Status: ${res.statusCode}, Location: ${location}, Data: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    assert('Case 2.1 failed with exception', false, e.message);
  }

  // 4. NextAuth Super Admin Sign-In: Actual Credentials
  console.log('\n--- TEST GROUP 3: NEXTAUTH SUPER ADMIN (ACTUAL CREDENTIALS) ---');
  let adminSessionCookie = null;
  try {
    const adminSecret = process.env.SUPER_ADMIN_SECRET_KEY || '';
    const postBody = new URLSearchParams({
      email: 'admin@antigravity.local',
      secretKey: adminSecret,
      isDemo: adminSecret ? 'false' : 'true',
      csrfToken: csrfToken || '',
      json: 'true',
    }).toString();

    const res = await request(
      {
        path: '/api/auth/callback/admin-credentials',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: csrfCookie || '',
        },
      },
      postBody
    );

    const cookies = res.headers['set-cookie'] || [];
    const sessionTokenCookie = cookies.find(c => c.includes('next-auth.session-token'));
    if (sessionTokenCookie) {
      adminSessionCookie = sessionTokenCookie.split(';')[0];
    }

    assert(
      'Case 3.1: Super Admin actual credentials succeed and NextAuth session-token issued',
      !!adminSessionCookie,
      `Status: ${res.statusCode}, Cookies: ${JSON.stringify(cookies)}`
    );
  } catch (e) {
    assert('Case 3.1 failed with exception', false, e.message);
  }

  // 5. Query /api/auth/session with Admin Session Cookie
  try {
    const res = await request({
      path: '/api/auth/session',
      method: 'GET',
      headers: { Cookie: adminSessionCookie },
    });
    assert(
      'Case 3.2: NextAuth /api/auth/session confirms SUPER_ADMIN role',
      res.statusCode === 200 && res.data?.user?.role === 'SUPER_ADMIN',
      `Session: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    assert('Case 3.2 failed with exception', false, e.message);
  }

  // 6. Access /admin with NextAuth Admin Cookie
  try {
    const res = await request({
      path: '/admin',
      method: 'GET',
      headers: { Cookie: adminSessionCookie },
    });
    assert(
      'Case 3.3: Super Admin accesses /admin route with NextAuth session (HTTP 200)',
      res.statusCode === 200,
      `Status: ${res.statusCode}`
    );
  } catch (e) {
    assert('Case 3.3 failed with exception', false, e.message);
  }

  // 7. NextAuth Creator Sign-In: Wrong / Malformed Credentials
  console.log('\n--- TEST GROUP 4: NEXTAUTH CREATOR (WRONG CREDENTIALS) ---');
  try {
    const postBody = new URLSearchParams({
      email: 'not-an-email',
      name: 'Bad User',
      isDemo: 'false',
      csrfToken: csrfToken || '',
      json: 'true',
    }).toString();

    const res = await request(
      {
        path: '/api/auth/callback/creator-credentials',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: csrfCookie || '',
        },
      },
      postBody
    );

    const location = res.headers.location || '';
    const hasError = (res.data && res.data.url && res.data.url.includes('error=')) || location.includes('error=') || res.statusCode === 401;
    assert(
      'Case 4.1: Creator malformed email rejected by NextAuth',
      hasError,
      `Status: ${res.statusCode}, Location: ${location}, Data: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    assert('Case 4.1 failed with exception', false, e.message);
  }

  // 8. NextAuth Creator Sign-In: Actual Credentials
  console.log('\n--- TEST GROUP 5: NEXTAUTH CREATOR (ACTUAL CREDENTIALS) ---');
  let creatorSessionCookie = null;
  try {
    const postBody = new URLSearchParams({
      email: 'alex.creator@startupgrowth.com',
      name: 'Alex Rivera',
      isDemo: 'false',
      csrfToken: csrfToken || '',
      json: 'true',
    }).toString();

    const res = await request(
      {
        path: '/api/auth/callback/creator-credentials',
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: csrfCookie || '',
        },
      },
      postBody
    );

    const cookies = res.headers['set-cookie'] || [];
    const sessionTokenCookie = cookies.find(c => c.includes('next-auth.session-token'));
    if (sessionTokenCookie) {
      creatorSessionCookie = sessionTokenCookie.split(';')[0];
    }

    assert(
      'Case 5.1: Creator actual credentials succeed and NextAuth session-token issued',
      !!creatorSessionCookie,
      `Status: ${res.statusCode}, Cookies: ${JSON.stringify(cookies)}`
    );
  } catch (e) {
    assert('Case 5.1 failed with exception', false, e.message);
  }

  // 9. Query /api/auth/session with Creator Session Cookie
  try {
    const res = await request({
      path: '/api/auth/session',
      method: 'GET',
      headers: { Cookie: creatorSessionCookie },
    });
    assert(
      'Case 5.2: NextAuth /api/auth/session confirms CREATOR role',
      res.statusCode === 200 && res.data?.user?.role === 'CREATOR' && res.data?.user?.email === 'alex.creator@startupgrowth.com',
      `Session: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    assert('Case 5.2 failed with exception', false, e.message);
  }

  // 10. Access / with Creator NextAuth Cookie
  try {
    const res = await request({
      path: '/',
      method: 'GET',
      headers: { Cookie: creatorSessionCookie },
    });
    assert(
      'Case 5.3: Authenticated creator accesses Creator Studio / via NextAuth (HTTP 200)',
      res.statusCode === 200,
      `Status: ${res.statusCode}`
    );
  } catch (e) {
    assert('Case 5.3 failed with exception', false, e.message);
  }

  // 11. Privilege Escalation Guard with NextAuth Creator Cookie
  console.log('\n--- TEST GROUP 6: NEXTAUTH RBAC PRIVILEGE BOUNDARY ---');
  try {
    const res = await request({
      path: '/admin',
      method: 'GET',
      headers: { Cookie: creatorSessionCookie },
    });
    const location = res.headers.location || '';
    assert(
      'Case 6.1: Creator with NextAuth session blocked from /admin and redirected with error',
      res.statusCode === 307 && location.includes('unauthorized_admin_only'),
      `Status: ${res.statusCode}, Location: ${location}`
    );
  } catch (e) {
    assert('Case 6.1 failed with exception', false, e.message);
  }

  try {
    const res = await request({
      path: '/api/creators',
      method: 'GET',
      headers: { Cookie: creatorSessionCookie },
    });
    assert(
      'Case 6.2: Creator with NextAuth session calling /api/creators receives HTTP 403 Forbidden',
      res.statusCode === 403,
      `Status: ${res.statusCode}, Response: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    assert('Case 6.2 failed with exception', false, e.message);
  }

  console.log('\n====================================================');
  console.log(`NEXTAUTH TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
}

runNextAuthTests();
