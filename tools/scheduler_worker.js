#!/usr/bin/env node
/**
 * Scheduler tick for the social_engine pipeline.
 *
 * Calls POST /api/scheduler/run, which finds posts whose scheduled time has arrived and
 * attempts to publish them. Register this with Windows Task Scheduler (every 5 minutes)
 * or run it with --loop as a long-lived worker.
 *
 *   node tools/scheduler_worker.js --once     one tick (for Task Scheduler)
 *   node tools/scheduler_worker.js --loop     poll forever
 *
 * Auth: SCHEDULER_SECRET must match the server's SCHEDULER_SECRET, otherwise the
 * endpoint requires an admin session and a headless tick will get 401.
 */
const ENDPOINT = process.env.SCHEDULER_URL || 'http://localhost:3000/api/scheduler/run';
const SECRET = (process.env.SCHEDULER_SECRET || '').trim();
const INTERVAL_S = parseInt(process.env.SCHEDULER_INTERVAL_S || '60', 10);
const LOOP = process.argv.includes('--loop');

async function tick() {
  const headers = {};
  if (SECRET) headers['x-scheduler-secret'] = SECRET;
  try {
    const res = await fetch(ENDPOINT, { method: 'POST', headers });
    const text = await res.text();
    let data = {};
    try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 200) }; }

    if (res.status === 401) {
      console.error(`[${new Date().toISOString()}] 401 ${data.error || ''} (${data.reason || ''})`);
      return data;
    }
    console.log(`[${new Date().toISOString()}] HTTP ${res.status} due=${data.due ?? '-'} published=${data.published ?? '-'} failed=${data.failed ?? '-'} skipped=${data.skipped ?? '-'}`);
    for (const r of (data.results || [])) {
      console.log(`   ${String(r.platform).padEnd(10)} ${r.postId} -> ${r.outcome} :: ${r.reason}`);
    }
    return data;
  } catch (e) {
    console.error(`[${new Date().toISOString()}] tick failed: ${e.message}`);
    return null;
  }
}

(async () => {
  if (!LOOP) { await tick(); return; }
  console.log(`scheduler worker: POST ${ENDPOINT} every ${INTERVAL_S}s${SECRET ? '' : ' (no SCHEDULER_SECRET set)'}`);
  for (;;) { await tick(); await new Promise((r) => setTimeout(r, INTERVAL_S * 1000)); }
})();
