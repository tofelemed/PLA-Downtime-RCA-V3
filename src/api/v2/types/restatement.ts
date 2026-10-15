/**
 * Restatement view (backend `src/v2/close/restatement-v2.view.ts`, SME R5): old (the superseded approved
 * revision) vs new per unit of measure and per line, and finance's posting decision.
 */
export interface DeltaFigureView {
  old: string | null;
  new: string | null;
  delta: string | null;
}

export interface TotalsDeltaView {
  uom: string | null;
  figures: Record<string, DeltaFigureView>;
}

export interface LineDeltaView extends DeltaFigureView {
  kind: string;
  reasonCodeId: string | null;
  uom: string | null;
}

export type PostingTreatment = 'correction' | 'estimate_change' | 'other_adjustment' | 'no_posting';

export interface RestatementView {
  periodId: string;
  revision: number;
  lifecycle: string;
  afterClose: boolean;
  supersededRevision: number;
  operationalEffectiveDate: string;
  posting: { postingDate: string; treatment: PostingTreatment; note: string | null; decidedBy: string; decidedAt: string } | null;
  totals: TotalsDeltaView[];
  actuals: TotalsDeltaView[];
  lines: LineDeltaView[];
}
