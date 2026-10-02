import { getServerSession } from 'next-auth';
import { authOptions, stableUserId } from './auth';
import pool from './postgres';

/**
 * The current user's stable id.
 *
 * The DB decides who you are, not the JWT: `session.user.id` is frozen at sign-in and can dangle
 * (e.g. after an id-scheme migration), which made social_connections INSERTs violate the users.id
 * foreign key. So when the session carries an email, resolve the canonical id from the users table
 * by that email — inserting the row on first sight — and only fall back to the JWT id when there is
 * no email. Never derive identity from a client-supplied value (cookie/body/query).
 */
export async function currentUserId(): Promise<string | null> {
  let sessionId: string | undefined;
  let email: string | undefined;
  try {
    const session = await getServerSession(authOptions);
    const u = (session?.user as { id?: string; email?: string } | undefined) ?? {};
    sessionId = u.id;
    email = u.email?.trim().toLowerCase();
  } catch {
    return null;
  }

  if (!email && !sessionId) return null;
  if (!email) return sessionId || null;

  try {
    const found = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    if (found.rows.length > 0) return found.rows[0].id;

    // First sight of this email: create the row keyed by the deterministic id, never the JWT's
    // (possibly provider-specific) id.
    const id = stableUserId(email);
    await pool.query(
      `INSERT INTO users (id, email, name, role)
       VALUES ($1, $2, $3, 'CREATOR')
       ON CONFLICT (email) DO NOTHING`,
      [id, email, email.split('@')[0]]
    );
    const again = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
    return again.rows[0]?.id || id;
  } catch {
    // DB hiccup: fall back to the JWT id rather than logging the user out.
    return sessionId || null;
  }
}
