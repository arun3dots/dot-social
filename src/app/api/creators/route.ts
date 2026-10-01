import { NextResponse } from 'next/server';
import { getDbUsers } from '@/lib/postgres';

export async function GET() {
  try {
    const users = await getDbUsers();
    return NextResponse.json({ users, creators: users });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
