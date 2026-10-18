/** A piece of assigned work with a due date: a corrective action of an RCA case or a task. */
export type WorkItemKind = 'rca_action' | 'task';

export type WorkReminderKind =
  | 'rca_action_due'
  | 'rca_action_overdue'
  | 'task_due'
  | 'task_overdue';

/** Who a work notice is for: the owner / assignee, or the escalation addressee (case team lead / task assigner). */
export type WorkRecipient = 'assignee' | 'escalation';

export interface WorkItem {
  kind: WorkItemKind;
  id: string;
  dueAt: Date;
}

/** Lead time before the due date and age past it at which an overdue item escalates (milliseconds). */
export interface WorkTimings {
  leadMs: number;
  escalateMs: number;
}

/** One notice owed for a work item: at most one per item, due date and level, ever. */
export interface WorkNotice {
  kind: WorkReminderKind;
  recipient: WorkRecipient;
  /** 0 = due soon, 1 = overdue, 2 = escalated */
  level: 0 | 1 | 2;
  dedupeKey: string;
}

const KEY_PREFIX: Readonly<Record<WorkItemKind, string>> = {
  rca_action: 'rca-action',
  task: 'task',
};

/**
 * Reminders of an open work item at `asOf` (item 6): inside the lead time before the due date the assignee
 * is told it is due (`<kind>_due`); from the due date on it is overdue (`<kind>_overdue`, level 1); after
 * `escalateMs` overdue the escalation addressee is told too (level 2). An item first seen late owes every
 * overdue level it reached, never the "due soon" one. Keys carry the due date, so a rescheduled item is
 * reminded again for its new date. Pure.
 */
export function workItemNotices(
  item: WorkItem,
  asOf: Date,
  timings: WorkTimings,
): WorkNotice[] {
  const due = item.dueAt.getTime();
  const now = asOf.getTime();
  const base = `${KEY_PREFIX[item.kind]}:${item.id}`;
  const dueIso = item.dueAt.toISOString();
  if (now < due - timings.leadMs) return [];
  if (now < due) {
    return [
      {
        kind: `${item.kind}_due`,
        recipient: 'assignee',
        level: 0,
        dedupeKey: `${base}:due:${dueIso}`,
      },
    ];
  }
  const overdue: WorkNotice[] = [
    {
      kind: `${item.kind}_overdue`,
      recipient: 'assignee',
      level: 1,
      dedupeKey: `${base}:overdue:${dueIso}:1`,
    },
  ];
  if (now >= due + timings.escalateMs) {
    overdue.push({
      kind: `${item.kind}_overdue`,
      recipient: 'escalation',
      level: 2,
      dedupeKey: `${base}:overdue:${dueIso}:2`,
    });
  }
  return overdue;
}

/**
 * Highest threshold level an age reached: 0 below the first threshold, else how many thresholds it
 * passed (thresholds in any order). Only the highest level is notified, once. Pure.
 */
export function reachedLevel(
  ageMs: number,
  thresholdsMs: readonly number[],
): number {
  return thresholdsMs.filter((threshold) => ageMs >= threshold).length;
}

/** One `long_open_stop` notice per event and level (2 h, then 8 h by default). */
export function longStopKey(eventId: string, level: number): string {
  return `long-stop:${eventId}:${level}`;
}

/** One `uncoded_backlog` notice per unit, plant production day and level. */
export function uncodedBacklogKey(
  unitId: string,
  localDate: string,
  level: number,
): string {
  return `uncoded:${unitId}:${localDate}:${level}`;
}
