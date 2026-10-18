/**
 * In-app notifications (backend `src/v2/notifications/notifications-v2.controller.ts`, EXPERT_REVIEW Area 3):
 * the signed-in user's own, newest first. `detail` is structured; the client renders it in plant time.
 */
export interface NotificationView {
  id: string;
  kind: 'sla_reminder' | 'sla_escalation' | 'source_fallback' | string;
  entityType: string;
  entityId: string;
  detail: Record<string, unknown>;
  read: boolean;
  readAt: string | null;
  createdAt: string;
  /** the shared work item every recipient's copy names (null = information only) */
  workItemKey?: string | null;
  /** set once anyone did the work: the notification left every recipient's active list */
  resolvedAt?: string | null;
  resolution?: 'completed' | 'superseded' | null;
}

/** Bell filter: only unread active notifications, or every active one. */
export type NotificationFilter = 'unread' | 'all';

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

/** `detail` of a `source_fallback` notification (plan 1.10 step 5: the actuals' source moved to a substitute or back). */
export interface SourceFallbackDetail {
  kind: 'activated' | 'ended';
  periodId: string;
  unitId: string;
  unitName: string | null;
  planId: string | null;
  localDate: string;
  shiftName: string | null;
  sliceId: string;
  productId: string;
  used: { rank: number; source: string; sourceClass: string | null; boundary: string | null; label: string } | null;
  replaced: { rank: number; source: string; sourceClass: string | null; boundary: string | null } | null;
  reason: string | null;
  /** on return: the primary and the substitute differed beyond tolerance (the primary is kept) */
  conflict: Record<string, unknown> | null;
}
