import { escalationNotices } from './escalation-notices';
import { RECONCILIATION_SLA_DEFAULT } from './sla-policy';

const period = {
  periodId: 'p1',
  revisionId: 'r1',
  escalationLevel: 0,
  rejectionEscalated: false,
  rejections: 0,
};

/** SME R3 / R6: which in-app notices an escalated period owes (the job inserts each key once). */
describe('escalationNotices', () => {
  it('owes nothing before the first threshold', () => {
    expect(escalationNotices(period, RECONCILIATION_SLA_DEFAULT)).toEqual([]);
  });

  it('48 h tells production accounting; 72 h also plant management, one key per level', () => {
    const level1 = escalationNotices(
      { ...period, escalationLevel: 1 },
      RECONCILIATION_SLA_DEFAULT,
    );
    expect(level1).toEqual([
      {
        dedupeKey: 'sla:p1:age:1',
        role: 'production_accountant',
        reason: 'age',
        level: 1,
        afterHours: 48,
        rejections: null,
      },
    ]);
    const level2 = escalationNotices(
      { ...period, escalationLevel: 2 },
      RECONCILIATION_SLA_DEFAULT,
    );
    expect(level2.map((n) => [n.dedupeKey, n.role])).toEqual([
      ['sla:p1:age:1', 'production_accountant'],
      ['sla:p1:age:2', 'manager_approver'],
    ]);
  });

  it('the third rejection tells production accounting once per revision', () => {
    const notices = escalationNotices(
      { ...period, rejectionEscalated: true, rejections: 3 },
      RECONCILIATION_SLA_DEFAULT,
    );
    expect(notices).toEqual([
      {
        dedupeKey: 'sla:p1:rejection:r1',
        role: 'production_accountant',
        reason: 'rejections',
        level: null,
        afterHours: null,
        rejections: 3,
      },
    ]);
  });

  it('a level beyond the policy steps is capped at the last step', () => {
    const notices = escalationNotices(
      { ...period, escalationLevel: 5 },
      RECONCILIATION_SLA_DEFAULT,
    );
    expect(notices).toHaveLength(2);
  });
});
