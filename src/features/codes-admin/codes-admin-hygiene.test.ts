import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 3.8 static checks (NFR02, B15): rules are never executable code in the browser — no
 * `new Function` / `eval` in the codes & rules screen or in the screens that used to run status rules,
 * no rules in browser storage, no IndexedDB, no fabricated data, no client aggregation, no console.log.
 */
const SRC = join(process.cwd(), 'src');
const FEATURE = join(SRC, 'features', 'codes-admin');
const CODE = /new Function\s*\(|\beval\s*\(|Function\s*\(\s*['"`]/;
const FORBIDDEN: ReadonlyArray<[label: string, pattern: RegExp]> = [
  ['new Function / eval', CODE],
  ['Math.random', /Math\.random/],
  ['reduce (client aggregation)', /\.reduce\(/],
  ['localStorage / sessionStorage', /localStorage|sessionStorage/],
  ['IndexedDB / StorageService', /indexedDB|IDBDatabase|StorageService/],
  ['console.log', /console\.log/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('codes & rules hygiene (plan 3.8)', () => {
  it('the screen evaluates nothing and stores nothing in the browser', () => {
    const offences = sourceFiles(FEATURE).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return FORBIDDEN.filter(([, pattern]) => pattern.test(text)).map(([label]) => `${relative(process.cwd(), file)}: ${label}`);
    });
    expect(offences).toEqual([]);
  });

  it('the Admin Panel and the v1 Event Hub no longer compile or load user rules (B15)', () => {
    // a retired page (the v1 Event Hub was removed) cannot load rules any more
    for (const file of ['pages/AdminPanel.tsx', 'pages/EventHub.tsx'].filter((name) => existsSync(join(SRC, name)))) {
      const text = readFileSync(join(SRC, file), 'utf8');
      expect(text, file).not.toMatch(CODE);
      expect(text, file).not.toMatch(/localStorage\.(get|set)Item\(\s*['"]statusAutomationRules/);
    }
  });

  it('the v2 rule API layer sends JSON definitions only', () => {
    const text = readFileSync(join(SRC, 'api', 'v2', 'queries', 'rules.ts'), 'utf8');
    expect(text).not.toMatch(CODE);
    expect(text).not.toMatch(/\.toString\(\)/);
  });
});
