import { EntityManager } from 'typeorm';
import { Dec } from '../domain/actuals/decimal';
import { WorkflowIssue } from '../domain/reconciliation/reconciliation.types';
import { AccountingPoliciesService } from '../periods/accounting-policies.service';
import { RevisionState, decOf } from './revision-state';

const issue = (
  code: string,
  message: string,
  sliceId: string | null = null,
): WorkflowIssue => ({ code, message, sliceId });

/**
 * A validated run without an active product slice computed nothing: whatever the loss basis (a run resolved
 * before the period's policy existed carries none), such a period is never submittable.
 */
function noComputableSlice(
  state: Pick<RevisionState, 'slices'>,
): WorkflowIssue | null {
  if (state.slices.length > 0) return null;
  return issue(
    'NO_COMPUTABLE_SLICE',
    'The calculation produced no computable slice; fix the period setup (see its warnings) and recompute before submitting.',
  );
}

/** The current run exists, is validated and computed a slice (only the first failing condition is blamed). */
export function runIssues(
  state: Pick<RevisionState, 'run' | 'slices'>,
): WorkflowIssue[] {
  if (!state.run)
    return [issue('NO_CALCULATION_RUN', 'the revision has no calculation run')];
  if (state.run.status !== 'validated')
    return [
      issue('RUN_NOT_VALIDATED', `the current run is ${state.run.status}`),
    ];
  const empty = noComputableSlice(state);
  return empty ? [empty] : [];
}

async function pendingIssues(
  manager: EntityManager,
  periodId: string,
): Promise<WorkflowIssue[]> {
  const rows: Array<{ count: number }> = await manager.query(
    `SELECT count(*)::int AS "count" FROM "actuals_jobs"
      WHERE "period_id" = $1 AND "kind" = 'recompute' AND "state" IN ('queued', 'running')`,
    [periodId],
  );
  return rows[0].count > 0
    ? [
        issue(
          'RECALCULATION_PENDING',
          'a recalculation of the period is queued or running',
        ),
      ]
    : [];
}

/** Coverage gate (D05) and source conflicts of the run's actuals, per plan slice. */
async function actualsIssues(
  manager: EntityManager,
  state: RevisionState,
  policies: AccountingPoliciesService,
): Promise<WorkflowIssue[]> {
  const { period } = state;
  const resolved = await policies.resolve(
    manager,
    { tenantId: period.tenantId, unitId: period.unitId },
    period.utcStart,
  );
  const required = new Dec(resolved.coverageGate.requiredCoverageRatio);
  const planSlices = state.reconciliation.slices.filter(
    (s) => s.target !== null,
  );
  return planSlices.flatMap((slice): WorkflowIssue[] => {
    const result = state.actuals.find((a) => a.sliceId === slice.sliceId);
    const coverage = result ? decOf(result.coverageRatio) : null;
    if (result?.qualityState === 'conflict') {
      return [
        issue('SOURCE_CONFLICT', 'the actuals sources conflict', slice.sliceId),
      ];
    }
    if (!result || coverage === null || coverage.lt(required)) {
      return [
        issue(
          'ACTUALS_INCOMPLETE',
          `actuals coverage is below the required ${required.toString()}`,
          slice.sliceId,
        ),
      ];
    }
    return [];
  });
}

/** Open review items (late corrections, conflicts) on any evidence event of the reconciliation. */
async function reviewIssues(
  manager: EntityManager,
  state: RevisionState,
): Promise<WorkflowIssue[]> {
  const events = new Set<string>();
  for (const line of state.candidateLines) {
    if (line.causeEventId) events.add(line.causeEventId);
  }
  for (const line of state.lines) {
    for (const ref of line.evidence) events.add(ref.eventId);
  }
  if (events.size === 0) return [];
  const rows: Array<{ event_id: string }> = await manager.query(
    `SELECT DISTINCT "event_id" FROM "event_review_items"
      WHERE "tenant_id" = $1 AND "state" = 'open' AND "event_id" = ANY($2::uuid[])`,
    [state.period.tenantId, [...events]],
  );
  return rows.map((row) =>
    issue(
      'OPEN_REVIEW_ITEMS',
      `evidence event ${row.event_id} has an open review item`,
    ),
  );
}

/**
 * Gates of submission that depend on more than the reconciliation arithmetic (ACC10, WF02): a validated
 * current run with a computable slice, no queued or running recalculation, actuals meeting the coverage
 * gate without a source conflict, and no open review item on an evidence event. In declared mode the actual is the production
 * loss event's figure, not a measurement: the coverage gate does not apply (`DECLARED_LOSS_MISSING`
 * covers a missing event).
 */
export async function environmentIssues(
  manager: EntityManager,
  state: RevisionState,
  policies: AccountingPoliciesService,
): Promise<WorkflowIssue[]> {
  return [
    ...runIssues(state),
    ...(await pendingIssues(manager, state.period.id)),
    ...(state.lossBasis === 'declared'
      ? []
      : await actualsIssues(manager, state, policies)),
    ...(await reviewIssues(manager, state)),
  ];
}
