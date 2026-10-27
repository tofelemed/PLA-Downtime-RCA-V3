import { EntityManager } from 'typeorm';
import {
  candidatesOf,
  decisionLinesOf,
  RevisionState,
} from '../../reconciliation/revision-state';
import { LossStatementView, statementView } from './loss-statement';
import { runStatementLines, statementOfRevision } from './statement-sources';

/**
 * The loss accounting statement (Task 13) of the revision the period page shows: its reconciled plan ledger
 * plus the run's recovery, transition and classified lines; null without a run.
 */
export async function revisionStatement(
  manager: EntityManager,
  state: RevisionState,
): Promise<LossStatementView | null> {
  const runId = state.run?.id ?? null;
  const runLines = await runStatementLines(
    manager,
    state.period.tenantId,
    runId ? [runId] : [],
  );
  const statement = statementOfRevision(
    {
      revision: state.revision,
      runId,
      candidates: candidatesOf(state.candidateLines),
      lines: decisionLinesOf(state.lines),
      reconciliation: state.reconciliation,
    },
    runLines,
  );
  return statement ? statementView(statement) : null;
}
