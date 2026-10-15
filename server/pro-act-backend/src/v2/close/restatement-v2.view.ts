import {
  LineDelta,
  TotalsDelta,
} from '../../domain/reconciliation/restatement-delta';
import { Restatement } from '../../reconciliation/restatement.service';

/** `GET /v2/production-periods/:id/restatement` (SME R5). */
export interface RestatementV2View {
  periodId: string;
  revision: number;
  lifecycle: string;
  afterClose: boolean;
  supersededRevision: number;
  /** the period's operational date — what the restated figures describe */
  operationalEffectiveDate: string;
  posting: {
    postingDate: string;
    treatment: string;
    note: string | null;
    decidedBy: string;
    decidedAt: string;
  } | null;
  totals: TotalsDelta[];
  actuals: TotalsDelta[];
  lines: LineDelta[];
}

export function toRestatementView(r: Restatement): RestatementV2View {
  return {
    periodId: r.period.id,
    revision: r.revision.revision,
    lifecycle: r.revision.lifecycle,
    afterClose: r.revision.afterClose,
    supersededRevision: r.superseded.revision,
    operationalEffectiveDate: r.period.localDate,
    posting: r.posting
      ? {
          postingDate: r.posting.postingDate,
          treatment: r.posting.treatment,
          note: r.posting.note,
          decidedBy: r.posting.decidedBy,
          decidedAt: r.posting.decidedAt.toISOString(),
        }
      : null,
    totals: r.delta.totals,
    actuals: r.delta.actuals,
    lines: r.delta.lines,
  };
}
