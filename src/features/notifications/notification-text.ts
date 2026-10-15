import type { NotificationView, SlaEscalationDetail, SlaReminderDetail, SourceFallbackDetail } from '@/api/v2/types/notifications';
import { formatOperationalDate, toDigits, type CalendarDisplayOptions } from '@/lib/dates';
import { roleLabel } from '@/features/ux-kit/labels/role-labels';

export interface NotificationText {
  title: string;
  body: string;
  /** the period page, when the period belongs to a plan */
  href: string | null;
}

const isSlaDetail = (detail: Record<string, unknown>): detail is Record<string, unknown> & SlaEscalationDetail =>
  typeof detail.periodId === 'string' && typeof detail.localDate === 'string' && (detail.reason === 'age' || detail.reason === 'rejections');

const isReminderDetail = (detail: Record<string, unknown>): detail is Record<string, unknown> & SlaReminderDetail =>
  typeof detail.periodId === 'string' && typeof detail.localDate === 'string' && (detail.stage === 'submit' || detail.stage === 'approve');

const isFallbackDetail = (detail: Record<string, unknown>): detail is Record<string, unknown> & SourceFallbackDetail =>
  typeof detail.periodId === 'string' && typeof detail.localDate === 'string' && (detail.kind === 'activated' || detail.kind === 'ended');

type PeriodNamed = Pick<SlaReminderDetail, 'unitName' | 'localDate' | 'shiftName'>;

const whereOf = (d: PeriodNamed, pref: CalendarDisplayOptions) =>
  [d.unitName ?? 'Unit', formatOperationalDate(d.localDate, pref), d.shiftName].filter(Boolean).join(' · ');

const periodHref = (d: Pick<SlaReminderDetail, 'planId' | 'periodId'>) => (d.planId ? `/plans/${d.planId}/periods/${d.periodId}` : null);

/** SME R3: the preparer is told when submission falls due, the checker when approval does. */
function reminderText(d: SlaReminderDetail, pref: CalendarDisplayOptions): NotificationText {
  const where = whereOf(d, pref);
  return d.stage === 'submit'
    ? { title: 'Submission due', body: `${where}: the reconciliation is due for submission`, href: periodHref(d) }
    : { title: 'Approval due', body: `${where}: the submitted reconciliation is due for your review`, href: periodHref(d) };
}

/** Plan 1.10 step 5: the actuals of a period moved to a substitute source, or back to the top-ranked one. */
function fallbackText(d: SourceFallbackDetail, pref: CalendarDisplayOptions): NotificationText {
  const where = whereOf(d, pref);
  const used = d.used?.label ?? 'a substitute source';
  if (d.kind === 'activated') return { title: 'Fallback source in use', body: `${where}: actuals now come from ${used}`, href: periodHref(d) };
  const conflict = d.conflict ? ' — the sources disagreed; the primary is kept and the conflict is shown on the period' : '';
  return { title: 'Primary source back', body: `${where}: actuals come from the primary source again${conflict}`, href: periodHref(d) };
}

/**
 * Plain-language text of a notification (SME R3 due reminders, R3 / R6 escalations), with the operational
 * date in the plant calendar and digits; the numbers come from the server's detail, nothing is computed here.
 */
export function notificationText(n: NotificationView, pref: CalendarDisplayOptions): NotificationText {
  if (n.kind === 'sla_reminder' && isReminderDetail(n.detail)) return reminderText(n.detail, pref);
  if (n.kind === 'source_fallback' && isFallbackDetail(n.detail)) return fallbackText(n.detail, pref);
  if (n.kind !== 'sla_escalation' || !isSlaDetail(n.detail)) return { title: 'Notification', body: '', href: null };
  const d = n.detail;
  const where = whereOf(d, pref);
  const count = (value: number | null) => toDigits(String(value ?? 0), pref.digits);
  const body =
    d.reason === 'rejections'
      ? `${where}: rejected ${count(d.rejections)} times and still not approved`
      : `${where}: not approved ${count(d.afterHours)} hours after the production day ended`;
  return {
    title: `Escalated to ${roleLabel(d.role)}`,
    body,
    href: periodHref(d),
  };
}
