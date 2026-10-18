/**
 * The shared work item a notification is about (owner 18 Oct: "notifications are per person, the work is
 * shared"). Every recipient's copy of one piece of work carries the same key, so when anyone finishes the
 * work every copy is resolved together. Keys name the record type, its id and the work owed, and leave out
 * the reminder level and the recipient:
 *
 * - `uncoded:<unitId>:<localDate>` — code the uncoded stops of a unit and production day;
 * - `long-stop:<eventId>` — attend an open stop that keeps running;
 * - `rca-action:<id>:<dueIso>` / `task:<id>:<dueIso>` — finish the action or task due then (a new due date is
 *   new work: the old reminders are superseded);
 * - `sla:<periodId>:due:<stage>:<revision>:<rejections>` — submit or approve the period in this cycle;
 * - `sla:<periodId>:approval` — get the period approved (age escalations);
 * - `sla:<periodId>:rejection:<revisionId>` — resolve the repeatedly rejected revision.
 *
 * `null` for notifications that are information only (a source fallback), never resolved. Pure.
 */
export function workItemKeyOf(kind: string, dedupeKey: string): string | null {
  if (kind === 'uncoded_backlog' || kind === 'long_open_stop') {
    return dedupeKey.replace(/:\d+$/, '');
  }
  const work =
    /^(rca-action|task):([^:]+):(?:due|overdue):(.+?Z)(?::\d+)?$/.exec(
      dedupeKey,
    );
  if (work) return `${work[1]}:${work[2]}:${work[3]}`;
  if (kind === 'sla_escalation') {
    return dedupeKey.replace(/^(sla:[^:]+):age:\d+$/, '$1:approval');
  }
  if (kind === 'sla_reminder') return dedupeKey;
  return null;
}

/** Why a notification left the active list: its work was done, or newer work replaced it (rescheduled, next cycle). */
export type NotificationResolution = 'completed' | 'superseded';
