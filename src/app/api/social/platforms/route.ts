import { NextResponse } from 'next/server';
import { isConfigured } from '@/lib/oauth';
import { currentUserId } from '@/lib/session';

/**
 * Honest connect-state for the studio: whether each platform's app credentials exist.
 * Returns booleans and the names of the missing variables - never a secret value.
 */
export async function GET() {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const need: Record<string, string> = {
    LINKEDIN: 'LINKEDIN_CLIENT_ID / LINKEDIN_CLIENT_SECRET',
    TWITTER: 'TWITTER_CLIENT_ID / TWITTER_CLIENT_SECRET',
    INSTAGRAM: 'INSTAGRAM_APP_ID / INSTAGRAM_APP_SECRET',
  };

  const platforms = Object.keys(need).map((platform) => ({
    platform,
    configured: isConfigured(platform),
    requiredEnv: need[platform],
  }));

  return NextResponse.json({ platforms });
}
