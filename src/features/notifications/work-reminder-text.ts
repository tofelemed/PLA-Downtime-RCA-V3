import type { NotificationView } from '@/api/v2/types/notifications';
import { plural } from '@/features/ux-kit/format/plural';
import { formatOperationalDate, toDigits, type CalendarDisplayOptions } from '@/lib/dates';

/** Same shape as `NotificationText` in `notification-text.ts` (kept separate to avoid an import cycle). */
interface ReminderText {
  title: string;
  body: string;
  href: string | null;
}

export const WORK_REMINDER_KINDS = ['rca_action_due', 'rca_action_overdue', 'task_due', 'task_overdue', 'uncoded_backlog', 'long_open_stop'] as const;

const text = (value: unknown): string | null => (typeof value === 'string' && value.trim() !== '' ? value : null);
const countOf = (value: unknown) => (typeof value === 'number' ? value : 0);
const stopsText = (value: unknown, pref: CalendarDisplayOptions) => plural(countOf(value), 'stop', 'stops', (n) => toDigits(String(n), pref.digits));

const levelOf = (detail: Record<string, unknown>) => (typeof detail.level === 'number' ? detail.level : 0);

/** RCA action / task due soon, overdue, or escalated after a week overdue (backend `work-item-reminders.ts`). */
function workItemText(n: NotificationView): ReminderText {
  const d = n.detail;
  const isAction = n.entityType === 'rca_action';
  const noun = isAction ? 'Corrective action' : 'Task';
  const level = levelOf(d);
  const title = level === 0 ? `${noun} due soon` : level === 1 ? `${noun} overdue` : `${noun} overdue — escalated to you`;
  const caseTitle = text(d.caseTitle);
  const body = [text(d.title) ?? noun, caseTitle ? `in “${caseTitle}”` : null].filter(Boolean).join(' ');
  const rcaId = text(d.rcaId);
  const href = isAction ? (rcaId ? `/rca/${encodeURIComponent(rcaId)}/actions` : null) : `/tasks/${encodeURIComponent(n.entityId)}`;
  return { title, body, href };
}

/** A stop still running past 2 h (level 1) or 8 h (level 2) — the hours are the server's message. */
function longStopText(n: NotificationView): ReminderText {
  const d = n.detail;
  const where = text(d.unitName) ?? 'Unit';
  return {
    title: levelOf(d) > 1 ? 'Long stop still running (escalated)' : 'Long stop still running',
    body: `${where}: ${text(d.message) ?? 'stop still running'}`,
    href: `/events/${encodeURIComponent(n.entityId)}`,
  };
}

/** Uncoded stops of a unit and production day waiting for a reason. */
function backlogText(n: NotificationView, pref: CalendarDisplayOptions): ReminderText {
  const d = n.detail;
  const day = text(d.localDate);
  const where = [text(d.unitName) ?? 'Unit', day ? formatOperationalDate(day, pref) : null].filter(Boolean).join(' · ');
  const unitId = text(d.unitId) ?? n.entityId;
  return {
    title: levelOf(d) > 1 ? 'Uncoded stops still waiting (escalated)' : 'Uncoded stops waiting',
    body: `${where}: ${stopsText(d.stops, pref)} waiting for a reason`,
    href: `/events?units=${encodeURIComponent(unitId)}&coding=uncoded`,
  };
}

export function isWorkReminder(kind: string): boolean {
  return (WORK_REMINDER_KINDS as readonly string[]).includes(kind);
}

/** Text of the item 6 reminders; the counts and levels come from the server's detail. */
export function workReminderText(n: NotificationView, pref: CalendarDisplayOptions): ReminderText {
  if (n.kind === 'long_open_stop') return longStopText(n);
  if (n.kind === 'uncoded_backlog') return backlogText(n, pref);
  return workItemText(n);
}
