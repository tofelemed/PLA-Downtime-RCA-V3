// Joins the sweep's client records (bench-sweep.mjs) with the server records (instrument.cjs) by x-perf-tag
// and prints per-route statistics: cold ms, warm p50/p95/p99 (server), queries / RLS binding / repeated
// queries / DB ms / serialize ms (median of warm calls), payload raw/gzip/brotli, status.
//   node perf-audit/report.mjs --client out/sweep-client.jsonl --server out/sweep-server.jsonl [--json out/summary.json]
import fs from 'node:fs';

const arg = (n, f) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : f; };
const read = (f) => fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
const client = read(arg('client', 'perf-audit/out/sweep-client.jsonl'));
const server = read(arg('server', 'perf-audit/out/sweep-server.jsonl')).filter((r) => r.kind === 'req' && r.tag);
const byTag = new Map(server.map((r) => [r.tag, r]));

const pct = (xs, p) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];
};
const med = (xs) => pct(xs, 50);

const groups = new Map();
for (const c of client) {
  const key = `${c.role}|${c.template}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push({ c, s: byTag.get(`${c.role}|GET ${c.template}|${c.n}`) });
}

const rows = [];
for (const [key, calls] of groups) {
  const [role, template] = key.split('|');
  const cold = calls.find((x) => x.c.n === 0);
  const warm = calls.filter((x) => x.c.n > 0 && x.s);
  const ms = warm.map((x) => x.s.ms);
  rows.push({
    role, template, status: cold.c.status, unresolved: cold.c.unresolved, error: cold.c.errorBody,
    coldMs: cold.s ? cold.s.ms : cold.c.clientMs,
    p50: med(ms), p95: pct(ms, 95), p99: pct(ms, 99), clientP50: med(warm.map((x) => x.c.clientMs)),
    queries: med(warm.map((x) => x.s.queries)) ?? cold.s?.queries, binding: med(warm.map((x) => x.s.binding)) ?? cold.s?.binding,
    repeated: med(warm.map((x) => x.s.repeated)) ?? cold.s?.repeated, dbMs: med(warm.map((x) => x.s.dbMs)),
    serializeMs: med(warm.map((x) => x.s.serializeMs)), bytes: cold.c.bytes, gzip: cold.c.gzip, br: cold.c.br,
  });
}

const json = arg('json', null);
if (json) fs.writeFileSync(json, JSON.stringify(rows, null, 1));

const ok = rows.filter((r) => r.status < 400);
const fail = rows.filter((r) => r.status >= 400);
const kb = (b) => (b == null ? '' : (b / 1024).toFixed(1));
console.log(`routes measured: ${ok.length} ok, ${fail.length} non-2xx`);
console.log('role | route | cold | p50 | p95 | p99 | q | bind | rep | dbMs | serMs | KB raw/gz');
for (const r of ok.sort((a, b) => (b.p95 ?? 0) - (a.p95 ?? 0))) {
  console.log([r.role, r.template, r.coldMs, r.p50, r.p95, r.p99, r.queries, r.binding, r.repeated, r.dbMs, r.serializeMs, `${kb(r.bytes)}/${kb(r.gzip)}`].join(' | '));
}
if (arg('failures', null)) for (const r of fail) console.log(`FAIL ${r.status} ${r.role} ${r.template} ${r.unresolved || ''} ${(r.error || '').slice(0, 140)}`);
