import { ForbiddenException } from '@nestjs/common';
import { RequestContext } from '../common/context/request-context';
import { RcaAction } from '../rca/entities/rca-action.entity';
import { RCA } from '../rca/rca.entity';
import { applyCompletion } from './action-completion';
import { assertIndependentApprover } from './case-transition-rules';

const context = (isSuperAdmin: boolean): RequestContext => ({
  userId: 'author',
  tenantId: 'plant',
  organizationId: null,
  legacyRole: isSuperAdmin ? 'SuperAdmin' : 'TenantAdmin',
  roles: isSuperAdmin ? ['SuperAdmin'] : ['manager_approver'],
  scopes: [],
  isSuperAdmin,
  correlationId: 'test',
});

describe('RCA SuperAdmin independence exception', () => {
  it('only SuperAdmin can approve a closure of their own investigation', () => {
    const rca = Object.assign(new RCA(), {
      createdBy: 'author',
      teamLeadId: 'author',
      teamMemberIds: ['author'],
      closureRequestedBy: 'author',
      investigatorIds: ['author'],
    });
    expect(() => assertIndependentApprover(context(false), rca)).toThrow(
      ForbiddenException,
    );
    expect(() => assertIndependentApprover(context(true), rca)).not.toThrow();
  });

  it('SuperAdmin completes their own action with evidence; ordinary owners cannot', () => {
    const action: RcaAction = Object.assign(new RcaAction(), {
      status: 'done',
      ownerId: 'author',
      actionType: 'repair',
      completionEvidenceRef: 'WO-123 acceptance test',
    });
    const input = {
      actorId: 'author',
      completedAt: null,
      now: new Date('2026-10-16T00:00:00Z'),
    };
    expect(() => applyCompletion({ status: 'open' }, action, input)).toThrow(
      ForbiddenException,
    );
    applyCompletion({ status: 'open' }, action, {
      ...input,
      isSuperAdmin: true,
    });
    expect(action.completionVerifiedBy).toBe('author');
    expect(action.completedAt).toEqual(input.now);
    action.completionEvidenceRef = null;
    expect(() =>
      applyCompletion({ status: 'open' }, action, {
        ...input,
        isSuperAdmin: true,
      }),
    ).toThrow();
  });
});
