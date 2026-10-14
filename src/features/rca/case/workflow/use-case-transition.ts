import { useQueryClient } from '@tanstack/react-query';
import { v2Keys } from '@/api/v2/queries/query-keys';
import { useTransitionRcaCase, type RcaTransitionBody } from '@/api/v2/queries/rca-commands';
import { useV2TenantId } from '@/api/v2/queries/use-v2-tenant';
import type { RcaCaseView } from '@/api/v2/types/rca';
import { useCaseWorkspace } from '../case-context';

/**
 * Moves the case through the workflow with If-Match = the version on screen; the answer replaces the
 * cached case at once (readiness refreshes through the RCA change notice).
 */
export function useCaseTransition() {
  const { rca } = useCaseWorkspace();
  const transition = useTransitionRcaCase();
  const client = useQueryClient();
  const tenantId = useV2TenantId();
  const move = async (body: RcaTransitionBody): Promise<RcaCaseView> => {
    const result = await transition.submit({ rca, body });
    client.setQueryData(v2Keys.detail(tenantId ?? '-', 'rca-cases', rca.id, undefined), result);
    return result;
  };
  return { move, error: transition.error, isPending: transition.isPending, reset: transition.reset };
}
