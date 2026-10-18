import { EntityManager } from 'typeorm';
import { MonthClose } from '../../close/entities/month-close.entity';
import { monthCloseOn } from '../../close/month-lock';
import { MonthCloseState } from '../../domain/close/month-close-machine';

/**
 * How an approved period of this month may be corrected (SME R4, the rule of `correctionAllowed`):
 * `direct` = revise ("Unlock") while the month is open, `proposal` = only through a change proposal once the
 * month is locked, `none` = the month is closing (reopen the month first).
 */
export type CorrectionPath = 'direct' | 'proposal' | 'none';

/** UX D-7: the close state of the financial month that contains the period's operational date. */
export interface MonthCloseStateV2View {
  /** open | quantities_closed | finance_signed_off | locked (a month never acted on is open) */
  state: MonthCloseState;
  /** YYYY-MM of the month close row; null while the month was never acted on */
  monthKey: string | null;
  correctionPath: CorrectionPath;
}

export function monthCloseStateView(
  close: MonthClose | null,
): MonthCloseStateV2View {
  if (!close || close.state === 'open') {
    return {
      state: 'open',
      monthKey: close?.monthKey ?? null,
      correctionPath: 'direct',
    };
  }
  return {
    state: close.state,
    monthKey: close.monthKey,
    correctionPath: close.state === 'locked' ? 'proposal' : 'none',
  };
}

/** One query: the month close row whose dates contain the period's operational date. */
export async function monthCloseStateOf(
  manager: EntityManager,
  period: { tenantId: string; localDate: string },
): Promise<MonthCloseStateV2View> {
  return monthCloseStateView(
    await monthCloseOn(manager, period.tenantId, period.localDate),
  );
}
