// Summarizes a V8 .cpuprofile: self time by function and by package / app folder.
//   node perf-audit/profile-summary.mjs perf-audit/out/<file>.cpuprofile [top]
import fs from 'node:fs';

const [file, topArg] = process.argv.slice(2);
const TOP = Number(topArg || 25);
const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const self = new Map();
const deltas = profile.timeDeltas;
profile.samples.forEach((id, i) => self.set(id, (self.get(id) || 0) + (deltas[i] || 0)));
const total = [...self.values()].reduce((a, b) => a + b, 0);

const fnTotals = new Map();
const pkgTotals = new Map();
for (const [id, us] of self) {
  const { callFrame: f } = byId.get(id);
  const url = f.url || '';
  const where = url.includes('node_modules')
    ? `pkg:${url.split('node_modules/').pop().split('/').slice(0, url.includes('node_modules/@') ? 2 : 1).join('/')}`
    : url.includes('/dist/src/') ? `app:${url.split('/dist/src/')[1].split('/')[0]}` : url ? 'node:internal' : `(${f.functionName || 'native'})`;
  const fn = `${f.functionName || '(anonymous)'} ${url.split('/').slice(-2).join('/')}:${f.lineNumber + 1}`;
  fnTotals.set(fn, (fnTotals.get(fn) || 0) + us);
  pkgTotals.set(where, (pkgTotals.get(where) || 0) + us);
}
const show = (m, n) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n)
  .forEach(([k, us]) => console.log(`${((us / total) * 100).toFixed(1).padStart(5)}%  ${(us / 1000).toFixed(0).padStart(6)} ms  ${k}`));
console.log(`total sampled ${(total / 1e6).toFixed(1)} s\n-- by package / app folder`);
show(pkgTotals, 20);
console.log(`-- top ${TOP} functions (self time)`);
show(fnTotals, TOP);
