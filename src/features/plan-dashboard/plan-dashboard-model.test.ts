import { describe, expect, it } from 'vitest';
import { StaleRevisionError, V2ApiError } from '@/api/v2/errors';
import { v2Keys } from '@/api/v2/queries/query-keys';
import type { ReconciliationView } from '@/api/v2/types/reconciliation';
import { reconciliationKey, serverKeyOf } from './hooks/use-draft-editor';
import { approveGate, formatMoney, formatRatioPercent, reviewGate } from './model/display';
import { addManual, decisionProblems, draftFromView, manualProblems, rebaseDraft, removeManual, setDecision, toPayload } from './model/draft-lines';
import { issuesByRow, workflowProblemOf } from './model/workflow-errors';

const candidate = (autoKey: string, quantity = '90') => ({
  lossLineId: `l-${autoKey}`, autoKey, sliceId: 's1', kind: 'availability', quantity, basis: 'planning_rate', reasonCodeId: null, impactCodeId: null,
  causeEventId: 'e1', state: 'proposed' as const, effectiveQuantity: quantity,
});

const line = (overrides: Record<string, unknown>) => ({
  id: 'line-1', position: 0, action: 'manual', autoKey: null, sliceId: 's1', kind: 'availability', quantity: '50', baseQuantity: null, uom: 't', basis: null,
  reasonCodeId: 'r1', impactCodeId: null, evidence: [], adjustmentId: null, missingCode: false, missingEvent: true, reason: null, comment: null, authorId: 'u1', flags: [],
  ...overrides,
});

function view(overrides: Partial<ReconciliationView> = {}): ReconciliationView {
  return {
    periodId: 'p1', unitId: 'unit-1', utcStart: '2026-10-08T06:00:00.000Z', utcEnd: '2026-10-08T14:00:00.000Z', rowVersion: 4,
    revision: {
      id: 'rev-1', revision: 1, lifecycle: 'draft', supersedesId: null, currentRunId: 'run-1', currentLineSetId: 'set-1', isStale: false, staleReason: null,
      submittedBy: null, submittedAt: null, submittedHash: null, submittedRunId: null, approvedBy: null, approvedAt: null, approvalSnapshotId: null,
      rejectedBy: null, rejectedAt: null, rejectReason: null, cancelledBy: null, cancelledAt: null, comment: null,
    },
    publishedRevision: null, baseRunId: 'run-1', contentHash: 'a'.repeat(64),
    tolerance: { policyId: null, version: 1, mode: 'zero', value: 0, epsilon: 0.000001, allowUnaccountedClassification: false },
    slices: [], candidates: [candidate('k1'), candidate('k2', '30')],
    lines: [line({ id: 'd1', action: 'accept', autoKey: 'k1', kind: 'availability', quantity: null, missingEvent: false, reasonCodeId: null }), line({}), line({ id: 't1', action: 'tolerance', kind: 'tolerance_adjustment', quantity: '0.5' })] as ReconciliationView['lines'],
    openProposalId: null,
    ...overrides,
  };
}

