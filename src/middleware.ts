import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. Whitelist static files and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/static') ||
    pathname.startsWith('/mock-assets') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. Whitelist public auth endpoints and login pages
  const isPublicRoute =
    pathname === '/login' ||
    pathname === '/admin/login' ||
    pathname.startsWith('/api/auth');

  // Endpoints that do their own authentication instead of relying on the session cookie:
  //  - /api/scheduler/* : requires SCHEDULER_SECRET (headless cron) or an ADMIN session
  //  - /api/media/*     : requires a signed-in user; it also serves <img> fetches, which
  //                       must not be redirected to an HTML login page
  const selfAuthenticating =
    pathname.startsWith('/api/scheduler') || pathname.startsWith('/api/media');

  // Read NextAuth token
  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Authorization is derived ONLY from the signed NextAuth JWT.
  // The previous version also trusted an unsigned, client-writable cookie
  // (social_engine_session) and read `role` out of it — so anyone could set
  // {"role":"SUPER_ADMIN"} by hand and be treated as an administrator.
  const role = token?.role as string | undefined;
  const isAuthenticated = !!token;

  // 3. Super Admin routes (/admin, /admin/*)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    if (!isAuthenticated) {
      return NextResponse.redirect(new URL('/admin/login?error=session_required', req.url));
    }
    if (role !== 'SUPER_ADMIN') {
      // Strictly forbidden for creators!
      return NextResponse.redirect(new URL('/admin/login?error=unauthorized_admin_only', req.url));
    }
    return NextResponse.next();
  }

  // 4. Protect Super Admin API endpoints
  if (pathname === '/api/creators') {
    if (!isAuthenticated || role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Super Admin access required' }, { status: 403 });
    }
    return NextResponse.next();
  }

  // 5. Protect Creator application routes (/, /api/calendar/*, /api/subscriptions)
  if (!isPublicRoute && !selfAuthenticating) {
    if (!isAuthenticated) {
      // Unauthenticated -> redirect to creator login
      return NextResponse.redirect(new URL('/login?error=auth_required', req.url));
    }
  }

  // 6. If authenticated and visiting login pages, redirect to respective home
  if (isAuthenticated) {
    if (pathname === '/login' && role === 'CREATOR') {
      return NextResponse.redirect(new URL('/', req.url));
    }
    if (pathname === '/admin/login' && role === 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/admin', req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
