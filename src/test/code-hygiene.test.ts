import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Plan 3.1 step 7/8 ratchet: IndexedDB / StorageService and `Math.random` may not spread. Existing users
 * are listed with the sub-phase that removes them; new code (v2 client, features, realtime) has none.
 */
const ROOT = join(process.cwd(), 'src');

/** Remaining IndexedDB users. Dev-only seeders/scripts never reach production (vite-prod-bundle-guard). */
const INDEXEDDB_ALLOWLIST = new Set([
  'components/historian/EnhancedHistorianPage.tsx', // historian history → backend historian-history (3.7)
  'services/pi/PIStore.ts', // PI connection cache → v2 connections (3.7 integration console)
  'services/storage/UniversalConnectorDB.ts', // connector registry → v2 connections (3.7)
  'services/analytics/RealTimeAnalytics.ts', // streaming demo services (3.7, DEMO_MODE)
  'services/ethernetip/EtherNetIPConnector.ts',
  'services/profinet/ProfinetConnector.ts',
  'services/StorageService.ts', // legacy store itself
  'services/OilGasDataSeeder.ts', // dev-only seeders and scripts below
  'services/PLARCADataSeeder.ts',
  'services/PresentationDataSeeder.ts',
  'scripts/debugProductionLosses.ts',
  'scripts/diagnoseCementData.ts',
  'scripts/seedCementIndustryData.ts',
  'scripts/seedOilGasData.ts',
  'scripts/testPlantSelector.ts',
]);

/** Files using Math.random today (fabricated data, ids); 3.2–3.9 remove them per screen. */
const MATH_RANDOM_FILE_LIMIT = 35;

const NEW_CODE = ['api/', 'app/', 'features/', 'realtime/', 'lib/logger.ts', 'lib/lazy-named.ts', 'dev/'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !/\.(test|spec)\.tsx?$/.test(name) && !name.endsWith('.d.ts') ? [path] : [];
  });
}

const files = sourceFiles(ROOT).map((path) => ({
  rel: relative(ROOT, path).replace(/\\/g, '/'),
  text: readFileSync(path, 'utf8'),
}));

const usesIndexedDb = (text: string) =>
  /\bindexedDB\b/.test(text) || /import\s+\{[^}]*\}\s+from\s+['"][^'"]*\/StorageService['"]/.test(text);

describe('code hygiene ratchet (plan 3.1)', () => {
  it('no new IndexedDB / StorageService users', () => {
    const users = files.filter((file) => usesIndexedDb(file.text)).map((file) => file.rel);
    expect(users.filter((rel) => !INDEXEDDB_ALLOWLIST.has(rel))).toEqual([]);
  });

  it('new code never imports an IndexedDB user (plan 3.7: the console reads connections, jobs and quarantine from v2)', () => {
    const legacy = [...INDEXEDDB_ALLOWLIST].map((rel) => rel.replace(/\.tsx?$/, '').split('/').pop() as string);
    const importsOf = (text: string) => [...text.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
    const offences = files
      // dev/ registers the dev-only seeders on purpose (never in production builds)
      .filter((file) => NEW_CODE.some((prefix) => prefix !== 'dev/' && file.rel.startsWith(prefix)))
      .flatMap((file) => importsOf(file.text).filter((spec) => legacy.includes(spec.split('/').pop() as string)).map((spec) => `${file.rel} → ${spec}`));
    expect(offences).toEqual([]);
  });

  it('Math.random does not spread; new code has none, nor console.log', () => {
    const random = files.filter((file) => file.text.includes('Math.random'));
    expect(random.length).toBeLessThanOrEqual(MATH_RANDOM_FILE_LIMIT);
    const fresh = files.filter((file) => NEW_CODE.some((prefix) => file.rel.startsWith(prefix)));
    expect(fresh.length).toBeGreaterThan(10);
    expect(fresh.filter((file) => file.text.includes('Math.random')).map((file) => file.rel)).toEqual([]);
    expect(fresh.filter((file) => /console\.log\(/.test(file.text)).map((file) => file.rel)).toEqual([]);
  });
});