describe('draft lines (editing state)', () => {
  it('reads decisions and manual lines from the saved set; tolerance lines are not editable', () => {
    const draft = draftFromView(view());
    expect(draft.decisions).toEqual({ k1: { action: 'accept' } });
    expect(draft.manual).toHaveLength(1);
    expect(draft.manual[0]).toMatchObject({ kind: 'availability', quantity: '50', missingEvent: true, reasonCodeId: 'r1' });
    expect(draft.dirty).toBe(false);
  });

  it('builds the full payload in candidate order then manual lines, with the row of every index', () => {
    let draft = setDecision(draftFromView(view()), 'k2', { action: 'reject', reason: 'other cause' });
    draft = addManual(draft, { sliceId: 's1', kind: 'quality', quantity: '10', eventIds: ['e9'], missingEvent: false, missingCode: false });
    const { lines, refs } = toPayload(draft, view().candidates);
    expect(lines.map((l) => l.action)).toEqual(['accept', 'reject', 'manual', 'manual']);
    expect(lines[1]).toEqual({ action: 'reject', autoKey: 'k2', reason: 'other cause' });
    expect(lines[3]).toEqual({ action: 'manual', sliceId: 's1', kind: 'quality', quantity: '10', eventIds: ['e9'] });
    expect(refs[1]).toEqual({ type: 'decision', autoKey: 'k2' });
    expect(refs[3].type).toBe('manual');
    expect(draft.dirty).toBe(true);
  });

  it('clearing a decision restores the proposed candidate (no line sent); removing a manual line drops it', () => {
    const draft = removeManual(setDecision(draftFromView(view()), 'k1', null), 'line-1');
    expect(toPayload(draft, view().candidates).lines).toEqual([]);
  });

  it('rebase keeps decisions whose candidate still exists and reports the dropped ones', () => {
    const draft = setDecision(draftFromView(view()), 'k2', { action: 'reject', reason: 'x' });
    const next = view({ candidates: [candidate('k2', '35'), candidate('k3')], baseRunId: 'run-2' });
    const rebased = rebaseDraft(draft, next);
    expect(Object.keys(rebased.state.decisions)).toEqual(['k2']);
    expect(rebased.dropped).toEqual(['k1']);
    expect(rebased.state.manual).toHaveLength(1);
  });

  it('flags missing fields before sending (shape only, never budgets)', () => {
    expect(decisionProblems({ action: 'adjust' })).toEqual(['A reason is required.', 'Enter the quantity.']);
    expect(decisionProblems({ action: 'accept' })).toEqual([]);
    expect(manualProblems({ uid: 'x', sliceId: 's1', kind: 'availability', quantity: null, eventIds: [], missingEvent: true, missingCode: false })).toHaveLength(2);
    const bridge = { uid: 'b', sliceId: 's1', kind: 'bridge' as const, quantity: '-20', eventIds: [], missingEvent: true, missingCode: true };
    expect(manualProblems(bridge)).toEqual(['A bridge needs a written reason.']);
    expect(manualProblems({ ...bridge, reason: 'plan rate below planning rate' })).toEqual([]);
  });
});

describe('workflow problems (conflict handling)', () => {
  const envelope = (code: string, message = code, details?: Record<string, unknown>) => ({ code, message, correlationId: 'c1', retryable: false, ...(details ? { details } : {}) });

  it('RUN_CHANGED carries the candidate diff for the dialog', () => {
    const problem = workflowProblemOf(new V2ApiError(409, envelope('RUN_CHANGED', 'run changed', { currentRunId: 'run-2', added: ['k3'], removed: ['k1'], changed: [{ autoKey: 'k2', before: '30', after: '35' }] })));
    expect(problem?.kind).toBe('run_changed');
    expect(problem?.diff).toEqual({ currentRunId: 'run-2', added: ['k3'], removed: ['k1'], changed: [{ autoKey: 'k2', before: '30', after: '35' }] });
  });

  it('412 is a stale revision; 403 SEPARATION_OF_DUTIES and 409 STALE_SUBMISSION keep their codes', () => {
    expect(workflowProblemOf(new StaleRevisionError(envelope('STALE_REVISION'), 5))?.kind).toBe('stale_revision');
    expect(workflowProblemOf(new V2ApiError(403, envelope('SEPARATION_OF_DUTIES')))?.kind).toBe('duties');
    expect(workflowProblemOf(new V2ApiError(409, envelope('STALE_SUBMISSION')))?.kind).toBe('stale_submission');
    expect(workflowProblemOf(new TypeError('fetch failed'))?.kind).toBe('network');
  });

  it('422 line issues land on the editor row of their payload index with the server budget', () => {
    const error = new V2ApiError(422, envelope('ALLOCATION_EXCEEDED', 'line 1: over budget', { issues: [{ code: 'ALLOCATION_EXCEEDED', message: 'line 1: over budget', sliceId: 's1', line: 1, expectedRemainingAllocation: '10' }] }));
    const problem = workflowProblemOf(error);
    expect(problem?.kind).toBe('line_issues');
    const rows = issuesByRow(problem?.issues ?? [], [{ type: 'decision', autoKey: 'k1' }, { type: 'manual', uid: 'm1' }]);
    expect(rows.get('manual:m1')?.[0]).toMatchObject({ code: 'ALLOCATION_EXCEEDED', expectedRemainingAllocation: '10' });
  });

  it('submission gates without line indexes are a gate list (MISSING_CODE, RESIDUAL_UNEXPLAINED)', () => {
    const error = new V2ApiError(422, envelope('MISSING_CODE', 'uncoded', { issues: [{ code: 'MISSING_CODE', message: 'uncoded', sliceId: 's1' }, { code: 'RESIDUAL_UNEXPLAINED', message: 'residual 10', sliceId: 's1' }] }));
    const problem = workflowProblemOf(error);
    expect(problem?.kind).toBe('gates');
    expect(problem?.issues.map((i) => i.code)).toEqual(['MISSING_CODE', 'RESIDUAL_UNEXPLAINED']);
  });
});

