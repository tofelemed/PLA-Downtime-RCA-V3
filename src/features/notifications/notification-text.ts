import type { NotificationView, SlaEscalationDetail } from '@/api/v2/types/notifications';
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

/**
 * Plain-language text of a notification (SME R3 / R6 escalations), with the operational date in the plant
 * calendar and digits; the numbers come from the server's detail, nothing is computed here.
 */
export function notificationText(n: NotificationView, pref: CalendarDisplayOptions): NotificationText {
  if (n.kind !== 'sla_escalation' || !isSlaDetail(n.detail)) return { title: 'Notification', body: '', href: null };
  const d = n.detail;
  const where = [d.unitName ?? 'Unit', formatOperationalDate(d.localDate, pref), d.shiftName].filter(Boolean).join(' · ');
  const count = (value: number | null) => toDigits(String(value ?? 0), pref.digits);
  const body =
    d.reason === 'rejections'
      ? `${where}: rejected ${count(d.rejections)} times and still not approved`
      : `${where}: not approved ${count(d.afterHours)} hours after the production day ended`;
  return {
    title: `Escalated to ${roleLabel(d.role)}`,
    body,
    href: d.planId ? `/plans/${d.planId}/periods/${d.periodId}` : null,
  };
}
