const http = require('http');

function request(options, data) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
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
      req.write(JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('====================================================');
  console.log('   FULL END-TO-END AUTHENTICATION TEST SUITE        ');
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

  // TEST 1: Admin Login with WRONG Credentials (Case 1.1: Wrong Email + Wrong Password)
  console.log('--- TEST GROUP 1: SUPER ADMIN AUTHENTICATION (WRONG CREDENTIALS) ---');
  try {
    const res = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/admin/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: 'imposter@hacker.io', secretKey: 'badpass123' }
    );
    assert(
      'Case 1.1: Reject completely fake credentials with 401',
      res.statusCode === 401 && res.data.error,
      `Status: ${res.statusCode}, Error: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    assert('Case 1.1 failed with exception', false, e.message);
  }

  // TEST 1.2: Correct Email + WRONG Password
  try {
    const res = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/admin/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: 'admin@antigravity.local', secretKey: 'invalid_secret_key' }
    );
    assert(
      'Case 1.2: Reject correct admin email with wrong secretKey with 401',
      res.statusCode === 401,
      `Status: ${res.statusCode}, Data: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    assert('Case 1.2 failed with exception', false, e.message);
  }

  // TEST 1.3: Wrong Email + Correct Password
  try {
    const res = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/admin/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: 'wrong@domain.com', secretKey: 'admin123' }
    );
    assert(
      'Case 1.3: Reject wrong email with correct secretKey with 401',
      res.statusCode === 401,
      `Status: ${res.statusCode}, Data: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    assert('Case 1.3 failed with exception', false, e.message);
  }

  // TEST 2: Admin Login with ACTUAL Credentials
  console.log('\n--- TEST GROUP 2: SUPER ADMIN AUTHENTICATION (ACTUAL CREDENTIALS) ---');
  let adminCookie = null;
  try {
    const res = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/admin/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: 'admin@antigravity.local', secretKey: 'admin123' }
    );
    const setCookie = res.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      adminCookie = setCookie[0].split(';')[0];
    }
    assert(
      'Case 2.1: Login success with actual credentials (HTTP 200 + role=SUPER_ADMIN)',
      res.statusCode === 200 && res.data.user && res.data.user.role === 'SUPER_ADMIN',
      `Status: ${res.statusCode}, User: ${JSON.stringify(res.data.user)}`
    );
    assert(
      'Case 2.2: Session cookie issued for authenticated admin',
      adminCookie && adminCookie.includes('social_engine_session'),
      `Cookie: ${adminCookie}`
    );
    assert(
      'Case 2.3: Redirect path points to /admin',
      res.data.redirectTo === '/admin',
      `Redirect: ${res.data.redirectTo}`
    );
  } catch (e) {
    assert('Case 2 failed with exception', false, e.message);
  }

  // TEST 2.4: Admin access to protected /admin page with session cookie
  try {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin',
      method: 'GET',
      headers: { Cookie: adminCookie },
    });
    assert(
      'Case 2.4: Authenticated admin can access /admin route (HTTP 200)',
      res.statusCode === 200,
      `Status: ${res.statusCode}`
    );
  } catch (e) {
    assert('Case 2.4 failed with exception', false, e.message);
  }

  // TEST 2.5: Admin access to protected /api/creators with session cookie
  try {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/creators',
      method: 'GET',
      headers: { Cookie: adminCookie },
    });
    assert(
      'Case 2.5: Authenticated admin can query /api/creators (HTTP 200)',
      res.statusCode === 200 && Array.isArray(res.data.users || res.data.creators),
      `Status: ${res.statusCode}, Users: ${res.data.users ? res.data.users.length : 'null'}`
    );
  } catch (e) {
    assert('Case 2.5 failed with exception', false, e.message);
  }

  // TEST 3: Creator Login with WRONG / MALFORMED Credentials
  console.log('\n--- TEST GROUP 3: CREATOR AUTHENTICATION (WRONG CREDENTIALS) ---');
  try {
    const res = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/creator/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: '', name: 'Blank User', isDemo: false }
    );
    assert(
      'Case 3.1: Reject empty email with 400 Bad Request',
      res.statusCode === 400 && res.data.error,
      `Status: ${res.statusCode}, Error: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    assert('Case 3.1 failed with exception', false, e.message);
  }

  try {
    const res = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/creator/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      { email: 'invalid-email-format-without-at', name: 'Bad Format', isDemo: false }
    );
    assert(
      'Case 3.2: Reject malformed email without @ or domain with 400 Bad Request',
      res.statusCode === 400 && res.data.error,
      `Status: ${res.statusCode}, Error: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    assert('Case 3.2 failed with exception', false, e.message);
  }

  // TEST 4: Creator Login with ACTUAL Credentials
  console.log('\n--- TEST GROUP 4: CREATOR AUTHENTICATION (ACTUAL CREDENTIALS) ---');
  let creatorCookie = null;
  try {
    const res = await request(
      {
        hostname: 'localhost',
        port: 3000,
        path: '/api/auth/creator/login',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      },
      {
        email: 'alex.creator@startupgrowth.com',
        name: 'Alex Rivera',
        provider: 'google',
        isDemo: false,
      }
    );
    const setCookie = res.headers['set-cookie'];
    if (setCookie && setCookie.length > 0) {
      creatorCookie = setCookie[0].split(';')[0];
    }
    assert(
      'Case 4.1: Creator login success with actual credentials (HTTP 200 + role=CREATOR)',
      res.statusCode === 200 && res.data.user && res.data.user.role === 'CREATOR' && res.data.user.email === 'alex.creator@startupgrowth.com',
      `Status: ${res.statusCode}, User: ${JSON.stringify(res.data.user)}`
    );
    assert(
      'Case 4.2: Session cookie issued for authenticated creator',
      creatorCookie && creatorCookie.includes('social_engine_session'),
      `Cookie: ${creatorCookie}`
    );
  } catch (e) {
    assert('Case 4 failed with exception', false, e.message);
  }

  // TEST 4.3: Creator access to protected / creator studio
  try {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET',
      headers: { Cookie: creatorCookie },
    });
    assert(
      'Case 4.3: Authenticated creator can access Creator Studio / (HTTP 200)',
      res.statusCode === 200,
      `Status: ${res.statusCode}`
    );
  } catch (e) {
    assert('Case 4.3 failed with exception', false, e.message);
  }

  // TEST 4.4: RBAC Guard - Creator FORBIDDEN from accessing /admin
  try {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin',
      method: 'GET',
      headers: { Cookie: creatorCookie },
    });
    const location = res.headers.location || '';
    assert(
      'Case 4.4: Creator attempting to access /admin is blocked and redirected to /admin/login?error=unauthorized_admin_only',
      res.statusCode === 307 && location.includes('unauthorized_admin_only'),
      `Status: ${res.statusCode}, Location: ${location}`
    );
  } catch (e) {
    assert('Case 4.4 failed with exception', false, e.message);
  }

  // TEST 4.5: RBAC Guard - Creator FORBIDDEN from calling /api/creators
  try {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/creators',
      method: 'GET',
      headers: { Cookie: creatorCookie },
    });
    assert(
      'Case 4.5: Creator calling Super Admin API /api/creators receives HTTP 403 Forbidden',
      res.statusCode === 403,
      `Status: ${res.statusCode}, Response: ${JSON.stringify(res.data)}`
    );
  } catch (e) {
    assert('Case 4.5 failed with exception', false, e.message);
  }

  // TEST 5: Unauthenticated access protection
  console.log('\n--- TEST GROUP 5: UNAUTHENTICATED ROUTE PROTECTION ---');
  try {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/',
      method: 'GET',
    });
    const location = res.headers.location || '';
    assert(
      'Case 5.1: Unauthenticated request to / redirects to /login?error=auth_required (HTTP 307)',
      res.statusCode === 307 && location.includes('/login?error=auth_required'),
      `Status: ${res.statusCode}, Location: ${location}`
    );
  } catch (e) {
    assert('Case 5.1 failed with exception', false, e.message);
  }

  try {
    const res = await request({
      hostname: 'localhost',
      port: 3000,
      path: '/admin',
      method: 'GET',
    });
    const location = res.headers.location || '';
    assert(
      'Case 5.2: Unauthenticated request to /admin redirects to /admin/login?error=session_required (HTTP 307)',
      res.statusCode === 307 && location.includes('/admin/login?error=session_required'),
      `Status: ${res.statusCode}, Location: ${location}`
    );
  } catch (e) {
    assert('Case 5.2 failed with exception', false, e.message);
  }

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================');
}

runTests();
