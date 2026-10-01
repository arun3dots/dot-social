import { NextRequest, NextResponse } from 'next/server';
import { urnFromProfileInput } from '@/lib/linkedin';
import { currentUserId } from '@/lib/session';

/**
 * Turn what a user has about a person into the URN LinkedIn needs for a mention.
 *
 * LinkedIn has no public API to look a member up (its People Search is partner-only), so a
 * vanity profile URL like linkedin.com/in/name carries no id we can resolve. This accepts a
 * profile URL that contains the member id, a raw id, or a full urn:li:person:... and says so
 * plainly when it cannot.
 */
export async function POST(req: NextRequest) {
  const userId = await currentUserId();
  if (!userId) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const input = String(body.input || '').trim();
  const name = String(body.name || '').trim();

  if (!input) return NextResponse.json({ error: 'paste a profile URL, a member id, or a urn:li:person:...' }, { status: 400 });

  const urn = urnFromProfileInput(input);
  if (!urn) {
    return NextResponse.json(
      {
        error:
          'that link has no member id in it - LinkedIn does not publish one for a vanity URL (/in/name), and its ' +
          'People Search API is partner-only, so the id has to come from somewhere that shows it',
        hint: 'open the profile and copy the URL that contains the numeric id (…/in/name-123456789 or ?id=123456789), or paste its urn:li:person:… directly',
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    success: true,
    urn,
    name: name || null,
    note: 'LinkedIn only renders a mention when the author is connected to that member',
  });
}
