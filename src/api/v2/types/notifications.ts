/**
 * In-app notifications (backend `src/v2/notifications/notifications-v2.controller.ts`, EXPERT_REVIEW Area 3):
 * the signed-in user's own, newest first. `detail` is structured; the client renders it in plant time.
 */
export interface NotificationView {
  id: string;
  kind: 'sla_reminder' | 'sla_escalation' | string;
  entityType: string;
  entityId: string;
  detail: Record<string, unknown>;
  read: boolean;
  readAt: string | null;
  createdAt: string;
}

/** `detail` of an `sla_escalation` notification (SME R3 / R6). */
export interface SlaEscalationDetail {
  reason: 'age' | 'rejections';
  role: string;
  level: number | null;
  afterHours: number | null;
  rejections: number | null;
  periodId: string;
  unitId: string;
  unitName: string | null;
  planId: string | null;
  localDate: string;
  shiftName: string | null;
  escalatedAt: string;
}

/** `detail` of an `sla_reminder` notification (SME R3: the preparer / checker is told when a stage falls due). */
export interface SlaReminderDetail {
  reason: 'due';
  stage: 'submit' | 'approve';
  recipient: 'preparer' | 'checker';
  dueAt: string;
  periodId: string;
  unitId: string;
  unitName: string | null;
  planId: string | null;
  localDate: string;
  shiftName: string | null;
  remindedAt: string;
}
