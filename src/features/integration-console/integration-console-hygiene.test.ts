import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 3.7 static check: the integration console works on the v2 API only — no IndexedDB / StorageService,
 * no PIStore / UniversalConnectorDB / simulated protocol services, no browser storage of anything (the
 * write-only secret never leaves the form), no client-side PI credentials, no fabricated data, no
 * aggregation of figures and no `console.log`.
 */
const ROOT = join(process.cwd(), 'src', 'features', 'integration-console');
const FORBIDDEN: ReadonlyArray<[label: string, pattern: RegExp]> = [
  ['Math.random', /Math\.random/],
  ['reduce (client aggregation)', /\.reduce\(/],
  ['localStorage / sessionStorage', /localStorage|sessionStorage/],
  ['IndexedDB', /indexedDB|IDBDatabase/],
  ['StorageService', /StorageService/],
  ['PIStore / connector DB', /PIStore|UniversalConnector|services\/(pi|storage|streaming|integrations)\//],
  ['v1 PI proxy / browser', /pi-proxy|pi-browser|piWebApiService/i],
  ['console.log', /console\.log/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

describe('integration console hygiene (plan 3.7)', () => {
  it('uses the v2 API only: no browser storage, legacy connector stores, fabricated data or console.log', () => {
    const offences = sourceFiles(ROOT).flatMap((file) => {
      const text = readFileSync(file, 'utf8');
      return FORBIDDEN.filter(([, pattern]) => pattern.test(text)).map(([label]) => `${relative(process.cwd(), file)}: ${label}`);
    });
    expect(offences).toEqual([]);
  });
});
