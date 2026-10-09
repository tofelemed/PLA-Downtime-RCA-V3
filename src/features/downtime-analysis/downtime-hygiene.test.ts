import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 3.3 static check: the Downtime Analysis feature renders server figures only — no fabricated data,
 * no browser aggregation of report values (`reduce`, `Math.max` over figures …), no local storage of
 * rules, no IndexedDB / StorageService and no `console.log`; charts are imported lazily (never statically).
 */
const ROOT = join(process.cwd(), 'src', 'features', 'downtime-analysis');
const FORBIDDEN: ReadonlyArray<[label: string, pattern: RegExp]> = [
  ['Math.random', /Math\.random/],
  ['reduce (client aggregation)', /\.reduce\(/],
  ['localStorage', /localStorage/],
  ['IndexedDB', /indexedDB|IDBDatabase/],
  ['StorageService', /StorageService/],
  ['console.log', /console\.log/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('Downtime Analysis hygiene (plan 3.3)', () => {
  const files = sourceFiles(ROOT);

  it('has no fabricated data, client aggregation, local rules, IndexedDB or console.log', () => {
    const offences = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return FORBIDDEN.filter(([, pattern]) => pattern.test(text)).map(([label]) => `${relative(process.cwd(), file)}: ${label}`);
    });
    expect(offences).toEqual([]);
  });

  it('imports Recharts only inside the lazily loaded chart modules', () => {
    const eager = files.filter((file) => /from 'recharts'/.test(readFileSync(file, 'utf8')) && !file.includes(join('components', 'charts')));
    expect(eager.map((file) => relative(process.cwd(), file))).toEqual([]);
    const chartImports = files.flatMap((file) => readFileSync(file, 'utf8').match(/import .* from '\.\/charts\/[^']+'/g) ?? []);
    expect(chartImports).toEqual([]);
  });
});
