import {
  longStopKey,
  reachedLevel,
  uncodedBacklogKey,
  workItemNotices,
} from './work-reminders';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const due = new Date('2027-03-10T12:00:00.000Z');
const timings = { leadMs: 2 * DAY, escalateMs: 7 * DAY };
const action = { kind: 'rca_action' as const, id: 'a1', dueAt: due };
const at = (offsetMs: number) => new Date(due.getTime() + offsetMs);

/** Item 6: due / overdue reminders of RCA actions and tasks, escalated once after 7 days overdue. */
describe('workItemNotices', () => {
  it('owes nothing before the lead time', () => {
    expect(workItemNotices(action, at(-2 * DAY - 1), timings)).toEqual([]);
  });

  it('inside the lead time: the owner is told it is due, keyed on the due date', () => {
    expect(workItemNotices(action, at(-2 * DAY), timings)).toEqual([
      {
        kind: 'rca_action_due',
        recipient: 'assignee',
        level: 0,
        dedupeKey: 'rca-action:a1:due:2027-03-10T12:00:00.000Z',
      },
    ]);
  });

  it('from the due date: overdue to the owner only, until the escalation age', () => {
    const notices = workItemNotices(action, at(0), timings);
    expect(notices).toEqual([
      {
        kind: 'rca_action_overdue',
        recipient: 'assignee',
        level: 1,
        dedupeKey: 'rca-action:a1:overdue:2027-03-10T12:00:00.000Z:1',
      },
    ]);
    expect(workItemNotices(action, at(7 * DAY - 1), timings)).toHaveLength(1);
  });

  it('7 days overdue: the escalation addressee is told too (an item first seen late owes both levels)', () => {
    const notices = workItemNotices(action, at(7 * DAY), timings);
    expect(notices.map((n) => [n.recipient, n.level])).toEqual([
      ['assignee', 1],
      ['escalation', 2],
    ]);
    expect(notices[1].dedupeKey).toBe(
      'rca-action:a1:overdue:2027-03-10T12:00:00.000Z:2',
    );
  });

  it('tasks get task kinds and keys; a new due date gives new keys', () => {
    const task = { kind: 'task' as const, id: 't1', dueAt: due };
    expect(workItemNotices(task, at(-HOUR), timings)[0]).toMatchObject({
      kind: 'task_due',
      dedupeKey: 'task:t1:due:2027-03-10T12:00:00.000Z',
    });
    const moved = { ...task, dueAt: new Date('2027-03-20T12:00:00.000Z') };
    expect(workItemNotices(moved, at(9 * DAY), timings)[0].dedupeKey).toBe(
      'task:t1:due:2027-03-20T12:00:00.000Z',
    );
  });
});

describe('reachedLevel', () => {
  it('counts the thresholds the age passed (0 below the first)', () => {
    const thresholds = [2 * HOUR, 8 * HOUR];
    expect(reachedLevel(2 * HOUR - 1, thresholds)).toBe(0);
    expect(reachedLevel(2 * HOUR, thresholds)).toBe(1);
    expect(reachedLevel(8 * HOUR, thresholds)).toBe(2);
    expect(reachedLevel(8 * HOUR, [8 * HOUR, 2 * HOUR])).toBe(2);
  });
});

describe('alert keys', () => {
  it('one per event and level, one per unit, production day and level', () => {
    expect(longStopKey('e1', 2)).toBe('long-stop:e1:2');
    expect(uncodedBacklogKey('u1', '2027-03-10', 1)).toBe(
      'uncoded:u1:2027-03-10:1',
    );
  });
});
