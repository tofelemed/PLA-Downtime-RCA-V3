import { EntityManager } from 'typeorm';
import { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { LossLineDraft } from '../domain/accounting/accounting.types';
import { Dec, formatDec } from '../domain/actuals/decimal';
import { valueLine } from '../domain/valuation/value-line';
import {
  StoredLineValuation,
  storeLineValuation,
} from '../domain/valuation/valuation-snapshot';
import {
  ValuationTotal,
  valuationTotals,
} from '../domain/valuation/valuation-totals';
import {
  LineValuation,
  ValuationContext,
} from '../domain/valuation/valuation.types';
import { LossLineValuation } from './entities/loss-line-valuation.entity';
import { PeriodValuationTotal } from './entities/period-valuation-total.entity';

const CHUNK = 500;

interface RunScope {
  tenantId: string;
  periodId: string;
  runId: string;
}

/** Lost seconds of a time-based line: availability with a cause = interval × the cause's share. */
function lostSeconds(line: LossLineDraft): Dec | null {
  if (line.kind !== 'availability' || !line.cause) return null;
  const share = line.evidence[0]?.share ?? '1';
  const ms = line.segmentEnd.getTime() - line.segmentStart.getTime();
  return new Dec(ms).div(1000).mul(share);
}

const CLASS_FLAG = 'quality_class:';

/** SME E3: the disposition class a quality line names (`quality_class:<class>`), else null. */
function qualityClassOf(flags: readonly string[]): string | null {
  const flag = flags.find((f) => f.startsWith(CLASS_FLAG));
  return flag ? flag.slice(CLASS_FLAG.length) : null;
}

/** Profile and product of a slice (the product only matters to the economic view, SME V3). */
export interface SliceOwner {
  profileId: string | null;
  productId: string;
}

/** Valuation of every line of a run (pure; profiles = slice → profile and product). */
export function valueRunLines(
  lines: readonly LossLineDraft[],
  context: ValuationContext,
  profiles: ReadonlyMap<string, SliceOwner>,
): LineValuation[] {
  return lines.map((line) =>
    valueLine(
      {
        kind: line.kind,
        quantity: line.quantity,
        uom: line.uom,
        start: line.segmentStart,
        end: line.segmentEnd,
        seconds: lostSeconds(line),
        profileId: profiles.get(line.sliceId)?.profileId ?? null,
        impactCodeId: line.cause?.impactCodeId ?? null,
        ...(context.policy.economic
          ? {
              productId: profiles.get(line.sliceId)?.productId ?? null,
              qualityClass: qualityClassOf(line.flags),
            }
          : {}),
      },
      context,
    ),
  );
}

/** The `loss_lines.valuation` snapshots, index-aligned with the lines. */
export function storedValuations(
  valuations: readonly LineValuation[],
  context: ValuationContext,
): StoredLineValuation[] {
  return valuations.map((v) =>
    storeLineValuation(v, context.policy, context.engineVersion),
  );
}

async function insertAll<T extends LossLineValuation | PeriodValuationTotal>(
  manager: EntityManager,
  target: new () => T,
  rows: Array<QueryDeepPartialEntity<T>>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await manager.insert(target, rows.slice(i, i + CHUNK));
  }
}

function lineRows(
  scope: RunScope,
  lines: readonly LossLineDraft[],
  ids: readonly string[],
  valuations: readonly LineValuation[],
): Array<QueryDeepPartialEntity<LossLineValuation>> {
  return valuations.flatMap((valuation, i) =>
    valuation.views.flatMap((view) =>
      view.amounts.map((amount) => ({
        tenantId: scope.tenantId,
        runId: scope.runId,
        periodId: scope.periodId,
        lossLineId: ids[i],
        sliceId: lines[i].sliceId,
        ledger: lines[i].ledger,
        view: view.view,
        currency: amount.currency,
        amount: amount.amount === null ? null : formatDec(amount.amount),
        native: amount.native,
        status: view.status,
        reason: amount.reason ?? view.reason,
        provisional: amount.provisional === true,
        rateVersionIds: [
          ...new Set(view.components.map((c) => c.rateVersionId)),
        ],
        fxRateIds: amount.fxRateIds,
        valuationDate: valuation.valuationDate,
      })),
    ),
  );
}

function totalRow(
  scope: RunScope,
  total: ValuationTotal,
): QueryDeepPartialEntity<PeriodValuationTotal> {
  return {
    tenantId: scope.tenantId,
    runId: scope.runId,
    periodId: scope.periodId,
    sliceId: total.sliceId,
    ledger: total.ledger,
    kind: total.kind,
    view: total.view,
    currency: total.currency,
    uom: total.uom,
    amount: total.amount === null ? null : formatDec(total.amount),
    nativeAmount: formatDec(total.nativeAmount),
    valuedLines: total.valuedLines,
    unvaluedLines: total.unvaluedLines,
    fxMissingLines: total.fxMissingLines,
    fxProvisionalLines: total.fxProvisionalLines,
    unvaluedQuantity: formatDec(total.unvaluedQuantity),
    unvaluedSeconds: formatDec(total.unvaluedSeconds),
    status: total.status,
    reasons: total.reasons,
    fxRateIds: total.fxRateIds,
  };
}

/**
 * Writes a run's normalized line valuations and its valuation totals (plan 2.6 step 3), bulk-inserted in
 * the run's transaction after the lines; returns the number of valued line views.
 */
export async function writeRunValuations(
  manager: EntityManager,
  scope: RunScope,
  run: {
    lines: readonly LossLineDraft[];
    ids: readonly string[];
    valuations: readonly LineValuation[];
    context: ValuationContext;
  },
): Promise<number> {
  const { lines, ids, valuations, context } = run;
  await insertAll(
    manager,
    LossLineValuation,
    lineRows(scope, lines, ids, valuations),
  );
  const totals = valuationTotals(
    lines.map((line, i) => ({
      sliceId: line.sliceId,
      ledger: line.ledger,
      kind: line.kind,
      uom: line.uom,
      quantity: line.quantity,
      impactCodeId: line.cause?.impactCodeId ?? null,
      valuation: valuations[i],
    })),
    context.policy,
  );
  await insertAll(
    manager,
    PeriodValuationTotal,
    totals.map((t) => totalRow(scope, t)),
  );
  return valuations.reduce(
    (n, v) => n + v.views.filter((view) => view.status === 'valued').length,
    0,
  );
}
