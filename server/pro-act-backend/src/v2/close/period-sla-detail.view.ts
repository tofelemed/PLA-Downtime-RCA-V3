import { PeriodSlaSnapshot } from '../../close/period-sla.service';
import { PeriodSlaV2View, toPeriodSlaView } from './period-sla.view';

export interface DataHoldV2View {
  id: string;
  kind: string;
  reason: string;
  startedAt: string;
  startedBy: string | null;
  endedAt: string | null;
  endedBy: string | null;
  endNote: string | null;
}

export interface RejectionV2View {
  at: string;
  by: string | null;
  reason: string | null;
  /** line ids or candidate auto keys the reviewer named */
  failedLines: string[];
  /** when the corrected submission is due (SLA policy) */
  resubmitDueAt: string | null;
  rejection: number | null;
  escalated: boolean;
  escalatedTo: string | null;
}

/** `GET /v2/production-periods/:id/sla`. */
export interface PeriodSlaDetailV2View {
  periodId: string;
  sla: PeriodSlaV2View;
  holds: DataHoldV2View[];
  lastRejection: RejectionV2View | null;
}

const text = (value: unknown): string | null =>
  typeof value === 'string' ? value : null;

export function toPeriodSlaDetailView(
  snapshot: PeriodSlaSnapshot,
): PeriodSlaDetailV2View {
  const rejection = snapshot.lastRejection;
  const detail = rejection?.detail ?? {};
  return {
    periodId: snapshot.periodId,
    sla: toPeriodSlaView(snapshot.sla),
    holds: snapshot.holds.map((h) => ({
      id: h.id,
      kind: h.kind,
      reason: h.reason,
      startedAt: h.startedAt.toISOString(),
      startedBy: h.startedBy,
      endedAt: h.endedAt ? h.endedAt.toISOString() : null,
      endedBy: h.endedBy,
      endNote: h.endNote,
    })),
    lastRejection: rejection
      ? {
          at: rejection.createdAt.toISOString(),
          by: rejection.actorId,
          reason: rejection.reason,
          failedLines: Array.isArray(detail.failedLines)
            ? detail.failedLines.filter(
                (ref): ref is string => typeof ref === 'string',
              )
            : [],
          resubmitDueAt: text(detail.resubmitDueAt),
          rejection:
            typeof detail.rejection === 'number' ? detail.rejection : null,
          escalated: detail.escalated === true,
          escalatedTo: text(detail.escalatedTo),
        }
      : null,
  };
}
