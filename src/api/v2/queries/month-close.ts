import { useQuery } from '@tanstack/react-query';
import { v2Request } from '../client';
import type { MonthCloseStep, MonthCloseView } from '../types/month-close';
import { v2Keys } from './query-keys';
import { STALE_TIME } from './stale-times';
import { useV2Command } from './use-v2-command';
import { useV2TenantId } from './use-v2-tenant';

/** `current` = the month containing today in plant time (the server decides which one that is). */
export type MonthSelection = string | 'current';

/** The month close of a financial month of the acting plant (SME R1 / R4). */
export function useMonthClose(month: MonthSelection) {
  const tenantId = useV2TenantId();
  return useQuery({
    queryKey: v2Keys.detail(tenantId ?? '-', 'close', month, 'month'),
    enabled: Boolean(tenantId),
    staleTime: STALE_TIME.close,
    queryFn: async ({ signal }) => (await v2Request<MonthCloseView>({ method: 'GET', path: `/month-closes/${month}`, signal })).data,
  });
}

export interface MonthCloseStepInput {
  month: string;
  step: MonthCloseStep;
  /** sign-off comment, or the reason of a reopen (required by the server) */
  text?: string;
}

/** One month close step; the answer is the month view, and every month close result is refreshed. */
export function useMonthCloseStep() {
  const tenantId = useV2TenantId();
  return useV2Command<MonthCloseStepInput, MonthCloseView>({
    run: async ({ input, idempotencyKey }) => {
      const text = input.text?.trim();
      const body = input.step === 'reopen' ? { reason: text ?? '' } : text ? { comment: text } : {};
      return (await v2Request<MonthCloseView>({ method: 'POST', path: `/month-closes/${input.month}/${input.step}`, body, idempotencyKey })).data;
    },
    changes: () => (tenantId ? { tenantId, entityType: 'month_close' } : null),
    retries: 0,
  });
}
