import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 3.4 static checks: the plans / profiles / calendars feature shows server figures only (no
 * fabricated data, no client aggregation, no local rules, IndexedDB or console.log), and no plan or
 * template screen offers or derives the old "100 units per hour" default rate.
 */
const FEATURE = join(process.cwd(), 'src', 'features', 'plans-profiles-calendars');
const PLAN_SCREENS = [join(process.cwd(), 'src', 'components', 'production-plans'), join(process.cwd(), 'src', 'pages', 'ProductionPlans.tsx')];

const FORBIDDEN: ReadonlyArray<[label: string, pattern: RegExp]> = [
  ['Math.random', /Math\.random/],
  ['reduce (client aggregation)', /\.reduce\(/],
  ['localStorage', /localStorage/],
  ['IndexedDB', /indexedDB|IDBDatabase/],
  ['StorageService', /StorageService/],
  ['console.log', /console\.log/],
];

const DEFAULT_RATE: ReadonlyArray<[label: string, pattern: RegExp]> = [
  ['"100 units per hour"', /100 units per hour/i],
  ['hours × 100', /totalHours\s*\*\s*100/],
  ['default production rate', /default production rate/i],
];

function sourceFiles(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  return readdirSync(path).flatMap((name) => {
    const child = join(path, name);
    if (statSync(child).isDirectory()) return sourceFiles(child);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [child] : [];
  });
}

const offences = (files: string[], rules: typeof FORBIDDEN) =>
  files.flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return rules.filter(([, pattern]) => pattern.test(text)).map(([label]) => `${relative(process.cwd(), file)}: ${label}`);
  });

describe('Plans, profiles, calendars hygiene (plan 3.4)', () => {
  it('has no fabricated data, client aggregation, local rules, IndexedDB or console.log', () => {
    expect(offences(sourceFiles(FEATURE), FORBIDDEN)).toEqual([]);
  });

  it('no plan, template or v2 screen offers or derives a 100 units / h default', () => {
    const files = [...sourceFiles(FEATURE), ...PLAN_SCREENS.flatMap(sourceFiles)];
    expect(offences(files, DEFAULT_RATE)).toEqual([]);
  });

  it('keeps every new file within the size limits (400 lines; components ≤ 150)', () => {
    const limit = (file: string) => (file.endsWith('.tsx') ? 150 : 400);
    const tooLong = sourceFiles(FEATURE).filter((file) => readFileSync(file, 'utf8').split('\n').length > limit(file));
    expect(tooLong.map((file) => relative(process.cwd(), file))).toEqual([]);
  });
});
