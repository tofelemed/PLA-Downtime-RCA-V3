import { pausedMs, SlaInputs, slaStatus } from './reconciliation-sla';
import {
  parseReconciliationSla,
  RECONCILIATION_SLA_DEFAULT,
} from './sla-policy';
import { WorkflowPolicyError } from './policy-fields';

/** SME R3 worked example: the production day ends 06:00 Monday (local = UTC here). */
const MONDAY_0600 = new Date('2026-10-19T06:00:00Z');
const at = (iso: string) => new Date(iso);

const base = (over: Partial<SlaInputs> = {}): SlaInputs => ({
  dayEnd: MONDAY_0600,
  asOf: at('2026-10-19T10:00:00Z'),
  workflow: 'draft',
  lastRejectedAt: null,
  rejections: 0,
  holds: [],
  ...over,
});

const sla = (over: Partial<SlaInputs> = {}) =>
  slaStatus(base(over), RECONCILIATION_SLA_DEFAULT);

describe('reconciliation SLA clocks (SME R3 / R6)', () => {
  it('worked example: submission due 18:00 Monday, approval 06:00 Tuesday', () => {
    const status = sla();
    expect(status.submitDueAt.toISOString()).toBe('2026-10-19T18:00:00.000Z');
    expect(status.approveDueAt.toISOString()).toBe('2026-10-20T06:00:00.000Z');
    expect(status).toMatchObject({
      stage: 'preparation',
      overdue: false,
      ageSeconds: 4 * 3600,
      escalationLevel: 0,
    });
  });

  it('a draft past 18:00 is overdue; in review it is due at 06:00 Tuesday', () => {
    expect(sla({ asOf: at('2026-10-19T18:00:01Z') }).overdue).toBe(true);
    const review = sla({
      workflow: 'in_review',
      asOf: at('2026-10-20T05:00:00Z'),
    });
    expect(review).toMatchObject({ stage: 'review', overdue: false });
    expect(
      sla({ workflow: 'stale', asOf: at('2026-10-20T06:00:01Z') }).overdue,
    ).toBe(true);
  });

  it('unresolved at 06:00 Wednesday (48 h) escalates to production accounting, at 72 h to plant management', () => {
    expect(sla({ asOf: at('2026-10-21T06:00:00Z') })).toMatchObject({
      escalationLevel: 1,
      escalatedTo: 'production_accountant',
    });
    expect(
      sla({ workflow: 'in_review', asOf: at('2026-10-22T06:00:00Z') }),
    ).toMatchObject({ escalationLevel: 2, escalatedTo: 'manager_approver' });
  });

  it('waiting for the lab pauses the clock: not overdue, due times move, age excludes the wait', () => {
    const holds = [
      {
        startedAt: at('2026-10-19T08:00:00Z'),
        endedAt: at('2026-10-20T08:00:00Z'),
      },
    ];
    const released = sla({ holds, asOf: at('2026-10-20T10:00:00Z') });
    expect(released.submitDueAt.toISOString()).toBe('2026-10-20T18:00:00.000Z');
    expect(released).toMatchObject({
      stage: 'preparation',
      overdue: false,
      pausedSeconds: 24 * 3600,
      ageSeconds: 4 * 3600,
    });
    const waiting = sla({
      holds: [{ startedAt: at('2026-10-19T08:00:00Z'), endedAt: null }],
      asOf: at('2026-10-25T08:00:00Z'),
    });
    expect(waiting).toMatchObject({
      stage: 'waiting_for_data',
      overdue: false,
      escalationLevel: 0,
      ageSeconds: 2 * 3600,
    });
  });

  it('a hold before the day ended does not count; holds never overlap the future', () => {
    const holds = [
      {
        startedAt: at('2026-10-19T00:00:00Z'),
        endedAt: at('2026-10-19T07:00:00Z'),
      },
    ];
    expect(pausedMs(holds, MONDAY_0600, at('2026-10-19T10:00:00Z'))).toBe(
      3_600_000,
    );
  });

  it('a rejection gives the preparer a new due time; the third rejection escalates', () => {
    const rejected = sla({
      workflow: 'draft',
      lastRejectedAt: at('2026-10-20T09:00:00Z'),
      rejections: 2,
      asOf: at('2026-10-20T12:00:00Z'),
    });
    expect(rejected.submitDueAt.toISOString()).toBe('2026-10-20T21:00:00.000Z');
    expect(rejected.approveDueAt.toISOString()).toBe(
      '2026-10-21T09:00:00.000Z',
    );
    expect(rejected).toMatchObject({
      overdue: false,
      rejectionEscalated: false,
    });
    expect(sla({ rejections: 3 }).rejectionEscalated).toBe(true);
  });

  it('an approved period is done: never overdue, never escalated', () => {
    expect(
      sla({
        workflow: 'approved',
        rejections: 5,
        asOf: at('2026-11-30T00:00:00Z'),
      }),
    ).toMatchObject({
      stage: 'done',
      overdue: false,
      escalationLevel: 0,
      rejectionEscalated: false,
      ageSeconds: 0,
    });
  });

  it('before the production day ends nothing is due yet', () => {
    expect(sla({ asOf: at('2026-10-19T05:00:00Z') })).toMatchObject({
      stage: 'not_due',
      overdue: false,
      ageSeconds: 0,
    });
  });

  it('the policy body parses the pilot default and refuses malformed versions', () => {
    expect(parseReconciliationSla(RECONCILIATION_SLA_DEFAULT)).toEqual(
      RECONCILIATION_SLA_DEFAULT,
    );
    expect(() =>
      parseReconciliationSla({
        ...RECONCILIATION_SLA_DEFAULT,
        approveWithinHours: 6,
      }),
    ).toThrow(WorkflowPolicyError);
    expect(() =>
      parseReconciliationSla({
        ...RECONCILIATION_SLA_DEFAULT,
        escalations: [
          { afterHours: 72, role: 'manager_approver' },
          { afterHours: 48, role: 'production_accountant' },
        ],
      }),
    ).toThrow(WorkflowPolicyError);
  });
});
