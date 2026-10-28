/** `db/seed/manifest.json`: where the seed came from and how many rows each table holds after loading. */
import { mkdirSync, writeFileSync } from 'fs';
import { dirname } from 'path';

export interface SeedManifest {
  extractedAt: string;
  sourceDatabase: 'proact';
  tenantCode: string;
  organizationCode: string;
  tenantId: string;
  organizationId: string;
  tables: Record<string, number>;
  /** Seed file (without `.sql`) → its tables in load order; 20-seed-reference.sh checks per file. */
  files: Record<string, string[]>;
}

export function manifestJson(manifest: SeedManifest): string {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

export function writeManifest(path: string, manifest: SeedManifest): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, manifestJson(manifest), 'utf8');
}
