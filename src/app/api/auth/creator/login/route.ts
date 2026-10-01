import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, name, provider = 'google', isDemo } = body;

    // Validate email if not demo
    if (!isDemo) {
      if (!email || typeof email !== 'string' || !email.includes('@') || !email.includes('.')) {
        return NextResponse.json(
          { error: 'Invalid creator email address. Please provide a valid email (e.g., creator@techstart.io).' },
          { status: 400 }
        );
      }
    }

    const creatorUser = {
      id: `usr_creator_${Date.now()}`,
      email: isDemo ? 'jane@creatorstudio.dev' : email.trim().toLowerCase(),
      name: name || (isDemo ? 'Jane Creator' : email.split('@')[0]),
      role: 'CREATOR',
      avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100',
      provider,
      loginAt: new Date().toISOString(),
    };

    const res = NextResponse.json({
      success: true,
      user: creatorUser,
      redirectTo: '/',
    });

    res.cookies.set('social_engine_session', JSON.stringify(creatorUser), {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return res;
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
