import pool, { initPostgresTables } from '@/lib/postgres';

/**
 * Convert a local wall-clock time (dateStr + hour/minute) in an IANA timezone to a UTC ISO
 * timestamp. Two-pass offset resolution handles DST correctly (the offset at the target
 * instant is the one used).
 */
export function localWallTimeToUtc(dateStr: string, hour: number, minute: number, tz: string): string {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  if (!y || !m || !d || !Number.isFinite(hour)) {
    return new Date(`${dateStr}T00:00:00Z`).toISOString();
  }
  const zone = tz && tz !== 'UTC' ? tz : 'UTC';
  let utcMs = Date.UTC(y, m - 1, d, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = dtf.formatToParts(new Date(utcMs));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    let hh = get('hour');
    if (hh === 24) hh = 0; // midnight renders as "24" with hour12:false
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hh, get('minute'), get('second'));
    const offsetMs = asUtc - utcMs;
    const target = Date.UTC(y, m - 1, d, hour, minute, 0) - offsetMs;
    if (target === utcMs) break;
    utcMs = target;
  }
  return new Date(utcMs).toISOString();
}

/** The deployment's default timezone, from DEFAULT_TIMEZONE (falls back to UTC). */
export function defaultTimezone(): string {
  const tz = (process.env.DEFAULT_TIMEZONE || '').trim();
  if (!tz) return 'UTC';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch {
    return 'UTC'; // an invalid IANA name silently degrades to UTC, never crashes a request
  }
}

/** The user's timezone: their saved value, else the deployment default, else UTC. */
export async function userTimezone(userId: string): Promise<string> {
  const fallback = defaultTimezone();
  try {
    await initPostgresTables();
    const r = await pool.query('SELECT timezone FROM users WHERE id = $1', [userId]);
    return String(r.rows[0]?.timezone || '').trim() || fallback;
  } catch {
    return fallback;
  }
}

/** A short human label for a timezone, e.g. "GMT+5:30" (or "IST" on some hosts). */
export function timezoneLabel(tz: string): string {
  try {
    const part = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' })
      .formatToParts(new Date())
      .find((p) => p.type === 'timeZoneName');
    return part?.value || tz;
  } catch {
    return tz;
  }
}
