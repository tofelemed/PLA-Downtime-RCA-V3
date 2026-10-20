// Write-path timings on the PERF CLONE ONLY (127.0.0.1:4014 → proact-perf-postgres): never point this at
// the dev or plant API. Toggles a notification read/unread and edits an event description (If-Match with
// the current ETag), RUNS times each; requests are tagged `write|<name>|<n>` for instrument.cjs.
//   PERF_PASSWORD=… node perf-audit/writes.mjs [--runs 20]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.env.PERF_BASE || 'http://127.0.0.1:4014';
if (!/:(4014)$/.test(BASE)) throw new Error('writes.mjs only runs against the perf API on :4014');
const RUNS = Number(process.argv[process.argv.indexOf('--runs') + 1] || 20);
const psql = (sql) => execFileSync('docker', ['exec', 'proact-perf-postgres', 'psql', '-U', 'postgres', '-d', 'proact', '-X', '-At', '-c', sql],
  { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim();
const T = psql('SELECT id FROM tenants ORDER BY created_at LIMIT 1');
const [email, notification] = psql(`SELECT u.email || '|' || n.id FROM user_notifications n JOIN users u ON u.id = n.user_id
  WHERE u.role = 'Engineer' AND n.tenant_id = '${T}' LIMIT 1`).split('|');
const event = psql(`SELECT id FROM production_events WHERE tenant_id='${T}' AND physical_state='closed' ORDER BY start_time DESC LIMIT 1`);
const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: process.env.PERF_PASSWORD }) }).then((r) => r.json());
const headers = { Authorization: `Bearer ${login.access_token}`, 'X-Tenant-Id': T, 'Content-Type': 'application/json' };

const out = fs.createWriteStream('perf-audit/out/writes.jsonl', { flags: 'a' });
const time = async (name, n, url, init) => {
  const t = performance.now();
  const res = await fetch(BASE + url, { ...init, headers: { ...headers, ...(init.headers || {}), 'x-perf-tag': `write|${name}|${n}` } });
  await res.arrayBuffer();
  const rec = { name, n, status: res.status, ms: +(performance.now() - t).toFixed(1) };
  out.write(JSON.stringify(rec) + '\n');
  return rec;
};
const results = { 'notification-read': [], 'event-patch': [] };
for (let n = 0; n < RUNS; n += 1) {
  results['notification-read'].push(await time('notification-read', n, `/api/v2/notifications/${notification}/${n % 2 ? 'unread' : 'read'}`, { method: 'POST' }));
  const current = await fetch(`${BASE}/api/v2/production-events/${event}`, { headers });
  const etag = current.headers.get('etag');
  await current.arrayBuffer();
  results['event-patch'].push(await time('event-patch', n, `/api/v2/production-events/${event}`,
    { method: 'PATCH', headers: { 'If-Match': etag }, body: JSON.stringify({ description: `perf audit edit ${n}`, changeReason: 'perf audit' }) }));
}
for (const [name, recs] of Object.entries(results)) {
  const ms = recs.map((r) => r.ms).sort((a, b) => a - b);
  const statuses = recs.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  console.log(`${name}: p50=${ms[ms.length >> 1]} p95=${ms[Math.ceil(ms.length * 0.95) - 1]} max=${ms[ms.length - 1]} ${JSON.stringify(statuses)}`);
}
out.end();
