import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { PostingTreatment, RestatementView } from '../types/restatement';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** The delta of a restating revision against the approved one it supersedes (SME R5); null = not loaded. */
export function useRestatement(periodId: string | null, revision: number | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'period-accounting', periodId ?? '-', `restatement-${revision ?? '-'}`),
    enabled: Boolean(tenantId && periodId && revision),
    staleTime: STALE_TIME['period-accounting'],
    queryFn: async ({ signal }) =>
      (await v2Request<RestatementView>({ method: 'GET', path: `/production-periods/${periodId}/restatement`, query: { revision: String(revision) }, signal })).data,
  });
}

export interface PostingInput {
  periodId: string;
  revision: number;
  postingDate: string;
  treatment: PostingTreatment;
  note?: string;
}

/** Finance's posting date and treatment of a restatement; a later decision replaces the earlier one. */
export function usePostingDecision() {
  const tenantId = useV2TenantId();
  return useV2Command<PostingInput, RestatementView>({
    run: async ({ input, idempotencyKey }) => {
      const body = { postingDate: input.postingDate, treatment: input.treatment, ...(input.note ? { note: input.note } : {}) };
      return (await v2Request<RestatementView>({ method: 'POST', path: `/production-periods/${input.periodId}/revisions/${input.revision}/posting`, body, idempotencyKey })).data;
    },
    changes: (input) => (tenantId ? { tenantId, entityType: 'production_period', entityId: input.periodId, window: null } : null),
    retries: 0,
  });
}
