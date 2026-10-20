// Replays the API calls each screen fires on load (from the frontend call map in PERF_REPORT.md §5):
// a flow is a list of sequential steps, each step a set of parallel GETs. Reports per flow the time until
// the last call returns (data ready), request count, bytes, and (joined from instrument.cjs by tag) DB
// queries. Each flow runs RUNS times; first run = cold-ish (fresh API process), the rest warm. GET only.
//   PERF_PASSWORD=… node perf-audit/flows.mjs [--runs 6] [--role Analyst]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.env.PERF_BASE || 'http://127.0.0.1:4014';
const arg = (n, f) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : f; };
const RUNS = Number(arg('runs', '6'));
const ROLE = arg('role', 'Analyst');
const OUT = arg('out', 'perf-audit/out/flows.jsonl');
const psql = (sql) => execFileSync('docker', ['exec', 'proact-perf-postgres', 'psql', '-U', 'postgres', '-d', 'proact', '-X', '-At', '-c', sql],
  { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim();

const T = psql('SELECT id FROM tenants ORDER BY created_at LIMIT 1');
const UNITS = psql(`SELECT string_agg(id::text, ',') FROM units WHERE tenant_id='${T}'`).split(',');
const UNIT = UNITS[0];
const EVENT = psql(`SELECT id FROM production_events WHERE tenant_id='${T}' ORDER BY start_time DESC LIMIT 1`);
const RCA = psql(`SELECT id FROM rcas WHERE tenant_id='${T}' LIMIT 1`);
const PERIOD = psql('SELECT p.id FROM production_periods p JOIN calculation_runs r ON r.period_id=p.id GROUP BY p.id ORDER BY count(*) DESC LIMIT 1');
const PLAN = psql(`SELECT id FROM plan_versions WHERE tenant_id='${T}' LIMIT 1`) || 'none';
const REV = psql(`SELECT max(revision) FROM accounting_revisions WHERE period_id='${PERIOD}'`) || '1';
const now = new Date(Math.floor(Date.now() / 60000) * 60000);
const from = new Date(now.getTime() - 7 * 86400000).toISOString();
const to = now.toISOString();
const toPlus1h = new Date(now.getTime() + 3600000).toISOString();
const w = `from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
const unitIds = UNITS.map((u) => `unitIds=${u}`).join('&');

const v2 = (p) => `/api/v2${p}`;
const BOOT = [[`/api/auth/profile`], [v2('/organizations?limit=100'), v2(`/tenants/${T}`)],
  [v2('/branding'), v2('/organizations?limit=500'), v2('/tenants?limit=500'), v2('/feature-flags'), v2('/notifications/unread-count'), v2('/sites?limit=100')]];
/** P08: the same shell with its 7 per-page reads replaced by GET /v2/session/bootstrap. */
const BOOT_BATCHED = [[`/api/auth/profile`], [v2('/organizations?limit=100'), v2(`/tenants/${T}`)], [v2('/session/bootstrap')]];
const ONLY = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1].split(',') : null;
const ALL_FLOWS = {
  'app-shell (every page)': BOOT,
  'app-shell batched (P08)': BOOT_BATCHED,
  dashboard: [[v2('/units?limit=500'), v2('/reason-codes?limit=500&includeRetired=true'),
    v2(`/reports/oee?${w}&groupBy=unit&policy=operational`), v2(`/reports/oee?${w}&groupBy=unit&policy=reconciled`),
    v2(`/reports/downtime?${w}&groupBy=reason&metric=frequency`), v2(`/reports/downtime?${w}&groupBy=asset&metric=frequency`),
    v2(`/reports/reconciliation-status?${w}`), v2('/rcas/summary'),
    v2(`/production-events?${w}&sort=-startTime&limit=5&physicalTypes=downtime&physicalTypes=slowdown&physicalTypes=quality_loss&physicalStates=open&physicalStates=closed`),
    v2('/production-events?limit=50&sort=-startTime&isOpen=true&physicalStates=open'),
    v2(`/production-events?${w}&sort=-startTime&physicalTypes=downtime&codingStates=uncoded&physicalStates=open&physicalStates=closed`),
    v2('/reconciliation-queue?limit=20'), v2('/rca-actions?mine=true&overdue=true&sort=dueDate&limit=20'), v2('/approval-inbox?decidable=true&limit=20')]],
  'event-hub': [[v2('/units?limit=500'), v2('/reason-codes?limit=500&includeRetired=true'),
    v2(`/production-events?limit=20&sort=-startTime&physicalStates=open&physicalStates=closed&from=${encodeURIComponent(from)}&to=${encodeURIComponent(toPlus1h)}`),
    v2(`/reports/downtime?${w}`), v2('/production-events?limit=50&sort=-startTime&isOpen=true&physicalStates=open'),
    v2('/assets?limit=500&status=all&sort=name')]],
  'event-detail': [[v2(`/production-events/${EVENT}`), v2(`/production-events/${EVENT}/revisions`), v2('/assets?limit=500&status=all&sort=name'),
    v2('/users/directory?limit=500'), v2('/impact-codes?limit=500')], [v2(`/production-events/${EVENT}/attributed-losses`)]],
  reports: [[v2('/units?limit=500'), v2('/sites?limit=100'), v2('/reason-codes?limit=500&includeRetired=true')],
    [v2(`/reports/oee?${w}&${unitIds}&approvedOnly=true&groupBy=day&policy=operational`), v2(`/reports/downtime?${w}&${unitIds}&approvedOnly=true&groupBy=reason`)]],
  'rca-list': [[v2('/rcas/summary'), v2('/rcas?limit=20'), v2('/rca-recommendations?state=open&trigger=reevaluate&limit=100'),
    v2('/units?limit=500'), v2('/users/directory?limit=500')]],
  'rca-case': [[v2(`/rcas/${RCA}`)], [v2(`/rcas/${RCA}/links`), v2(`/rcas/${RCA}/outcome`), v2(`/rcas/${RCA}/actions`), v2(`/rcas/${RCA}/analyses`),
    v2(`/rcas/${RCA}/readiness`), v2(`/rcas/${RCA}/causes`), v2('/units?limit=500'), v2('/assets?limit=500&status=all&sort=name'), v2('/users/directory?limit=500')]],
  approvals: [[v2('/approval-inbox?limit=20'), v2('/sites?limit=100')]],
  'period-page': [[v2(`/production-plans/${PLAN}`), v2(`/production-periods/${PERIOD}`)], [v2(`/production-periods/${PERIOD}/reconciliation?view=current`)],
    [v2(`/production-periods/${PERIOD}/accounting?revision=${REV}`)],
    [v2(`/period-summaries?unitIds=${UNIT}&${w}&limit=1&sort=-utcStart`), v2(`/reports/waterfall?periodIds=${PERIOD}`),
      v2('/reason-codes?limit=500&includeRetired=true'), v2('/impact-codes?limit=500'), v2('/users/directory?limit=500')]],
  connectivity: [[v2('/connections?includeInactive=false&limit=20'), v2('/sites?limit=100')]],
};
const FLOWS = ONLY ? Object.fromEntries(Object.entries(ALL_FLOWS).filter(([name]) => ONLY.some((o) => name.startsWith(o)))) : ALL_FLOWS;

const email = psql(`SELECT email FROM users WHERE role='${ROLE}' AND email LIKE '%@hdpe-train.mpc' ORDER BY email LIMIT 1`);
const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: process.env.PERF_PASSWORD }) }).then((r) => r.json());
const headers = { Authorization: `Bearer ${login.access_token}`, 'X-Tenant-Id': T, 'Accept-Encoding': 'identity' };

// --browser6: at most 6 requests in flight, like an HTTP/1.1 browser per origin; --batch: every step with
// several reads goes as one POST /api/v2/batch (perf audit P08, generic batch)
const BROWSER6 = process.argv.includes('--browser6');
const BATCH = process.argv.includes('--batch');
// --rtt <ms>: network round trip added to every HTTP request (local runs have ~0)
const RTT = process.argv.includes('--rtt') ? Number(process.argv[process.argv.indexOf('--rtt') + 1]) : 0;
const network = () => (RTT > 0 ? new Promise((resolve) => setTimeout(resolve, RTT)) : Promise.resolve());
let inFlight = 0;
const waiting = [];
async function limited(work) {
  if (BROWSER6) {
    if (inFlight >= 6) await new Promise((resolve) => waiting.push(resolve));
    inFlight += 1;
  }
  try { await network(); return await work(); } finally {
    if (BROWSER6) { inFlight -= 1; waiting.shift()?.(); }
  }
}
async function getOne(url, tag) {
  return limited(async () => {
    const res = await fetch(BASE + url, { headers: { ...headers, 'x-perf-tag': tag } });
    const buf = Buffer.from(await res.arrayBuffer());
    return { status: res.status, bytes: buf.length, url };
  });
}
async function getStep(step, tagOf) {
  if (!BATCH || step.length < 7) return Promise.all(step.map((url, j) => getOne(url, tagOf(j))));
  return limited(async () => {
    const res = await fetch(`${BASE}/api/v2/batch`, {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json', 'x-perf-tag': tagOf('batch') },
      body: JSON.stringify({ requests: step.map((url, j) => ({ id: String(j), path: url })) }),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    const items = JSON.parse(buf.toString()).responses ?? [];
    return items.map((item, j) => ({ status: item.status, bytes: j === 0 ? buf.length : 0, url: step[j] }));
  });
}

const out = fs.createWriteStream(OUT, { flags: 'a' });
for (const [flow, steps] of Object.entries(FLOWS)) {
  for (let run = 0; run < RUNS; run += 1) {
    const started = performance.now();
    let requests = 0, bytes = 0;
    const failures = [];
    const stepMs = [];
    for (const [i, step] of steps.entries()) {
      const s = performance.now();
      const results = (await getStep(step, (j) => `flow|${flow}|${run}|${i}.${j}`)).flat();
      requests += BATCH && step.length >= 7 ? 1 : results.length;
      for (const r of results) {
        bytes += r.bytes;
        if (r.status >= 400) failures.push(`${r.status} ${r.url.split('?')[0]}`);
      }
      stepMs.push(+(performance.now() - s).toFixed(1));
    }
    const rec = { flow, run, ms: +(performance.now() - started).toFixed(1), steps: steps.length, stepMs, requests, bytes, failures };
    out.write(JSON.stringify(rec) + '\n');
    if (run === 0 || run === RUNS - 1) console.log(`${flow} run${run}: ${rec.ms} ms, ${requests} req, ${(bytes / 1024).toFixed(0)} KB, steps ${stepMs.join('/')} ${failures.length ? 'FAIL ' + failures.join(', ') : ''}`);
  }
}
out.end();
