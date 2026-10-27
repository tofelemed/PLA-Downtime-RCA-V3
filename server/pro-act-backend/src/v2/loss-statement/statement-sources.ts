import { EntityManager } from 'typeorm';
import { AccountingRevision } from '../../accounting/entities/accounting-revision.entity';
import { LossKind } from '../../domain/accounting/accounting.types';
import { toDec } from '../../domain/actuals/decimal';
import {
  Candidate,
  DecisionLine,
  Reconciliation,
} from '../../domain/reconciliation/reconciliation.types';
import { PeriodState } from '../period-overview/period-states';
import { KindAmount, PeriodStatement, periodStatement } from './loss-statement';

/** Kinds of the run's automatic plan lines that are not reconciliation candidates but enter the statement. */
const RUN_ONLY_KINDS = [
  'gain',
  'unaccounted_classified',
  'transition_excess',
  'transition_allowance',
];

/**
 * Per run: Σ quantity of its automatic plan lines of `RUN_ONLY_KINDS` by kind, and whether a declared
 * recovery share (gain line on the declared basis) has a cause event whose coding is not verified yet.
 * One grouped statement for a whole page of runs (`IDX_loss_lines_run_ledger_kind`).
 */
const RUN_LINES_SQL = `SELECT l."run_id" AS "runId", l."kind"::text AS "kind", SUM(l."quantity")::text AS "quantity",
       BOOL_OR(l."kind" = 'gain' AND l."basis" = 'declared' AND e."verified_at" IS NULL) AS "unverified"
  FROM "loss_lines" l
  LEFT JOIN "production_events" e ON e."tenant_id" = l."tenant_id" AND e."id" = l."cause_event_id"
 WHERE l."tenant_id" = $1 AND l."run_id" = ANY($2::uuid[]) AND l."ledger" = 'plan' AND l."source" = 'auto'
   AND l."kind" = ANY($3::"loss_line_kind"[])
 GROUP BY l."run_id", l."kind"`;

export interface RunStatementLines {
  lines: Map<string, KindAmount[]>;
  /** runs with a declared recovery share whose event coding is not verified */
  unverified: Set<string>;
}

export async function runStatementLines(
  manager: EntityManager,
  tenantId: string,
  runIds: readonly string[],
): Promise<RunStatementLines> {
  const result: RunStatementLines = { lines: new Map(), unverified: new Set() };
  const ids = [...new Set(runIds)];
  if (ids.length === 0) return result;
  const rows = await manager.query<
    Array<{
      runId: string;
      kind: string;
      quantity: string;
      unverified: boolean;
    }>
  >(RUN_LINES_SQL, [tenantId, ids, RUN_ONLY_KINDS]);
  for (const row of rows) {
    const quantity = toDec(row.quantity);
    if (!quantity) continue;
    const amount: KindAmount = { kind: row.kind as LossKind, quantity };
    result.lines.set(row.runId, [
      ...(result.lines.get(row.runId) ?? []),
      amount,
    ]);
    if (row.unverified) result.unverified.add(row.runId);
  }
  return result;
}

/** What a reconciled revision gives the statement (a page's period state or the editor's revision state). */
export interface RevisionStatementInput {
  revision: Pick<AccountingRevision, 'lifecycle'> | null;
  runId: string | null;
  candidates: readonly Candidate[];
  lines: readonly DecisionLine[];
  reconciliation: Reconciliation | null;
}

/** The statement of a period's shown revision; null without a run or reconciliation (nothing to state yet). */
export function statementOfRevision(
  input: RevisionStatementInput,
  runLines: RunStatementLines,
): PeriodStatement | null {
  if (!input.runId || !input.reconciliation) return null;
  return periodStatement({
    candidates: input.candidates,
    lines: input.lines,
    reconciliation: input.reconciliation,
    runLines: runLines.lines.get(input.runId) ?? [],
    recoveryVerified: !runLines.unverified.has(input.runId),
    revisionState:
      input.revision?.lifecycle === 'approved' ? 'approved' : 'provisional',
  });
}

/** The statement of a period state (`loadPeriodStates`). */
export function statementOfState(
  state: PeriodState,
  runLines: RunStatementLines,
): PeriodStatement | null {
  return statementOfRevision(
    {
      revision: state.revision,
      runId: state.run?.id ?? null,
      candidates: state.candidates,
      lines: state.lines,
      reconciliation: state.reconciliation,
    },
    runLines,
  );
}

/** Loads the run lines of a page of period states (one query) and states each period. */
export async function statementsOfStates(
  manager: EntityManager,
  tenantId: string,
  states: readonly PeriodState[],
): Promise<Array<PeriodStatement | null>> {
  const runIds = states.flatMap((s) => (s.run ? [s.run.id] : []));
  const runLines = await runStatementLines(manager, tenantId, runIds);
  return states.map((state) => statementOfState(state, runLines));
}
