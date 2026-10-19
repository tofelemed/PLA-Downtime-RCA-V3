import {
  LineDelta,
  TotalsDelta,
} from '../../domain/reconciliation/restatement-delta';
import { Restatement } from '../../reconciliation/restatement.service';
import { RestatementValues } from '../../reconciliation/restatement-values';

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
    /** display name of the finance approver who decided (null when the user is gone) */
    decidedByName: string | null;
    decidedAt: string;
  } | null;
  /** loss value per currency, old and new each in its own default valuation view; null when not valued */
  values: RestatementValues | null;
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
          decidedByName: r.decidedByName,
          decidedAt: r.posting.decidedAt.toISOString(),
        }
      : null,
    values: r.values,
    totals: r.delta.totals,
    actuals: r.delta.actuals,
    lines: r.delta.lines,
  };
}
