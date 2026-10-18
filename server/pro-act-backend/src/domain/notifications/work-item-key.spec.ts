import { workItemKeyOf } from './work-item-key';
import {
  longStopKey,
  uncodedBacklogKey,
  workItemNotices,
} from './work-reminders';

const UNIT = '11111111-1111-4111-8111-111111111111';
const ITEM = '22222222-2222-4222-8222-222222222222';
const PERIOD = '33333333-3333-4333-8333-333333333333';
const DUE = new Date('2026-10-09T14:00:00.000Z');

describe('workItemKeyOf (shared work items, owner 18 Oct)', () => {
  it('every level of an uncoded backlog or long stop names one work item', () => {
    const levels = [1, 2].map((level) =>
      workItemKeyOf(
        'uncoded_backlog',
        uncodedBacklogKey(UNIT, '2026-10-17', level),
      ),
    );
    expect(levels).toEqual([
      `uncoded:${UNIT}:2026-10-17`,
      `uncoded:${UNIT}:2026-10-17`,
    ]);
    expect(workItemKeyOf('long_open_stop', longStopKey(ITEM, 2))).toBe(
      `long-stop:${ITEM}`,
    );
  });

  it('due, overdue and escalated reminders of an action share the item and its due date', () => {
    const asOf = new Date(DUE.getTime() + 8 * 86_400_000);
    const notices = workItemNotices(
      { kind: 'rca_action', id: ITEM, dueAt: DUE },
      asOf,
      {
        leadMs: 86_400_000,
        escalateMs: 7 * 86_400_000,
      },
    );
    const soon = workItemNotices(
      { kind: 'task', id: ITEM, dueAt: DUE },
      new Date(DUE.getTime() - 1),
      {
        leadMs: 86_400_000,
        escalateMs: 7 * 86_400_000,
      },
    );
    const keys = notices.map((n) => workItemKeyOf(n.kind, n.dedupeKey));
    expect(keys).toEqual([
      `rca-action:${ITEM}:${DUE.toISOString()}`,
      `rca-action:${ITEM}:${DUE.toISOString()}`,
    ]);
    expect(workItemKeyOf(soon[0].kind, soon[0].dedupeKey)).toBe(
      `task:${ITEM}:${DUE.toISOString()}`,
    );
  });

  it('period SLA notices: a due reminder is its stage cycle, age escalations one approval, a rejection its revision', () => {
    const cycle = `sla:${PERIOD}:due:approve:${ITEM}:1`;
    expect(workItemKeyOf('sla_reminder', cycle)).toBe(cycle);
    expect(workItemKeyOf('sla_escalation', `sla:${PERIOD}:age:2`)).toBe(
      `sla:${PERIOD}:approval`,
    );
    expect(
      workItemKeyOf('sla_escalation', `sla:${PERIOD}:rejection:${ITEM}`),
    ).toBe(`sla:${PERIOD}:rejection:${ITEM}`);
  });

  it('a source fallback is information only', () => {
    expect(
      workItemKeyOf('source_fallback', `fallback:${PERIOD}:activated`),
    ).toBeNull();
  });
});
