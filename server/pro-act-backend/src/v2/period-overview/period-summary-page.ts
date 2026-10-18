import { SelectQueryBuilder } from 'typeorm';
import { ProductionPeriod } from '../../periods/entities/production-period.entity';
import { keysetCursorAt, keysetPage } from '../common/keyset-page';
import { SortDirection } from '../common/sort-spec';
import { residualStateOf } from '../pla-reports/reconciliation-status';
import { PeriodState } from './period-states';
import { ResidualState } from './period-summary.view';

/** Most periods one residual-filtered page examines (the state is domain arithmetic, not a column). */
export const RESIDUAL_SCAN_MAX = 2_000;
const SCAN_BATCH = 500;

export interface SummaryPageInput {
  /** a fresh scoped and filtered query per call (keyset pages add their cursor and order to it) */
  build: () => SelectQueryBuilder<ProductionPeriod>;
  direction: SortDirection;
  cursor?: string;
  limit: number;
  /** the period states of a page, in the page's order */
  load: (periods: ProductionPeriod[]) => Promise<PeriodState[]>;
  residualStates?: readonly ResidualState[];
}

export interface SummaryPage {
  states: PeriodState[];
  nextCursor: string | null;
}

/**
 * One page of the period grid, keyset on `(utcStart, id)` in either direction. With `residualStates` the
 * residual state of each period (the plan 2.8 reconciliation over saved decisions, `residualStateOf`) decides:
 * batches are scanned until `limit` rows match, the scope ends or `RESIDUAL_SCAN_MAX` periods were examined —
 * then the page may be short while `nextCursor` points after the last examined period (UX D-5 / D-6).
 */
export async function summaryPage(
  input: SummaryPageInput,
): Promise<SummaryPage> {
  if (!input.residualStates?.length) {
    const page = await keysetPage(input.build(), {
      alias: 'p',
      property: 'utcStart',
      direction: input.direction,
      cursor: input.cursor,
      limit: input.limit,
    });
    return {
      states: await input.load(page.items),
      nextCursor: page.nextCursor,
    };
  }
  return residualScan(input, new Set(input.residualStates));
}

async function residualScan(
  input: SummaryPageInput,
  wanted: ReadonlySet<ResidualState>,
): Promise<SummaryPage> {
  const kept: PeriodState[] = [];
  let cursor = input.cursor;
  let scanned = 0;
  for (;;) {
    const page = await keysetPage(input.build(), {
      alias: 'p',
      property: 'utcStart',
      direction: input.direction,
      cursor,
      limit: Math.min(SCAN_BATCH, RESIDUAL_SCAN_MAX - scanned),
    });
    const states = await input.load(page.items);
    scanned += states.length;
    const full = takeMatching(states, wanted, kept, input.limit);
    if (full !== null) {
      const atEnd = full === states.length - 1 && !page.nextCursor;
      const last = states[full].period.id;
      return {
        states: kept,
        nextCursor: atEnd
          ? null
          : await keysetCursorAt(input.build(), 'utcStart', last),
      };
    }
    if (!page.nextCursor || scanned >= RESIDUAL_SCAN_MAX) {
      return { states: kept, nextCursor: page.nextCursor };
    }
    cursor = page.nextCursor;
  }
}

/** Appends the matching states to `kept`; the index of the state that filled `limit`, else null. */
export function takeMatching(
  states: readonly PeriodState[],
  wanted: ReadonlySet<ResidualState>,
  kept: PeriodState[],
  limit: number,
): number | null {
  for (let index = 0; index < states.length; index += 1) {
    if (!wanted.has(residualStateOf(states[index]))) continue;
    kept.push(states[index]);
    if (kept.length >= limit) return index;
  }
  return null;
}
