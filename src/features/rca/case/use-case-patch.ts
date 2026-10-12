import { useQueryClient } from '@tanstack/react-query';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useUpdateRcaCase, type RcaCasePatch } from '@/api/v2/queries/rca-commands';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RcaCaseView, RcaEvidenceItem, RcaEventDiagram } from '@/api/v2/types/rca';
import { useCaseWorkspace } from './case-context';

/**
 * A PATCH in the screen's own shapes: evidence and diagram items as read (their enumerations are the
 * server's own values, so the body is passed on as the generated contract type at this one boundary).
 */
export type CasePatch = Omit<RcaCasePatch, 'evidence' | 'eventDiagram'> & { evidence?: RcaEvidenceItem[]; eventDiagram?: RcaEventDiagram };

const asContract = (body: CasePatch | RcaCasePatch): RcaCasePatch => body as unknown as RcaCasePatch;

/**
 * Saves part of the case (one list or the definition) with If-Match = the version on screen; the answer
 * replaces the cached case at once, so the next save carries the new version.
 */
export function useCasePatch() {
  const { rca } = useCaseWorkspace();
  const update = useUpdateRcaCase();
  const client = useQueryClient();
  const tenantId = useV2TenantId();
  const save = async (body: CasePatch | RcaCasePatch): Promise<RcaCaseView> => {
    const result = await update.submit({ rca, body: asContract(body) });
    client.setQueryData(v2Keys.detail(tenantId ?? '-', 'rca-cases', rca.id, undefined), result);
    return result;
  };
  return { save, error: update.error, isPending: update.isPending, reset: update.reset };
}
