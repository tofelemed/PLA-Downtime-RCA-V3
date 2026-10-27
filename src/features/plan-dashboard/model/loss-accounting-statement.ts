import type { LossStatementView } from '@/api/v2/types/loss-statement';

/** One row of the loss accounting statement as it is shown: label, plain-words ⓘ, server figure, sign. */
export interface StatementRow {
  key: keyof LossStatementView;
  label: string;
  info: string;
  /** the server's decimal string; null = unknown (never shown as 0) */
  value: string | null;
  /** the recovery is a positive figure the statement subtracts: shown as −8 */
  negative?: boolean;
  /** a total of the rows above it (Gross attributed, Net accounted) */
  total?: boolean;
}

/** Rows shown only when not zero, so the owner's table stays exactly as agreed. */
const OPTIONAL_ROWS: ReadonlySet<keyof LossStatementView> = new Set(['transitionExcess', 'unaccountedClassified', 'toleranceAdjustment']);

const isZero = (value: string | null) => value !== null && Number(value) === 0;

/** "Verified recovery" once the event coding is verified by a supervisor, else "Recovery (unverified)" (the figure does not change). */
export function recoveryLabel(statement: LossStatementView): string {
  return statement.recoveryVerified ? 'Verified recovery' : 'Recovery (unverified)';
}

/**
 * The statement rows in the owner's order (Task 13, 27 Oct 2026). Transition loss, classified unaccounted
 * loss and the tolerance adjustment are rows only when they are not zero; every figure is the server's.
 */
export function statementRows(statement: LossStatementView): StatementRow[] {
  const s = statement;
  const rows: StatementRow[] = [
    { key: 'planned', label: 'Planned production', info: 'What the plan (or the OT system) expected the unit to produce in this time.', value: s.planned },
    { key: 'actual', label: 'Actual good production', info: 'What the unit actually produced to specification.', value: s.actual },
    { key: 'shortfall', label: 'Production shortfall', info: 'Planned minus actual: the production that is missing and must be explained.', value: s.shortfall },
    { key: 'availability', label: 'Equipment downtime loss', info: 'Production lost while equipment was stopped (availability).', value: s.availability },
    { key: 'performance', label: 'Reduced throughput loss', info: 'Production lost while the unit ran slower than planned (performance).', value: s.performance },
    { key: 'quality', label: 'Quality loss', info: 'Production made off-specification, scrapped or downgraded.', value: s.quality },
    { key: 'transitionExcess', label: 'Transition loss', info: 'Production lost to grade or product changes beyond their standard.', value: s.transitionExcess },
    { key: 'unaccountedClassified', label: 'Classified as unaccounted', info: 'Loss explicitly labelled unaccounted: a label, not a proven cause.', value: s.unaccountedClassified },
    { key: 'grossAttributed', label: 'Gross attributed loss', info: 'All the loss given a cause, before any recovery.', value: s.grossAttributed, total: true },
    { key: 'recovery', label: recoveryLabel(s), info: 'Production recovered (for example catching up later in the day); it offsets the losses. Unverified until a supervisor verifies the event coding.', value: s.recovery, negative: true },
    { key: 'netAccounted', label: 'Net accounted loss', info: 'Gross attributed loss minus the recovery.', value: s.netAccounted, total: true },
    { key: 'toleranceAdjustment', label: 'Tolerance adjustment', info: 'Small differences booked within the reconciliation tolerance.', value: s.toleranceAdjustment },
    { key: 'unaccounted', label: 'Unaccounted loss', info: 'Shortfall nobody has explained yet: shortfall minus net accounted loss and tolerance adjustment.', value: s.unaccounted },
  ];
  return rows.filter((row) => !OPTIONAL_ROWS.has(row.key) || !isZero(row.value));
}

/** The identity line under the statement, with the server's figures already formatted by the caller. */
export function identityText(format: (value: string | null) => string, statement: LossStatementView): string {
  const tolerance = isZero(statement.toleranceAdjustment) ? '' : ` + tolerance adjustment ${format(statement.toleranceAdjustment)}`;
  return (
    `Shortfall ${format(statement.shortfall)} = net accounted ${format(statement.netAccounted)}${tolerance} + unaccounted ${format(statement.unaccounted)}; ` +
    `net accounted = gross attributed ${format(statement.grossAttributed)} − recovery ${format(statement.recovery)}`
  );
}

/** Approved revisions only, else at least one draft: the statement is provisional. */
export function statementMarker(statement: LossStatementView): 'Approved' | 'Provisional' {
  return statement.revisionState === 'approved' ? 'Approved' : 'Provisional';
}