describe('display formatting and gates', () => {
  it('formats money per currency from decimal strings and names why an amount is missing', () => {
    expect(formatMoney({ currency: 'USD', amount: '1234.565', nativeAmount: '0', status: 'valued', reasons: [] })).toBe('1,234.57 USD');
    expect(formatMoney({ currency: 'IRR', amount: '52000000.4', nativeAmount: '0', status: 'valued', reasons: [] })).toBe('52,000,000 IRR');
    expect(formatMoney({ currency: 'USD', amount: null, nativeAmount: '0', status: 'unvalued', reasons: ['fx_rate_missing'] })).toBe('— USD (FX rate missing)');
    expect(formatMoney({ currency: 'IRR', amount: null, nativeAmount: '0', status: 'unvalued', reasons: ['policy_unapproved'] })).toBe('— IRR (policy not approved)');
  });

  it('shows ratios as percentages by moving the decimal point', () => {
    expect(formatRatioPercent('1')).toBe('100 %');
    expect(formatRatioPercent('0.875')).toBe('87.5 %');
    expect(formatRatioPercent('0.05')).toBe('5 %');
    expect(formatRatioPercent(null)).toBe('—');
  });

  it('the submitter is told why approve is not offered (separation of duties)', () => {
    const submitted = view({ revision: { ...view().revision, lifecycle: 'in_review', submittedBy: 'me', submittedHash: 'b'.repeat(64) } });
    expect(reviewGate(submitted, 'me')).toMatchObject({ allowed: false, code: 'SEPARATION_OF_DUTIES' });
    expect(reviewGate(submitted, 'someone-else')).toMatchObject({ allowed: true });
    expect(reviewGate(view(), 'someone-else').allowed).toBe(false);
  });

  it('a line author may reject but not approve (separation of duties, RC-01)', () => {
    const base = view();
    const submitted = view({
      revision: { ...base.revision, lifecycle: 'in_review', submittedBy: 'engineer', submittedHash: 'b'.repeat(64) },
      lines: [{ ...base.lines[0], authorId: 'manager' }],
    });
    expect(reviewGate(submitted, 'manager')).toMatchObject({ allowed: true });
    expect(approveGate(submitted, 'manager')).toMatchObject({ allowed: false, code: 'SEPARATION_OF_DUTIES' });
    expect(approveGate(submitted, 'other-manager')).toMatchObject({ allowed: true });
  });
});

describe('query keys', () => {
  it('scopes the reconciliation cache by tenant and period; the server key changes with row version and run', () => {
    expect(reconciliationKey('t1', 'p1')).toEqual(v2Keys.detail('t1', 'period-accounting', 'p1', 'reconciliation:current'));
    expect(reconciliationKey('t1', 'p1')).not.toEqual(reconciliationKey('t2', 'p1'));
    expect(serverKeyOf(view())).not.toEqual(serverKeyOf(view({ rowVersion: 5 })));
    expect(serverKeyOf(view())).not.toEqual(serverKeyOf(view({ baseRunId: 'run-2' })));
  });
});
