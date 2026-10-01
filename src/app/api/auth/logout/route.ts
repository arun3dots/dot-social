import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const target = searchParams.get('to') || 'creator';
  const redirectUrl = target === 'admin' ? '/admin/login' : '/login';

  const res = NextResponse.json({
    success: true,
    redirectTo: redirectUrl,
  });

  res.cookies.set('social_engine_session', '', {
    httpOnly: false,
    maxAge: 0,
    path: '/',
  });

  res.cookies.set('next-auth.session-token', '', {
    maxAge: 0,
    path: '/',
  });

  res.cookies.set('__Secure-next-auth.session-token', '', {
    maxAge: 0,
    path: '/',
  });

  return res;
}
