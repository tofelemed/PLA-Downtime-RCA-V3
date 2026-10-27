import { Dec, ZERO } from '../../domain/actuals/decimal';
import {
  LossStatementView,
  PeriodStatement,
  STATEMENT_FIGURES,
  StatementFigures,
  statementView,
} from './loss-statement';

/** Running total of the statements of several periods (a day, a window). */
export interface StatementSum {
  figures: Record<keyof StatementFigures, Dec>;
  uoms: Set<string>;
  included: number;
  /** periods left out: no shown revision or run, or a figure unknown (no target / actuals) */
  incomplete: number;
  provisional: boolean;
  recoveryVerified: boolean;
}

export function statementSum(): StatementSum {
  const figures = Object.fromEntries(
    STATEMENT_FIGURES.map((key) => [key, ZERO]),
  ) as Record<keyof StatementFigures, Dec>;
  return {
    figures,
    uoms: new Set(),
    included: 0,
    incomplete: 0,
    provisional: false,
    recoveryVerified: true,
  };
}

/** True when the statement's plan identity is computable (planned, actual, shortfall and unaccounted known). */
export function isComplete(statement: PeriodStatement): boolean {
  const f = statement.figures;
  return (
    f.planned !== null &&
    f.actual !== null &&
    f.shortfall !== null &&
    f.unaccounted !== null
  );
}

/** Adds a period's statement to the total; a missing or incomplete one is counted, never summed as zero. */
export function addStatement(
  sum: StatementSum,
  statement: PeriodStatement | null,
): void {
  if (!statement || !isComplete(statement)) {
    sum.incomplete += 1;
    return;
  }
  for (const key of STATEMENT_FIGURES) {
    sum.figures[key] = sum.figures[key].plus(statement.figures[key] ?? ZERO);
  }
  sum.uoms.add(statement.uom ?? '');
  sum.included += 1;
  sum.provisional ||= statement.revisionState === 'provisional';
  sum.recoveryVerified &&= statement.recoveryVerified;
}

/**
 * The total as a statement; null when no period is included or the periods are in different units of
 * measure (never summed together, the caller notes `uom_mixed`).
 */
export function sumView(sum: StatementSum): LossStatementView | null {
  if (sum.included === 0 || sum.uoms.size > 1) return null;
  const [uom] = [...sum.uoms];
  return statementView({
    figures: sum.figures,
    uom: uom || null,
    recoveryVerified: sum.recoveryVerified,
    revisionState: sum.provisional ? 'provisional' : 'approved',
  });
}
