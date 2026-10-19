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

/** Old and new loss value in one reporting currency and the change (server figures; null = unknown). */
export interface ValueDeltaView {
  currency: string;
  old: string | null;
  new: string | null;
  delta: string | null;
}

/** Loss value of each side in its own default valuation view (QA audit P-2). */
export interface RestatementValuesView {
  oldView: string | null;
  newView: string | null;
  viewChanged: boolean;
  currencies: ValueDeltaView[];
}

export type PostingTreatment = 'correction' | 'estimate_change' | 'other_adjustment' | 'no_posting';

export interface RestatementView {
  periodId: string;
  revision: number;
  lifecycle: string;
  afterClose: boolean;
  supersededRevision: number;
  operationalEffectiveDate: string;
  posting: { postingDate: string; treatment: PostingTreatment; note: string | null; decidedBy: string; decidedByName?: string | null; decidedAt: string } | null;
  /** absent from servers before the QA audit fixes */
  values?: RestatementValuesView | null;
  totals: TotalsDeltaView[];
  actuals: TotalsDeltaView[];
  lines: LineDeltaView[];
}
