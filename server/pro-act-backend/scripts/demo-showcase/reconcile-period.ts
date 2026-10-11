/**
 * Reconciles one production period through the review API: the engineer decides every loss candidate
 * (losses with a cause event first, then the unattributed remainder, capped at the plan gap: plans are set
 * below capacity), books any gap left as an unrecorded speed loss (coded, no event) and saves the draft; then submit, and approve or reject by a
 * manager who did not submit. Quantities use exact decimals because the plant's tolerance is zero.
 */
import { formatDec, parseDec } from './fixed-decimal';
import { PersonaSession } from './showcase-client';

interface Slice {
  sliceId: string;
  gap: string | null;
  target: string | null;
}

interface Candidate {
  autoKey: string;
  sliceId: string;
  kind: string;
  quantity: string;
  /** null for the unattributed remainder of a component */
  causeEventId: string | null;
}

export interface ReconciliationView {
  rowVersion: number;
  baseRunId: string | null;
  contentHash: string;
  revision: {
    revision: number;
    lifecycle: string;
    submittedHash: string | null;
    submittedBy: string | null;
    rejectedBy: string | null;
  };
  publishedRevision: { lifecycle?: string } | null;
  slices: Slice[];
  candidates: Candidate[];
  lines: unknown[];
}

export type Outcome = 'approved' | 'in_review' | 'rejected' | 'draft';

export interface ReconcileInput {
  engineer: PersonaSession;
  manager: PersonaSession;
  periodId: string;
  outcome: Outcome;
  speedReasonId: string;
  rejectReason?: string;
}

const view = (session: PersonaSession, periodId: string) =>
  session.get<ReconciliationView>(
    `/v2/production-periods/${periodId}/reconciliation`,
  );

/** Decision lines of one slice: candidates in descending size until the gap is used, then a speed line. */
function sliceLines(
  slice: Slice,
  candidates: Candidate[],
  speedReasonId: string,
): Record<string, unknown>[] {
  let remaining = parseDec(slice.gap);
  const lines: Record<string, unknown>[] = [];
  // losses with a cause event first (largest first), the unattributed remainder last
  const sorted = [...candidates].sort(
    (a, b) =>
      Number(a.causeEventId === null) - Number(b.causeEventId === null) ||
      Number(parseDec(b.quantity) - parseDec(a.quantity)),
  );
  for (const candidate of sorted) {
    const quantity = parseDec(candidate.quantity);
    if (quantity <= remaining) {
      lines.push({ action: 'accept', autoKey: candidate.autoKey });
      remaining -= quantity;
    } else if (remaining > 0n) {
      lines.push({
        action: 'adjust',
        autoKey: candidate.autoKey,
        quantity: formatDec(remaining),
        reason:
          'Capped at the plan gap: the shift plan is set below the planning capacity',
      });
      remaining = 0n;
    } else {
      lines.push({
        action: 'reject',
        autoKey: candidate.autoKey,
        reason: 'Already covered by larger losses of the shift',
      });
    }
  }
  if (remaining > 0n) {
    lines.push({
      action: 'manual',
      sliceId: slice.sliceId,
      kind: 'performance',
      quantity: formatDec(remaining),
      missingEvent: true,
      reasonCodeId: speedReasonId,
      comment:
        'Unrecorded speed loss: the line ran below the planning rate between stops',
    });
  }
  return lines;
}

async function decide(
  input: ReconcileInput,
  outcome: 'approved' | 'rejected',
): Promise<string> {
  const { manager, periodId } = input;
  const submitted = await view(manager, periodId);
  const { revision, submittedHash } = submitted.revision;
  // the row version is part of the command name: a repeated decision on a new state is a new command
  const key = `${outcome} ${periodId} ${revision} ${submitted.rowVersion}`;
  if (outcome === 'rejected') {
    const reason = input.rejectReason ?? 'Please review the loss lines';
    await manager.post(
      `/v2/production-periods/${periodId}/reject`,
      { revision, reason },
      key,
    );
    return 'rejected';
  }
  const comment = 'Approved in the daily production meeting';
  await manager.post(
    `/v2/production-periods/${periodId}/approve`,
    { revision, submittedHash, comment },
    key,
  );
  return 'approved';
}

/** Returns the outcome reached, `kept:<state>` when the period already got its outcome, or not_ready. */
export async function reconcilePeriod(input: ReconcileInput): Promise<string> {
  const { engineer, periodId, outcome } = input;
  let current = await view(engineer, periodId);
  const { lifecycle, rejectedBy } = current.revision;
  if (
    lifecycle === 'in_review' &&
    (outcome === 'approved' || outcome === 'rejected')
  ) {
    return decide(input, outcome);
  }
  if (lifecycle !== 'draft') return `kept:${lifecycle}`;
  if (outcome === 'rejected' && rejectedBy) return 'kept:rejected';
  if (!current.baseRunId || current.slices.some((s) => s.gap === null))
    return 'not_ready';
  if (outcome === 'draft' && current.lines.length > 0) return 'kept:draft';
  const lines = current.slices.flatMap((slice) =>
    sliceLines(
      slice,
      current.candidates.filter((c) => c.sliceId === slice.sliceId),
      input.speedReasonId,
    ),
  );
  const saved = await engineer.call<ReconciliationView>(
    'PUT',
    `/v2/production-periods/${periodId}/draft-lines`,
    {
      revision: current.revision.revision,
      baseRunId: current.baseRunId,
      lines,
    },
    { ifMatch: current.rowVersion },
  );
  current = saved.body;
  if (outcome === 'draft') return 'draft';
  await engineer.post(
    `/v2/production-periods/${periodId}/submit`,
    {
      revision: current.revision.revision,
      runId: current.baseRunId,
      contentHash: current.contentHash,
      comment: 'Shift losses reviewed with the shift supervisor',
    },
    `submit ${periodId} ${current.contentHash} ${current.rowVersion}`,
  );
  return outcome === 'in_review' ? 'in_review' : decide(input, outcome);
}
