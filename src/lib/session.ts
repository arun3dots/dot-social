import { getServerSession } from 'next-auth';
import { authOptions } from './auth';

/**
 * The current user's stable id, read from the SIGNED NextAuth session.
 * Never derive identity from a client-supplied value (cookie/body/query).
 */
export async function currentUserId(): Promise<string | null> {
  try {
    const session = await getServerSession(authOptions);
    const id = (session?.user as { id?: string } | undefined)?.id;
    return id || null;
  } catch {
    return null;
  }
}
