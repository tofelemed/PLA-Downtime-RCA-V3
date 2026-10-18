import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLinkTargetToRca } from '@/api/v2/queries/rca-commands';

/**
 * After a case is created or chosen from `/rca/new?lossLineId=`: links the loss line (its evidence package
 * carries the approved impact), then opens the case. A refused link keeps the page with the error and a
 * way into the case, so the failure is never silent.
 */
export function useLossLineFollowUp(lossLineId: string | null | undefined) {
  const navigate = useNavigate();
  const link = useLinkTargetToRca();
  const [unlinkedCaseId, setUnlinkedCaseId] = useState<string | null>(null);
  const finish = async (caseId: string) => {
    if (lossLineId) {
      const body = { linkType: 'loss_line' as const, targetId: lossLineId, reason: 'Started from the loss line' };
      const linked = await link.submit({ rcaId: caseId, body }).catch(() => null);
      if (!linked) {
        setUnlinkedCaseId(caseId);
        return;
      }
    }
    navigate(`/rca/${caseId}`, { replace: true });
  };
  return { finish, error: link.error, unlinkedCaseId, isPending: link.isPending };
}
