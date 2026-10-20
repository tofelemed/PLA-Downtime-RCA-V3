import { useIngestionExceptionsPage } from '@/api/v2/queries/ingestion-exceptions';
import { useActiveSourceMappings, useEffectiveMappings } from '@/api/v2/queries/integration-mappings';
import type { ConnectionView, IngestionJobView } from '@/api/v2/types/integrations';
import { ux06Stages, type StageResult } from '../model/stages';
import type { ConsoleSession } from './use-console-session';

/**
 * Facts of the UX06 stage tracker for one connection, from the server (mapping rules and override
 * versions of this connection, its jobs, the first page (20) of its open quarantine — "20+" when more exist) and this session.
 */
export function useConnectionStages(connection: ConnectionView, jobs: readonly IngestionJobView[], session: ConsoleSession): StageResult[] {
  const sourceMappings = useActiveSourceMappings();
  const effective = useEffectiveMappings(connection.id);
  const open = useIngestionExceptionsPage({ state: 'open', connectionId: connection.id });
  return ux06Stages({
    connection,
    test: session.testOf(connection.id),
    sampledAt: session.sampledAt(connection.id),
    mappingOverrides: (effective.data ?? []).filter((entry) => entry.override?.connectionId === connection.id).length,
    sourceMappings: sourceMappings.items.filter((rule) => rule.connectionId === connection.id && rule.isActive).length,
    jobs,
    openExceptions: open.status.isLoading || open.status.isError ? null : open.rows.length,
    moreExceptions: open.pager.canNext,
  });
}
