import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 3.5 static check: the v2 Plan Dashboard renders server figures only — no fabricated data, no
 * browser aggregation (`reduce`), no local storage, IndexedDB / StorageService or
 * `console.log`, no v1 reconcile / loss-category / OEE writes (B9 B10); Recharts only in the lazily
 * loaded waterfall chart; files within the size limit.
 */
const ROOT = join(process.cwd(), 'src', 'features', 'plan-dashboard');
const FORBIDDEN: ReadonlyArray<[label: string, pattern: RegExp]> = [
  ['Math.random', /Math\.random/],
  ['reduce (client aggregation)', /\.reduce\(/],
  ['localStorage', /localStorage/],
  ['IndexedDB', /indexedDB|IDBDatabase/],
  ['StorageService', /StorageService/],
  ['masterDataService (v1 writes)', /masterDataService|MasterDataService\b(?!'\s*;)/],
  ['v1 reconcile / loss-category / OEE routes', /reconcile-forms|loss-categories|oee-summaries/],
  ['console.log', /console\.log/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('Plan Dashboard hygiene (plan 3.5)', () => {
  const files = sourceFiles(ROOT);

  it('has no fabricated data, client aggregation, local storage, v1 writes or console.log', () => {
    const offences = files
      .filter((file) => !file.endsWith('plan-dashboard-switch.tsx'))
      .flatMap((file) => {
        const text = readFileSync(file, 'utf8');
        return FORBIDDEN.filter(([, pattern]) => pattern.test(text)).map(([label]) => `${relative(process.cwd(), file)}: ${label}`);
      });
    expect(offences).toEqual([]);
  });

  it('imports Recharts only in the waterfall chart, which only the lazily loaded panel uses', () => {
    const recharts = files.filter((file) => /from 'recharts'/.test(readFileSync(file, 'utf8')));
    expect(recharts.map((file) => relative(ROOT, file).split(sep).join('/'))).toEqual(['components/waterfall-chart.tsx']);
    const importers = files.filter((file) => /from '\.\/waterfall-chart'/.test(readFileSync(file, 'utf8')));
    expect(importers.map((file) => relative(ROOT, file).split(sep).join('/'))).toEqual(['components/waterfall-panel.tsx']);
    const eagerPanel = files.filter((file) => /^import .*waterfall-panel/m.test(readFileSync(file, 'utf8')));
    expect(eagerPanel).toEqual([]);
  });

  it('keeps every file within 400 lines', () => {
    const long = files.filter((file) => readFileSync(file, 'utf8').split('\n').length > 400);
    expect(long).toEqual([]);
  });
});
