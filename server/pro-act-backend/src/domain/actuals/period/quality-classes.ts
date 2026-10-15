import { clip } from '../../time/interval-algebra';
import { Dec, formatDec, secondsBetween, ZERO } from '../decimal';
import { PeriodFinding, Window } from './period-actuals.types';

/**
 * SME E3 (good-output boundary and product disposition): what an approved lot disposition says about a
 * quantity. First-pass good is never recorded — it is what the production boundary measured less the
 * non-conforming classes. `wide_spec` is an intentional wide-spec grade (ordered, conforming: it stays
 * good, reported apart); `downgrade`, `transition_off_grade`, `scrap` and `rework` are first-pass
 * defects; `recovered` is a recovery movement: reprocessed material of an earlier defect coming back
 * as saleable output, which neither erases that defect nor counts as new output.
 */
export const DISPOSITION_CLASSES = [
  'wide_spec',
  'downgrade',
  'transition_off_grade',
  'scrap',
  'rework',
  'recovered',
] as const;
export type DispositionClass = (typeof DISPOSITION_CLASSES)[number];

/** First-pass defects (non-conforming at the first pass), in the order quality loss is classified. */
export const NON_CONFORMING_CLASSES = [
  'scrap',
  'downgrade',
  'transition_off_grade',
  'rework',
] as const;
export type NonConformingClass = (typeof NON_CONFORMING_CLASSES)[number];

/** Classes a recovery movement may recover from (scrap is gone; wide-spec is good already). */
export const RECOVERABLE_CLASSES: readonly DispositionClass[] = [
  'downgrade',
  'transition_off_grade',
  'rework',
];

/** Line flag of a quality loss line naming its disposition class. */
export const qualityClassFlag = (value: string) => `quality_class:${value}`;

/** An approved lot disposition (or recovery movement) of the slice's product, as the engine reads it. */
export interface LotDispositionInput {
  id: string;
  /** production interval of the lot — of the reprocessing for a recovery — half-open; never the lab release */
  start: Date;
  end: Date;
  dispositionClass: DispositionClass;
  quantity: Dec;
  uom: string | null;
  /** recovery only: the reprocessed material passed this unit's production boundary again */
  remeasured: boolean;
}

/** Σ quantity per class aligned to a slice window (time share of each lot interval inside it). */
export interface AlignedDispositions {
  byClass: Record<DispositionClass, Dec>;
  /** recovered material measured again at the boundary: excluded from net gross and from good */
  reprocessedInput: Dec;
  ids: string[];
}

const norm = (value: string | null) =>
  value?.replace(/\s+/g, '').toLowerCase() ?? '';

function emptyClasses(): Record<DispositionClass, Dec> {
  return Object.fromEntries(
    DISPOSITION_CLASSES.map((c) => [c, ZERO]),
  ) as Record<DispositionClass, Dec>;
}

/** Part of a lot's quantity inside the window, by the time share of its production interval. */
function quantityInside(lot: LotDispositionInput, window: Window): Dec {
  const part = clip(
    { start: lot.start, end: lot.end },
    { start: window.from, end: window.to },
  );
  if (!part) return ZERO;
  const whole = secondsBetween(lot.start.getTime(), lot.end.getTime());
  if (whole.lte(ZERO)) return ZERO;
  const inside = secondsBetween(part.start.getTime(), part.end.getTime());
  return lot.quantity.mul(inside).div(whole);
}

/**
 * The slice's share of each disposition (E3: aligned to the lot's production interval, not to when the
 * lab released it). A lot in another unit than the slice is skipped with `disposition_uom_mismatch`
 * (units are never converted).
 */
export function alignDispositions(
  lots: readonly LotDispositionInput[],
  window: Window,
  uom: string | null,
  findings: PeriodFinding[],
): AlignedDispositions | null {
  if (lots.length === 0) return null;
  const byClass = emptyClasses();
  let reprocessedInput = ZERO;
  const ids: string[] = [];
  for (const lot of lots) {
    const quantity = quantityInside(lot, window);
    if (quantity.lte(ZERO)) continue;
    if (uom && lot.uom && norm(uom) !== norm(lot.uom)) {
      findings.push({
        code: 'disposition_uom_mismatch',
        severity: 'problem',
        detail: { dispositionId: lot.id, sliceUom: uom, lotUom: lot.uom },
      });
      continue;
    }
    ids.push(lot.id);
    byClass[lot.dispositionClass] =
      byClass[lot.dispositionClass].plus(quantity);
    if (lot.dispositionClass === 'recovered' && lot.remeasured)
      reprocessedInput = reprocessedInput.plus(quantity);
  }
  return ids.length === 0 ? null : { byClass, reprocessedInput, ids };
}

/** Σ first-pass defects of the aligned dispositions. */
export function nonConforming(aligned: AlignedDispositions): Dec {
  return NON_CONFORMING_CLASSES.reduce(
    (sum, c) => sum.plus(aligned.byClass[c]),
    ZERO,
  );
}

/** The persisted class breakdown of a slice (`actuals_results.quality_classes`), decimal strings. */
export interface QualityClasses {
  /** first-pass conforming output of the prime grade: good − wide spec */
  firstPassGood: string | null;
  wideSpec: string;
  downgrade: string;
  transitionOffGrade: string;
  scrap: string;
  rework: string;
  /** non-conforming output no disposition classifies (rejects − Σ classes); null when rejects unknown */
  unclassified: string | null;
  /** saleable output recovered from earlier defects (recovery movements and approved rework acceptance) */
  recovered: string;
  /** recovered material measured again at the boundary, taken out of gross and good */
  reprocessedInput: string;
  dispositionIds: string[];
}

export interface ClassTotals {
  good: Dec | null;
  reject: Dec | null;
  reworkAccepted: Dec | null;
}

const fmt = (value: Dec) => formatDec(value);

/** Rejects no class explains (never negative: classes beyond the rejects are a finding, not a credit). */
function unclassifiedOf(reject: Dec | null, defects: Dec): string | null {
  if (reject === null) return null;
  const rest = reject.minus(defects);
  return fmt(rest.isNegative() ? ZERO : rest);
}

/** The breakdown of a slice from its aligned dispositions and its final good / rejects. */
export function qualityClassesOf(
  aligned: AlignedDispositions | null,
  totals: ClassTotals,
): QualityClasses | null {
  if (!aligned && totals.reworkAccepted === null) return null;
  const by = aligned?.byClass ?? emptyClasses();
  const defects = aligned ? nonConforming(aligned) : ZERO;
  const recovered = by.recovered.plus(totals.reworkAccepted ?? ZERO);
  return {
    firstPassGood:
      totals.good === null ? null : fmt(totals.good.minus(by.wide_spec)),
    wideSpec: fmt(by.wide_spec),
    downgrade: fmt(by.downgrade),
    transitionOffGrade: fmt(by.transition_off_grade),
    scrap: fmt(by.scrap),
    rework: fmt(by.rework),
    unclassified: unclassifiedOf(totals.reject, defects),
    recovered: fmt(recovered),
    reprocessedInput: fmt(aligned?.reprocessedInput ?? ZERO),
    dispositionIds: aligned?.ids ?? [],
  };
}
