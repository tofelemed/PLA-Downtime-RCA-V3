import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { DayView } from '../types/production-day';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** A production day of a unit: shift periods, certification and the roll-up of the approved shifts. */
export function useProductionDay(unitId: string | null, localDate: string | null) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'close', `${unitId ?? '-'}|${localDate ?? '-'}`, 'production-day'),
    enabled: Boolean(tenantId && unitId && localDate),
    staleTime: STALE_TIME.close,
    queryFn: async ({ signal }) => (await v2Request<DayView>({ method: 'GET', path: `/production-days/${unitId}/${localDate}`, signal })).data,
  });
}

export interface CertifyDayInput {
  unitId: string;
  localDate: string;
  comment?: string;
}

/** One approval certifies the day's roll-up (plant management, never a submitter of its shifts). */
export function useCertifyDay() {
  const tenantId = useV2TenantId();
  return useV2Command<CertifyDayInput, DayView>({
    run: async ({ input, idempotencyKey }) =>
      (await v2Request<DayView>({ method: 'POST', path: `/production-days/${input.unitId}/${input.localDate}/certify`, body: input.comment ? { comment: input.comment } : {}, idempotencyKey })).data,
    changes: () => (tenantId ? { tenantId, entityType: 'month_close' } : null),
    retries: 0,
  });
}
