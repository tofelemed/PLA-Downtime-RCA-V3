import { Dec, formatDec, toDec, ZERO } from '../actuals/decimal';

/** The figures of one reviewed revision that a restatement compares (decimal strings, null = unknown). */
export interface ReviewedFigures {
  slices: ReadonlyArray<{
    uom: string | null;
    target: string | null;
    actual: string | null;
    gap: string | null;
    attributed: string | null;
    toleranceAdjustment: string | null;
    residual: string | null;
  }>;
  actuals: ReadonlyArray<{
    uom: string | null;
    gross: string | null;
    good: string | null;
    reject: string | null;
  }>;
  /** accepted candidates at their effective quantity and the manual / tolerance lines */
  lines: ReadonlyArray<{
    kind: string;
    reasonCodeId: string | null;
    uom: string | null;
    quantity: string | null;
  }>;
}

/** Old and new value of one figure and the change (new − old); null when either side is unknown. */
export interface DeltaFigure {
  old: string | null;
  new: string | null;
  delta: string | null;
}

export interface TotalsDelta {
  uom: string | null;
  figures: Record<string, DeltaFigure>;
}

export interface LineDelta extends DeltaFigure {
  kind: string;
  reasonCodeId: string | null;
  uom: string | null;
}

export interface RestatementDelta {
  totals: TotalsDelta[];
  actuals: TotalsDelta[];
  lines: LineDelta[];
}

const SLICE_FIGURES = [
  'target',
  'actual',
  'gap',
  'attributed',
  'toleranceAdjustment',
  'residual',
] as const;
const ACTUAL_FIGURES = ['gross', 'good', 'reject'] as const;

type Sum = Dec | null;

/** Σ of a figure; one unknown value makes the sum unknown (never a silent 0). */
function sumOf(values: ReadonlyArray<string | null>): Sum {
  let total: Dec = ZERO;
  for (const value of values) {
    const parsed = toDec(value);
    if (parsed === null) return null;
    total = total.plus(parsed);
  }
  return total;
}

function figure(oldValue: Sum, newValue: Sum): DeltaFigure {
  return {
    old: oldValue === null ? null : formatDec(oldValue),
    new: newValue === null ? null : formatDec(newValue),
    delta:
      oldValue === null || newValue === null
        ? null
        : formatDec(newValue.minus(oldValue)),
  };
}

const uomKey = (uom: string | null) => uom ?? '';

/** Per unit of measure (never mixed), each figure's old and new sum and the change. */
function totalsBy<R extends { uom: string | null }, F extends string>(
  oldRows: readonly R[],
  newRows: readonly R[],
  figures: readonly F[],
): TotalsDelta[] {
  const uoms = [
    ...new Set([...oldRows, ...newRows].map((r) => uomKey(r.uom))),
  ].sort();
  return uoms.map((uom) => {
    const pick = (rows: readonly R[], f: F) =>
      rows
        .filter((r) => uomKey(r.uom) === uom)
        .map((r) => (r as Record<F, string | null>)[f]);
    const has = (rows: readonly R[]) => rows.some((r) => uomKey(r.uom) === uom);
    return {
      uom: uom === '' ? null : uom,
      figures: Object.fromEntries(
        figures.map((f) => [
          f,
          figure(
            has(oldRows) ? sumOf(pick(oldRows, f)) : ZERO,
            has(newRows) ? sumOf(pick(newRows, f)) : ZERO,
          ),
        ]),
      ),
    };
  });
}

const lineKey = (l: ReviewedFigures['lines'][number]) =>
  `${l.kind}|${l.reasonCodeId ?? ''}|${uomKey(l.uom)}`;

/** Lines grouped by kind, reason code and unit of measure — a line that only one side has counts 0 on the other. */
function linesDelta(
  oldLines: ReviewedFigures['lines'],
  newLines: ReviewedFigures['lines'],
): LineDelta[] {
  const keys = new Map<string, ReviewedFigures['lines'][number]>();
  for (const line of [...oldLines, ...newLines]) keys.set(lineKey(line), line);
  return [...keys.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, sample]) => {
      const of = (lines: ReviewedFigures['lines']) =>
        sumOf(lines.filter((l) => lineKey(l) === key).map((l) => l.quantity));
      return {
        kind: sample.kind,
        reasonCodeId: sample.reasonCodeId,
        uom: sample.uom,
        ...figure(of(oldLines), of(newLines)),
      };
    })
    .filter((line) => line.delta !== '0');
}

/**
 * SME R5: what a restatement changes — the plan-ledger totals and the actuals per unit of measure, and
 * the loss lines by kind and reason (unchanged lines left out), old (the superseded approved revision) vs
 * new. Worked example: 5 t of good reclassified as off-grade shows good −5 and a quality line +5, the
 * gross (the total mass) unchanged.
 */
export function restatementDelta(
  oldFigures: ReviewedFigures,
  newFigures: ReviewedFigures,
): RestatementDelta {
  return {
    totals: totalsBy(oldFigures.slices, newFigures.slices, SLICE_FIGURES),
    actuals: totalsBy(oldFigures.actuals, newFigures.actuals, ACTUAL_FIGURES),
    lines: linesDelta(oldFigures.lines, newFigures.lines),
  };
}
