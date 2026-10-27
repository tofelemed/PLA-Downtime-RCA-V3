import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import {
  anonymousContext,
  RequestContext,
} from '../../common/context/request-context';
import { POSTING_PROPOSER_REASON } from '../../reconciliation/posting-independence';
import { LossAccountingV2Controller } from '../loss-accounting/loss-accounting-v2.controller';
import { LOSS_ACCOUNTING_APPROVERS } from '../loss-accounting/loss-accounting-roles';
import { StopReconciliationsV2Controller } from '../stop-events/stop-reconciliations-v2.controller';
import { STOP_DECISION_ROLES } from '../stop-events/stop-event-roles';
import { toApprovalItem } from './approval-inbox-query';
import { approvalScope } from './approval-scope';
import { WORKFLOW_APPROVALS } from './approval-workflows';

type Row = Parameters<typeof toApprovalItem>[2];
const tenantId = '00000000-0000-4000-8000-000000000001';
const userId = '00000000-0000-4000-8000-000000000002';
const context = (extra: Partial<RequestContext> = {}): RequestContext => ({
  ...anonymousContext('decision-rules'),
  tenantId,
  userId,
  ...extra,
});
const definition = (kind: string) => {
  const found = WORKFLOW_APPROVALS.find((item) => item.kind === kind);
  if (!found) throw new Error(`no ${kind}`);
  return found;
};
const row = (extra: Partial<Row> = {}): Row => ({
  id: '00000000-0000-4000-8000-000000000003',
  title: 'Restatement',
  summary: null,
  state: 'awaiting_posting',
  at: '2027-03-01T00:00:00.000000Z',
  unitId: null,
  unitName: null,
  authorId: '00000000-0000-4000-8000-000000000009',
  authorName: 'Reza',
  requesterId: null,
  href: '/',
  commandId: '00000000-0000-4000-8000-000000000003',
  version: 2,
  rowVersion: 1,
  targetPeriodId: null,
  targetPlanId: null,
  targetRevision: 2,
  targetMonthKey: null,
  targetEventId: null,
  targetProfileId: null,
  ...extra,
});

describe('approval inbox decision rules (owner decisions 2026-10-19)', () => {
  it('lists duplicate stops to exactly the roles the decision routes accept (event writers)', () => {
    const merge = definition('stop-merge');
    expect(merge.roles).toBe(STOP_DECISION_ROLES);
    for (const handler of ['accept', 'reject', 'undo'] as const) {
      const method: unknown = Object.getOwnPropertyDescriptor(
        StopReconciliationsV2Controller.prototype,
        handler,
      )?.value;
      expect(Reflect.getMetadata(ROLES_KEY, method as object)).toEqual([
        ...STOP_DECISION_ROLES,
      ]);
    }
    expect(STOP_DECISION_ROLES).toEqual(
      expect.arrayContaining(['operator', 'production_engineer']),
    );
    expect(STOP_DECISION_ROLES).not.toContain('viewer');
    const operator = context({
      legacyRole: 'Operator',
      roles: ['Operator', 'operator'],
    });
    expect(approvalScope(operator, merge.roles, merge.unit).sql).toBe('TRUE');
    const viewer = context({
      roles: ['viewer'],
      scopes: [{ kind: 'tenant', id: tenantId, tenantId, role: 'viewer' }],
    });
    expect(approvalScope(viewer, merge.roles, merge.unit).sql).toBe('FALSE');
  });

  it('blocks the proposer of the correction behind a restatement from setting its posting', () => {
    const posting = definition('finance-posting');
    expect(posting.ownMayDecide).toBeUndefined();
    const own = toApprovalItem(
      context(),
      posting,
      row({ requesterId: userId }),
    );
    expect(own).toMatchObject({
      canDecide: false,
      decisionBlockedReason: POSTING_PROPOSER_REASON,
    });
    expect(
      toApprovalItem(
        context({ isSuperAdmin: true }),
        posting,
        row({ requesterId: userId }),
      ).canDecide,
    ).toBe(true);
  });

  it('lists loss accounting drafts to the roles that approve and reject them, never the author', () => {
    const loss = definition('loss-accounting');
    expect(loss.roles).toBe(LOSS_ACCOUNTING_APPROVERS);
    expect(loss.roles).toContain('production_accountant');
    expect(loss.resource).toBe('loss-accounting/versions');
    expect(loss.pending).toContain("r.policyKind = 'loss_accounting'");
    expect(loss.actions).toEqual(['approve', 'reject']);
    for (const handler of ['approve', 'reject'] as const) {
      const method: unknown = Object.getOwnPropertyDescriptor(
        LossAccountingV2Controller.prototype,
        handler,
      )?.value;
      expect(Reflect.getMetadata(ROLES_KEY, method as object)).toEqual([
        ...LOSS_ACCOUNTING_APPROVERS,
      ]);
    }
    const own = toApprovalItem(context(), loss, row({ requesterId: userId }));
    expect(own.kind).toBe('loss-accounting');
    expect(own.actions.every((action) => action.disabledReason)).toBe(true);
    expect(own.canDecide).toBe(false);
  });

  it('lets the revision approver post a restatement without a human proposer', () => {
    const posting = definition('finance-posting');
    const item = toApprovalItem(
      context({ userId: row().authorId ?? undefined }),
      posting,
      row(),
    );
    expect(item).toMatchObject({
      canDecide: true,
      decisionBlockedReason: null,
    });
    expect(item.authorName).toBe('Reza');
  });
});
