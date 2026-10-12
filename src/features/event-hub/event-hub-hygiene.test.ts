import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 3.2 static check: the v2 Event Hub bundle (this feature and the v2 client it uses) has no
 * fabricated data (`Math.random`), no browser-side rules (`localStorage`), no IndexedDB / legacy
 * StorageService and no `console.log` (B15, B16, UX03). `localStorage` holds per-user conveniences only
 * (the remembered list window), never rules or business data: that module is the allowed user.
 */
const LOCAL_STORAGE_ALLOWED = ['window-preference.ts'];
const ROOTS = [join(process.cwd(), 'src', 'features', 'event-hub'), join(process.cwd(), 'src', 'api', 'v2')];
const FORBIDDEN: ReadonlyArray<[label: string, pattern: RegExp]> = [
  ['Math.random', /Math\.random/],
  ['localStorage', /localStorage/],
  ['IndexedDB', /indexedDB|IDBDatabase/],
  ['StorageService', /StorageService/],
  ['console.log', /console\.log/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

describe('Event Hub v2 hygiene (plan 3.2)', () => {
  it('has no fabricated data, local rules, IndexedDB or console.log', () => {
    const offences = ROOTS.flatMap(sourceFiles).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      const allowed = LOCAL_STORAGE_ALLOWED.some((name) => file.endsWith(name));
      return FORBIDDEN.filter(([label, pattern]) => pattern.test(text) && !(allowed && label === 'localStorage')).map(([label]) => `${relative(process.cwd(), file)}: ${label}`);
    });
    expect(offences).toEqual([]);
  });
});
