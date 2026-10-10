import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 3.6 static checks: the flag-on PLA Analytics, Reports and Dashboard render server figures only — no
 * fabricated data, no browser aggregation (`reduce`), no local rules, IndexedDB / StorageService or
 * `console.log`, none of the v1 heuristics (`UnifiedAnalyticsService`, `DashboardAnalytics`,
 * `window.location.reload`); Recharts only inside the lazily loaded chart modules.
 */
const ROOT = join(process.cwd(), 'src', 'features', 'pla-analytics');
const FORBIDDEN: ReadonlyArray<[label: string, pattern: RegExp]> = [
  ['Math.random', /Math\.random/],
  ['reduce (client aggregation)', /\.reduce\(/],
  ['localStorage', /localStorage/],
  ['IndexedDB', /indexedDB|IDBDatabase/],
  ['StorageService', /StorageService/],
  ['console.log', /console\.log/],
  ['UnifiedAnalyticsService', /UnifiedAnalyticsService|unifiedAnalyticsService/],
  ['DashboardAnalytics', /DashboardAnalytics/],
  ['window.location.reload', /location\.reload/],
  ['v1 MasterDataService', /MasterDataService|masterDataService/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('PLA analytics hygiene (plan 3.6)', () => {
  const files = sourceFiles(ROOT);

  it('has no fabricated data, client aggregation, v1 heuristics, local storage or console.log', () => {
    const offences = files.flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return FORBIDDEN.filter(([, pattern]) => pattern.test(text)).map(([label]) => `${relative(process.cwd(), file)}: ${label}`);
    });
    expect(offences).toEqual([]);
  });

  it('imports Recharts only inside the lazily loaded chart modules, and chart modules only lazily', () => {
    const eager = files.filter((file) => /from 'recharts'/.test(readFileSync(file, 'utf8')) && !file.includes(join('pla-analytics', 'charts')));
    expect(eager.map((file) => relative(process.cwd(), file))).toEqual([]);
    const staticChartImports = files.flatMap((file) => readFileSync(file, 'utf8').match(/^import .* from '[^']*(charts\/|waterfall-chart)[^']*';$/gm) ?? []);
    expect(staticChartImports).toEqual([]);
  });

  it('keeps files within the size limits (≤ 400 lines)', () => {
    const long = files.filter((file) => readFileSync(file, 'utf8').split('\n').length > 400);
    expect(long).toEqual([]);
  });
});
