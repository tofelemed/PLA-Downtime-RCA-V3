import type { SampleQuery } from '@/api/v2/queries/integration-connections';
import type { DiscoveryView } from '@/api/v2/types/integrations';

/** What the console reads from: an AF database or element, optionally one template (PI job scope). */
export interface SourceScope {
  scopeType: 'database' | 'element';
  scopeId: string;
  templateName: string | null;
}

export const EMPTY_SCOPE: SourceScope = { scopeType: 'database', scopeId: '', templateName: null };

/** AF databases of the discovery answer as select options ("server / database"). */
export function databaseOptions(discovery: DiscoveryView | undefined): Array<{ value: string; label: string }> {
  return (discovery?.metadata.assetServers ?? []).flatMap((server) =>
    server.databases.map((database) => ({ value: database.webId, label: `${server.name} / ${database.name}` })),
  );
}

export const SAMPLE_MAX_HOURS = 31 * 24;

/** The sample request of the last `hours` (1 h – 31 days, 20 records), ending now. */
export function sampleQuery(scope: SourceScope, hours: number, now: number): SampleQuery | null {
  if (!scope.scopeId) return null;
  const span = Math.min(Math.max(1, Math.round(hours)), SAMPLE_MAX_HOURS) * 3_600_000;
  return {
    scopeType: scope.scopeType,
    scopeId: scope.scopeId,
    ...(scope.templateName ? { templateName: scope.templateName } : {}),
    from: new Date(now - span).toISOString(),
    to: new Date(now).toISOString(),
    limit: 20,
  };
}
