import { envInt } from '../common/helpers/time-bounds';

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * Thresholds of the work and downtime reminders (item 6), engineering defaults until the SME confirms them;
 * each can be set in the environment (positive integers).
 */
export interface WorkReminderConfig {
  /** RCA action / task "due soon" lead time (`NOTIFY_DUE_LEAD_DAYS`, 2 days) */
  dueLeadMs: number;
  /** overdue age at which the case team lead / task assigner is told (`NOTIFY_OVERDUE_ESCALATE_DAYS`, 7 days) */
  overdueEscalateMs: number;
  /** age after its end at which an uncoded stop is a backlog, then escalated (`NOTIFY_UNCODED_AGE_HOURS` 4, `NOTIFY_UNCODED_ESCALATE_HOURS` 24) */
  uncodedLevelsMs: [number, number];
  /** run time of an open unplanned stop per level (`NOTIFY_LONG_STOP_HOURS` 2, `NOTIFY_LONG_STOP_ESCALATE_HOURS` 8) */
  longStopLevelsMs: [number, number];
  /** how far back due dates and stops are looked at (`NOTIFY_LOOKBACK_DAYS`, 62 days = the queue window) */
  lookbackMs: number;
}

export function workReminderConfig(): WorkReminderConfig {
  return {
    dueLeadMs: envInt('NOTIFY_DUE_LEAD_DAYS', 2) * DAY_MS,
    overdueEscalateMs: envInt('NOTIFY_OVERDUE_ESCALATE_DAYS', 7) * DAY_MS,
    uncodedLevelsMs: [
      envInt('NOTIFY_UNCODED_AGE_HOURS', 4) * HOUR_MS,
      envInt('NOTIFY_UNCODED_ESCALATE_HOURS', 24) * HOUR_MS,
    ],
    longStopLevelsMs: [
      envInt('NOTIFY_LONG_STOP_HOURS', 2) * HOUR_MS,
      envInt('NOTIFY_LONG_STOP_ESCALATE_HOURS', 8) * HOUR_MS,
    ],
    lookbackMs: envInt('NOTIFY_LOOKBACK_DAYS', 62) * DAY_MS,
  };
}
