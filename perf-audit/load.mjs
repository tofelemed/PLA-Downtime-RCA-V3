// Closed-loop load test, no dependencies: for each concurrency level, N workers repeatedly GET the URL
// (keep-alive) for --seconds; prints throughput, latency p50/p95/p99/max and error count per level.
// Tags requests `load|<name>|c<N>` so instrument.cjs records can be filtered. GET only.
//   PERF_PASSWORD=… node perf-audit/load.mjs --name events --url "/api/v2/production-events?limit=20" \
//     [--levels 1,4,16,32] [--seconds 15] [--role Analyst]
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';

const BASE = process.env.PERF_BASE || 'http://127.0.0.1:4014';
const arg = (n, f) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : f; };
const NAME = arg('name', 'load');
const URL_PATH = arg('url');
const LEVELS = arg('levels', '1,4,16,32').split(',').map(Number);
const SECONDS = Number(arg('seconds', '15'));
const ROLE = arg('role', 'Analyst');
const OUT = arg('out', 'perf-audit/out/load.jsonl');
if (!URL_PATH || !process.env.PERF_PASSWORD) throw new Error('--url and PERF_PASSWORD are required');

const psql = (sql) => execFileSync('docker', ['exec', 'proact-perf-postgres', 'psql', '-U', 'postgres', '-d', 'proact', '-X', '-At', '-c', sql],
  { encoding: 'utf8', env: { ...process.env, MSYS_NO_PATHCONV: '1' } }).trim();
const tenant = psql('SELECT id FROM tenants ORDER BY created_at LIMIT 1');
const email = psql(`SELECT email FROM users WHERE role='${ROLE}' AND email LIKE '%@hdpe-train.mpc' ORDER BY email LIMIT 1`);
const login = await fetch(`${BASE}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: process.env.PERF_PASSWORD }) }).then((r) => r.json());
const headers = { Authorization: `Bearer ${login.access_token}`, 'X-Tenant-Id': tenant, 'Accept-Encoding': 'identity' };

const pct = (s, p) => s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
const out = fs.createWriteStream(OUT, { flags: 'a' });
for (const level of LEVELS) {
  const lat = [];
  let errors = 0;
  const statuses = {};
  const deadline = performance.now() + SECONDS * 1000;
  const worker = async () => {
    while (performance.now() < deadline) {
      const t = performance.now();
      try {
        const res = await fetch(BASE + URL_PATH, { headers: { ...headers, 'x-perf-tag': `load|${NAME}|c${level}` } });
        await res.arrayBuffer();
        statuses[res.status] = (statuses[res.status] || 0) + 1;
        if (res.status >= 400) errors += 1;
      } catch { errors += 1; }
      lat.push(performance.now() - t);
    }
  };
  const started = performance.now();
  await Promise.all(Array.from({ length: level }, worker));
  const elapsed = (performance.now() - started) / 1000;
  lat.sort((a, b) => a - b);
  const rec = { name: NAME, url: URL_PATH, role: ROLE, concurrency: level, seconds: +elapsed.toFixed(1), requests: lat.length,
    rps: +(lat.length / elapsed).toFixed(1), p50: +pct(lat, 50).toFixed(1), p95: +pct(lat, 95).toFixed(1),
    p99: +pct(lat, 99).toFixed(1), max: +lat[lat.length - 1].toFixed(1), errors, statuses };
  out.write(JSON.stringify(rec) + '\n');
  console.log(`${NAME} c=${level}: ${rec.rps} req/s p50=${rec.p50} p95=${rec.p95} p99=${rec.p99} max=${rec.max} errors=${errors} ${JSON.stringify(statuses)}`);
}
out.end();
